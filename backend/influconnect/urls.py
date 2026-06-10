from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve
from django.http import HttpResponseForbidden
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from api.auth_docs import QueryParamJWTAuthentication
from api.permissions import IsBrandOrAgencyWorkspaceUser


def _forbid_attachment_media_access(_request, path):
    return HttpResponseForbidden("Forbidden")


class PartnerSchemaView(SpectacularAPIView):
    """OpenAPI schema exposing only the Partner API (brand/agency-scoped)."""
    authentication_classes = [QueryParamJWTAuthentication]
    permission_classes = [IsBrandOrAgencyWorkspaceUser]
    urlconf = 'influconnect.urls_partner_docs'


class PartnerDocsView(SpectacularSwaggerView):
    """Swagger UI for the Partner API — restricted to brand/agency workspace users."""
    authentication_classes = [QueryParamJWTAuthentication]
    permission_classes = [IsBrandOrAgencyWorkspaceUser]

    def _get_schema_url(self, request):
        schema_url = super()._get_schema_url(request)
        token = request.GET.get('token')
        if not token:
            return schema_url
        sep = '&' if '?' in schema_url else '?'
        return f"{schema_url}{sep}token={token}"

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    # Partner API docs — Swagger UI only. Restricted to authenticated brand/agency users.
    path('api/partner/schema/', PartnerSchemaView.as_view(), name='api-partner-schema'),
    path('api/partner/docs/', PartnerDocsView.as_view(url_name='api-partner-schema'), name='partner-docs'),
    # Message attachments are private and must be accessed through authenticated API routes.
    re_path(r'^media/attachments/(?P<path>.+)$', _forbid_attachment_media_access),
    # Proposal contracts are private and must be accessed through authenticated API routes.
    re_path(r'^media/contracts/(?P<path>.+)$', _forbid_attachment_media_access),
    # Submitted content files/screenshots are private and participant-scoped.
    re_path(r'^media/submissions/(?P<path>.+)$', _forbid_attachment_media_access),
    re_path(r'^media/screenshots/(?P<path>.+)$', _forbid_attachment_media_access),
    # Support ticket images are private (requester/admin only).
    re_path(r'^media/support/(?P<path>.+)$', _forbid_attachment_media_access),
    # Contract template source docs are private to owning brand team.
    re_path(r'^media/contract_templates/(?P<path>.+)$', _forbid_attachment_media_access),
    # Serve uploaded media files in all environments (including production).
    # For high-traffic sites, delegate this to a dedicated web server instead.
    re_path(r'^media/(?P<path>.+)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
