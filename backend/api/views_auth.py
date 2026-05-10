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
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .services import email_service


TOTP_ISSUER = "InfluConnect"
PASSWORD_RESET_MAX_AGE = 60 * 60  # 1 hour
TOTP_RESET_MAX_AGE = 60 * 60  # 1 hour
EMAIL_OTP_MAX_AGE = 10 * 60  # 10 minutes


def _signer() -> TimestampSigner:
    return TimestampSigner(salt="password-reset")


def _totp_reset_signer() -> TimestampSigner:
    return TimestampSigner(salt="totp-reset")


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

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if email:
            try:
                user = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                user = None
            if user is not None and user.is_active:
                token = _signer().sign(str(user.pk))
                frontend = getattr(settings, "FRONTEND_URL", "https://influconnect.fr").rstrip("/")
                link = f"{frontend}/reset-password/confirm?token={token}"
                email_service.send(
                    to=user.email,
                    subject="InfluConnect — Password reset",
                    body_text=(
                        f"Hello {user.first_name or user.username},\n\n"
                        f"A password reset was requested for your account. "
                        f"Click the link below within 1 hour to set a new password:\n\n"
                        f"{link}\n\n"
                        f"If you did not request this, you can ignore this email.\n"
                    ),
                    body_html=(
                        f"<p>Hello {user.first_name or user.username},</p>"
                        f"<p>A password reset was requested for your account. "
                        f"Click the link below within 1 hour to set a new password:</p>"
                        f"<p><a href=\"{link}\">Reset my password</a></p>"
                        f"<p>If you did not request this, you can ignore this email.</p>"
                    ),
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
        try:
            user_pk = _signer().unsign(token, max_age=PASSWORD_RESET_MAX_AGE)
        except SignatureExpired:
            return Response({"detail": "Reset link expired."}, status=status.HTTP_400_BAD_REQUEST)
        except BadSignature:
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

    email_service.send(
        to=user.email,
        subject="InfluConnect — Code de connexion",
        body_text=(
            f"Bonjour {user.first_name or user.username},\n\n"
            "Votre code de verification pour vous connecter est :\n\n"
            f"{code}\n\n"
            "Ce code expire dans 10 minutes.\n"
            "Si vous n'etes pas a l'origine de cette demande, ignorez cet email.\n"
        ),
        body_html=(
            f"<p>Bonjour {user.first_name or user.username},</p>"
            "<p>Votre code de verification pour vous connecter est :</p>"
            f"<p><strong style=\"font-size:22px;letter-spacing:4px\">{code}</strong></p>"
            "<p>Ce code expire dans 10 minutes.</p>"
            "<p>Si vous n'etes pas a l'origine de cette demande, ignorez cet email.</p>"
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
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated."})


# ---------------------------------------------------------------------------
# TOTP reset (lost authenticator) — emailed link disables 2FA
# ---------------------------------------------------------------------------
class TOTPResetRequestView(APIView):
    """Send an email with a signed link allowing a user to disable their TOTP
    when they lost access to their authenticator. Always 200 to prevent
    account enumeration."""

    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if email:
            try:
                user = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                user = None
            if user is not None and user.is_active and user.totp_enabled:
                token = _totp_reset_signer().sign(str(user.pk))
                frontend = getattr(settings, "FRONTEND_URL", "https://influconnect.fr").rstrip("/")
                link = f"{frontend}/security/reset-mfa?token={token}"
                email_service.send(
                    to=user.email,
                    subject="InfluConnect — Réinitialisation 2FA / MFA reset",
                    body_text=(
                        f"Bonjour {user.first_name or user.username},\n\n"
                        f"Une demande de réinitialisation de l'authentification à deux facteurs "
                        f"a été reçue pour votre compte. Cliquez sur le lien ci-dessous dans "
                        f"l'heure pour désactiver la 2FA et reconfigurer un nouvel "
                        f"authentificateur :\n\n{link}\n\n"
                        f"Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n"
                    ),
                    body_html=(
                        f"<p>Bonjour {user.first_name or user.username},</p>"
                        f"<p>Une demande de réinitialisation de l'authentification à deux "
                        f"facteurs a été reçue pour votre compte. Cliquez sur le lien "
                        f"ci-dessous dans l'heure pour désactiver la 2FA et reconfigurer "
                        f"un nouvel authentificateur :</p>"
                        f"<p><a href=\"{link}\">Réinitialiser ma 2FA</a></p>"
                        f"<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>"
                    ),
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
        try:
            user_pk = _totp_reset_signer().unsign(token, max_age=TOTP_RESET_MAX_AGE)
        except SignatureExpired:
            return Response({"detail": "Reset link expired."}, status=status.HTTP_400_BAD_REQUEST)
        except BadSignature:
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
        return Response({"detail": "Two-factor authentication has been reset.", "totp_enabled": False})
