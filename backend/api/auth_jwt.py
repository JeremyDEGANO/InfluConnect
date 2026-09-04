from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


class VersionedJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        token_version = validated_token.get("auth_version")
        if token_version is None or int(token_version) != user.auth_version:
            raise AuthenticationFailed("Session has been revoked.", code="session_revoked")
        return user


class VersionedTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh = RefreshToken(attrs["refresh"])
        user = User.objects.filter(pk=refresh.get("user_id"), is_active=True).only("auth_version").first()
        if not user or refresh.get("auth_version") is None or int(refresh["auth_version"]) != user.auth_version:
            raise InvalidToken("Session has been revoked.")
        return super().validate(attrs)