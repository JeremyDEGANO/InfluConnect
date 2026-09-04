"""
Two-factor authentication (TOTP) + password reset views.
"""
from __future__ import annotations

import base64
import io
import secrets

import pyotp
import qrcode
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .services import email_service
from .throttling import MFAResetRateThrottle, PasswordResetRateThrottle


TOTP_ISSUER = "InfluConnect"
PASSWORD_RESET_MAX_AGE = 60 * 60  # 1 hour
EMAIL_VERIFY_MAX_AGE = 24 * 60 * 60  # 24 hours
TOTP_RESET_MAX_AGE = 60 * 60  # 1 hour
EMAIL_OTP_MAX_AGE = 10 * 60  # 10 minutes


def _signer() -> TimestampSigner:
    return TimestampSigner(salt="password-reset")


def _totp_reset_signer() -> TimestampSigner:
    return TimestampSigner(salt="totp-reset")


def _password_reset_cache_key(user_id: int) -> str:
    return f"password-reset:{user_id}"


def _email_verify_signer() -> TimestampSigner:
    return TimestampSigner(salt="email-verify")


def _email_verify_cache_key(user_id: int) -> str:
    return f"email-verify:{user_id}"


def send_verification_email(user) -> bool:
    """Issue a fresh one-time link and email it. Safe to call repeatedly."""
    if not user.email or user.email_verified:
        return False
    token = _issue_one_time_token(
        signer=_email_verify_signer(),
        cache_key=_email_verify_cache_key(user.pk),
        user_id=user.pk,
        ttl=EMAIL_VERIFY_MAX_AGE,
    )
    frontend = getattr(settings, "FRONTEND_URL", "https://influconnect.fr").rstrip("/")
    link = f"{frontend}/verify-email#token={token}"
    return email_service.send_email_verification(
        user.email, link, language=user.language_preference,
    )


def _totp_reset_cache_key(user_id: int) -> str:
    return f"totp-reset:{user_id}"


def _issue_one_time_token(*, signer: TimestampSigner, cache_key: str, user_id: int, ttl: int) -> str:
    nonce = secrets.token_urlsafe(16)
    cache.set(cache_key, nonce, timeout=ttl)
    return signer.sign(f"{user_id}:{nonce}")


def _consume_signed_token(*, token: str, signer: TimestampSigner, cache_key_builder, max_age: int):
    try:
        unsigned = signer.unsign(token, max_age=max_age)
    except SignatureExpired:
        return None, "expired"
    except BadSignature:
        return None, "invalid"

    try:
        user_pk_str, nonce = str(unsigned).split(":", 1)
        user_pk = int(user_pk_str)
    except (TypeError, ValueError):
        return None, "invalid"

    cache_key = cache_key_builder(user_pk)
    expected_nonce = cache.get(cache_key)
    if not expected_nonce or expected_nonce != nonce:
        return None, "invalid"
    return user_pk, cache_key


