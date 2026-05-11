from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve
from django.http import HttpResponseForbidden


def _forbid_attachment_media_access(_request, path):
    return HttpResponseForbidden("Forbidden")

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
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
