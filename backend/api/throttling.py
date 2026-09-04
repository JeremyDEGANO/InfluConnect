from __future__ import annotations

from rest_framework.throttling import SimpleRateThrottle


class IPRateThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        if not ident:
            return None
        return self.cache_format % {"scope": self.scope, "ident": ident}


class LoginRateThrottle(IPRateThrottle):
    scope = "auth_login"


class PasswordResetRateThrottle(IPRateThrottle):
    scope = "auth_password_reset"


class MFAResetRateThrottle(IPRateThrottle):
    scope = "auth_mfa_reset"


class RegisterRateThrottle(IPRateThrottle):
    scope = "auth_register"


class EventInvitePublicThrottle(IPRateThrottle):
    scope = "event_invite_public"


class AddressLookupThrottle(IPRateThrottle):
    """Typeahead fires often; this shields the free upstream geocoders."""
    scope = "address_lookup"
