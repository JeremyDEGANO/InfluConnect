"""DNS-based domain ownership verification (TXT record).

Brand uploads a domain, we generate a random `verification_token`, ask them to
publish a TXT record at `_influconnect-challenge.<domain>` with value
`influconnect-verification=<token>`. When they trigger verification we resolve
the TXT records and check for the expected value (constant-time compare).
"""
from __future__ import annotations

import secrets
from typing import Tuple

try:
    import dns.resolver  # type: ignore
    import dns.exception  # type: ignore
    _DNS_AVAILABLE = True
except Exception:  # pragma: no cover
    _DNS_AVAILABLE = False


CHALLENGE_PREFIX = "_influconnect-challenge"
TOKEN_VALUE_PREFIX = "influconnect-verification="


def generate_token() -> str:
    """Generate a URL-safe 32-byte random token (43 chars)."""
    return secrets.token_urlsafe(32)


def expected_record_name(domain: str) -> str:
    return f"{CHALLENGE_PREFIX}.{domain.strip().lower()}"


def expected_record_value(token: str) -> str:
    return f"{TOKEN_VALUE_PREFIX}{token}"


def verify_domain(domain: str, token: str) -> Tuple[bool, str]:
    """Return (ok, message). Performs a TXT lookup on the challenge name."""
    if not _DNS_AVAILABLE:
        return False, "DNS resolver not available on server."
    name = expected_record_name(domain)
    expected = expected_record_value(token)
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = 4
        resolver.lifetime = 8
        answers = resolver.resolve(name, "TXT")
    except dns.resolver.NXDOMAIN:
        return False, f"TXT record not found at {name}."
    except dns.resolver.NoAnswer:
        return False, f"No TXT record at {name}."
    except dns.exception.Timeout:
        return False, "DNS lookup timed out."
    except Exception as exc:  # pragma: no cover
        return False, f"DNS lookup failed: {exc}"

    found_values: list[str] = []
    for rdata in answers:
        for chunk in rdata.strings:
            try:
                found_values.append(chunk.decode("utf-8"))
            except Exception:
                continue
        # Some libs expose .to_text() with joined chunks
        try:
            joined = "".join(s.decode("utf-8") for s in rdata.strings)
            found_values.append(joined)
        except Exception:
            pass

    for v in found_values:
        if _constant_time_equals(v.strip().strip('"'), expected):
            return True, "Verified."
    return False, "Expected TXT value not found among published records."


def _constant_time_equals(a: str, b: str) -> bool:
    import hmac
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))
