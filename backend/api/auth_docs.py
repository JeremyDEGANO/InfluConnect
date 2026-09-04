from django.core.cache import cache
from rest_framework.authentication import BaseAuthentication

from .models import User


class DocsCodeAuthentication(BaseAuthentication):
    """Short-lived, docs-only query code. It is not an API credential."""

    def authenticate(self, request):
        code = (request.query_params.get("code") or "").strip()
        if not code or len(code) > 96:
            return None
        user_id = cache.get(f"partner-docs:{code}")
        if not user_id:
            return None
        user = User.objects.filter(pk=user_id, is_active=True).first()
        return (user, code) if user else None
