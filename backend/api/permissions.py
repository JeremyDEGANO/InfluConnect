from rest_framework.permissions import BasePermission

from .workspace import get_user_brand_workspaces


class IsBrandOrAgencyWorkspaceUser(BasePermission):
    """Allow only authenticated users attached to a brand/agency workspace."""

    message = "Brand or agency authentication is required."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return get_user_brand_workspaces(user).exists()
