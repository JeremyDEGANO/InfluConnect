"""
Two-factor authentication (TOTP) + password reset views.
"""
from __future__ import annotations

import base64
import io

import pyotp
import qrcode
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
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


def _signer() -> TimestampSigner:
    return TimestampSigner(salt="password-reset")


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
        user.save(update_fields=["totp_enabled"])
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
                frontend = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
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