def _verify_totp(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    code = code.replace(" ", "").strip()
    try:
        return pyotp.TOTP(secret).verify(code, valid_window=1)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# 2FA setup / confirm / disable
# ---------------------------------------------------------------------------
class TOTPSetupView(APIView):
    """Generate a provisional TOTP secret and return QR code. Not enabled
    until the user confirms a valid code via ``TOTPConfirmView``."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.totp_enabled:
            return Response(
                {"detail": "Two-factor authentication is already enabled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        secret = pyotp.random_base32()
        user.totp_secret = secret  # stored but totp_enabled stays False until confirmed
        user.save(update_fields=["totp_secret"])
        account_name = user.email or user.username
        otpauth_url = pyotp.TOTP(secret).provisioning_uri(
            name=account_name, issuer_name=TOTP_ISSUER,
        )
        # Generate QR code as PNG base64
        img = qrcode.make(otpauth_url)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        qr_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        return Response(
            {
                "secret": secret,
                "otpauth_url": otpauth_url,
                "qr_png_base64": f"data:image/png;base64,{qr_b64}",
            }
        )


class TOTPConfirmView(APIView):
    """Verify a TOTP code once and enable 2FA on the account."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        code = (request.data.get("code") or "").strip()
        if not user.totp_secret:
            return Response(
                {"detail": "Call /auth/2fa/setup/ first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not _verify_totp(user.totp_secret, code):
            return Response(
                {"detail": "Invalid verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.totp_enabled = True
        # Keep a single second-factor method active at a time.
        user.email_2fa_enabled = False
        user.save(update_fields=["totp_enabled", "email_2fa_enabled"])
        return Response({"detail": "Two-factor authentication enabled.", "totp_enabled": True})


class TOTPDisableView(APIView):
    """Disable 2FA. Requires the current password and a valid TOTP code."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        password = request.data.get("password") or ""
        code = (request.data.get("code") or "").strip()
        if not user.check_password(password):
            return Response(
                {"detail": "Incorrect password."}, status=status.HTTP_400_BAD_REQUEST,
            )
        if user.totp_enabled and not _verify_totp(user.totp_secret, code):
            return Response(
                {"detail": "Invalid verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.totp_enabled = False
        user.totp_secret = ""
        user.save(update_fields=["totp_enabled", "totp_secret"])
        return Response({"detail": "Two-factor authentication disabled.", "totp_enabled": False})


class Email2FAEnableView(APIView):
    """Enable login verification by email code (OTP)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.email:
            return Response(
                {"detail": "An email address is required to enable email verification."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.email_2fa_enabled = True
        # Enforce a single active method when user chooses email mode.
        user.totp_enabled = False
        user.totp_secret = ""
        user.save(update_fields=["email_2fa_enabled", "totp_enabled", "totp_secret"])
        return Response({"detail": "Email verification enabled.", "email_2fa_enabled": True})


class Email2FADisableView(APIView):
    """Disable login verification by email code."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        password = request.data.get("password") or ""
        if not password:
            return Response(
                {"detail": "Password is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.check_password(password):
            return Response(
                {"detail": "Incorrect password."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.email_2fa_enabled = False
        user.save(update_fields=["email_2fa_enabled"])
        return Response({"detail": "Email verification disabled.", "email_2fa_enabled": False})


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------
class PasswordResetRequestView(APIView):
    """Send a password-reset email containing a signed token link.
    Always returns 200 to avoid leaking account existence."""

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if email:
            try:
                user = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                user = None
            if user is not None and user.is_active:
                token = _issue_one_time_token(
                    signer=_signer(),
                    cache_key=_password_reset_cache_key(user.pk),
                    user_id=user.pk,
                    ttl=PASSWORD_RESET_MAX_AGE,
                )
                frontend = getattr(settings, "FRONTEND_URL", "https://influconnect.fr").rstrip("/")
                link = f"{frontend}/reset-password/confirm?token={token}"
                email_service.send_password_reset(
                    user.email,
                    link,
                    language=user.language_preference,
                )
        return Response({"detail": "If that email exists, a reset link has been sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("token") or ""
        new_password = request.data.get("new_password") or ""
        if not token or not new_password:
            return Response(
                {"detail": "Token and new password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user_pk, cache_key = _consume_signed_token(
            token=token,
            signer=_signer(),
            cache_key_builder=_password_reset_cache_key,
            max_age=PASSWORD_RESET_MAX_AGE,
        )
        if cache_key == "expired":
            return Response({"detail": "Reset link expired."}, status=status.HTTP_400_BAD_REQUEST)
        if cache_key == "invalid":
            return Response({"detail": "Invalid reset link."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(pk=user_pk)
        except User.DoesNotExist:
            return Response({"detail": "Invalid reset link."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            return Response({"detail": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.save(update_fields=["password"])
        cache.delete(cache_key)
        return Response({"detail": "Password updated. You can now log in."})


# ---------------------------------------------------------------------------
# Helper used by LoginView
# ---------------------------------------------------------------------------
def verify_user_totp(user: User, code: str) -> bool:
    """Return True iff the user has 2FA enabled and the code is valid."""
    return bool(user.totp_enabled and _verify_totp(user.totp_secret, code))


def _email_otp_cache_key(user_id: int) -> str:
    return f"login:email-otp:{user_id}"


def issue_user_email_login_code(user: User) -> None:
    """Generate a short-lived email OTP for login and send it to the user."""
    if not user.email:
        return
    code = f"{secrets.randbelow(1_000_000):06d}"
    cache.set(_email_otp_cache_key(user.id), code, timeout=EMAIL_OTP_MAX_AGE)
    is_fr = (user.language_preference or "").lower().startswith("fr")

    email_service.send(
        to=user.email,
        subject=("InfluConnect — Code de connexion" if is_fr else "InfluConnect — Login code"),
        body_text=(
            (
                f"Bonjour {user.first_name or user.username},\n\n"
                "Votre code de vérification pour vous connecter est :\n\n"
                f"{code}\n\n"
                "Ce code expire dans 10 minutes.\n"
                "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n"
            )
            if is_fr else
            (
                f"Hello {user.first_name or user.username},\n\n"
                "Your login verification code is:\n\n"
                f"{code}\n\n"
                "This code expires in 10 minutes.\n"
                "If you did not request this, ignore this email.\n"
            )
        ),
        body_html=email_service.build_transactional_email_html(
            title=("Code de connexion" if is_fr else "Login code"),
            greeting=(
                f"Bonjour {user.first_name or user.username},"
                if is_fr else
                f"Hello {user.first_name or user.username},"
            ),
            paragraphs=(
                [
                    "Votre code de vérification pour vous connecter est :",
                    code,
                    "Ce code expire dans 10 minutes.",
                ]
                if is_fr else
                [
                    "Your login verification code is:",
                    code,
                    "This code expires in 10 minutes.",
                ]
            ),
            footer_note=(
                "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email."
                if is_fr else
                "If you did not request this, ignore this email."
            ),
        ),
    )


def verify_user_email_login_code(user: User, code: str) -> bool:
    """Validate email OTP for login; successful verification invalidates the code."""
    if not user or not code:
        return False
    key = _email_otp_cache_key(user.id)
    expected = cache.get(key)
    if not expected:
        return False
    if str(code).strip() != str(expected).strip():
        return False
    cache.delete(key)
    return True


# ---------------------------------------------------------------------------
# Password change (authenticated)
# ---------------------------------------------------------------------------
class PasswordChangeView(APIView):
    """Authenticated user changes their own password using current password."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        current = request.data.get("current_password") or ""
        new_password = request.data.get("new_password") or ""
        if not current or not new_password:
            return Response(
                {"detail": "Current password and new password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.check_password(current):
            return Response(
                {"detail": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if current == new_password:
            return Response(
                {"detail": "New password must differ from the current one."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            return Response({"detail": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        # Bumping auth_version invalidates every JWT issued before the change
        # (see auth_jwt), so a stolen token dies with the old password.
        user.auth_version = (user.auth_version or 0) + 1
        user.save(update_fields=["password", "auth_version"])
        return Response({"detail": "Password updated."})


# ---------------------------------------------------------------------------
# TOTP reset (lost authenticator) — emailed link disables 2FA
# ---------------------------------------------------------------------------
class TOTPResetRequestView(APIView):
    """Send an email with a signed link allowing a user to disable their TOTP
    when they lost access to their authenticator. Always 200 to prevent
    account enumeration."""

    permission_classes = [AllowAny]
    throttle_classes = [MFAResetRateThrottle]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if email:
            try:
                user = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                user = None
            if user is not None and user.is_active and user.totp_enabled:
                token = _issue_one_time_token(
                    signer=_totp_reset_signer(),
                    cache_key=_totp_reset_cache_key(user.pk),
                    user_id=user.pk,
                    ttl=TOTP_RESET_MAX_AGE,
                )
                frontend = getattr(settings, "FRONTEND_URL", "https://influconnect.fr").rstrip("/")
                link = f"{frontend}/security/reset-mfa?token={token}"
                email_service.send_mfa_reset(
                    user.email,
                    link,
                    language=user.language_preference,
                )
        return Response({"detail": "If that email exists, a 2FA reset link has been sent."})


class TOTPResetConfirmView(APIView):
    """Disable TOTP from a signed reset token. The user must also confirm
    their account password to prevent abuse if the email is compromised."""

    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("token") or ""
        password = request.data.get("password") or ""
        if not token or not password:
            return Response(
                {"detail": "Token and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user_pk, cache_key = _consume_signed_token(
            token=token,
            signer=_totp_reset_signer(),
            cache_key_builder=_totp_reset_cache_key,
            max_age=TOTP_RESET_MAX_AGE,
        )
        if cache_key == "expired":
            return Response({"detail": "Reset link expired."}, status=status.HTTP_400_BAD_REQUEST)
        if cache_key == "invalid":
            return Response({"detail": "Invalid reset link."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(pk=user_pk)
        except User.DoesNotExist:
            return Response({"detail": "Invalid reset link."}, status=status.HTTP_400_BAD_REQUEST)
        if not user.check_password(password):
            return Response(
                {"detail": "Incorrect password."}, status=status.HTTP_400_BAD_REQUEST,
            )
        user.totp_enabled = False
        user.totp_secret = ""
        user.save(update_fields=["totp_enabled", "totp_secret"])
        cache.delete(cache_key)
        return Response({"detail": "Two-factor authentication has been reset.", "totp_enabled": False})


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------
class EmailVerificationRequestView(APIView):
    """(Re)send the verification link to the signed-in user."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        user = request.user
        if user.email_verified:
            return Response({"detail": "Email already verified.", "email_verified": True})
        send_verification_email(user)
        # The response never reveals whether delivery succeeded.
        return Response({"detail": "Verification email sent.", "email_verified": False})


class EmailVerificationConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("token") or ""
        if not token:
            return Response({"detail": "Token is required."}, status=status.HTTP_400_BAD_REQUEST)

        user_pk, cache_key = _consume_signed_token(
            token=token,
            signer=_email_verify_signer(),
            cache_key_builder=_email_verify_cache_key,
            max_age=EMAIL_VERIFY_MAX_AGE,
        )
        if user_pk is None:
            detail = (
                "This verification link has expired."
                if cache_key == "expired" else
                "This verification link is invalid or has already been used."
            )
            return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(pk=user_pk).first()
        if user is None:
            return Response({"detail": "This verification link is invalid."},
                            status=status.HTTP_400_BAD_REQUEST)

        if not user.email_verified:
            user.email_verified = True
            user.email_verified_at = timezone.now()
            user.save(update_fields=["email_verified", "email_verified_at"])
        # One-time: burn the nonce so the link cannot be replayed.
        cache.delete(cache_key)
        return Response({"detail": "Email verified.", "email_verified": True})


# ---------------------------------------------------------------------------
# Partner API docs — short-lived access code
# ---------------------------------------------------------------------------
PARTNER_DOCS_CODE_MAX_AGE = 60  # seconds


class PartnerDocsCodeView(APIView):
    """Mint a single-use, short-lived code so the Swagger UI can be opened.

    The docs page is a plain browser navigation, so it cannot carry the JWT
    Authorization header. This hands out a throwaway code (consumed by
    DocsCodeAuthentication) instead of ever putting a real token in a URL.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = secrets.token_urlsafe(32)
        cache.set(f"partner-docs:{code}", request.user.pk, timeout=PARTNER_DOCS_CODE_MAX_AGE)
        return Response({"code": code, "expires_in": PARTNER_DOCS_CODE_MAX_AGE})
