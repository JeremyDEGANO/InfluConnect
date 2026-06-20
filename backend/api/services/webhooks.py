"""Webhook signing and dispatch.

Signature header format (Stripe-like):
  X-InfluConnect-Signature: t=<unix_ts>,v1=<hex hmac_sha256(secret, "{ts}.{body}")>

Customers verify by recomputing the HMAC over the raw body with the same
shared secret and constant-time comparing against `v1`. They should also
check that |now - ts| < 5 minutes to prevent replay attacks.
"""
from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import secrets
import socket
import time
from typing import Any
from urllib.parse import urlparse

import requests
from django.utils import timezone

from ..models import WebhookDelivery, WebhookEndpoint


SIGNATURE_HEADER = "X-InfluConnect-Signature"
EVENT_HEADER = "X-InfluConnect-Event"
DELIVERY_HEADER = "X-InfluConnect-Delivery"
USER_AGENT = "InfluConnect-Webhooks/1.0"
TIMEOUT_SEC = 6
MAX_ATTEMPTS = 6  # exponential backoff: 30s, 2min, 10min, 1h, 6h, 24h


def generate_secret() -> str:
    return "whsec_" + secrets.token_urlsafe(32)


def validate_webhook_url(url: str) -> str | None:
    """Anti-SSRF validation of a customer-supplied webhook URL.

    Returns an error message, or None when the URL is acceptable:
    HTTPS only, no credentials, public hostname (no loopback / private /
    link-local / reserved address — checked on every resolved IP).
    """
    try:
        parsed = urlparse(url)
    except ValueError:
        return "Invalid URL."
    if parsed.scheme != "https":
        return "Webhook URL must use HTTPS."
    if not parsed.hostname:
        return "Invalid URL."
    if parsed.username or parsed.password:
        return "Credentials in webhook URLs are not allowed."
    host = parsed.hostname
    if host.lower() in ("localhost",) or host.endswith(".local") or host.endswith(".internal"):
        return "Internal hostnames are not allowed."
    try:
        infos = socket.getaddrinfo(host, parsed.port or 443, proto=socket.IPPROTO_TCP)
    except OSError:
        return "Webhook host cannot be resolved."
    for info in infos:
        try:
            addr = ipaddress.ip_address(info[4][0])
        except ValueError:
            return "Webhook host cannot be resolved."
        if (addr.is_private or addr.is_loopback or addr.is_link_local
                or addr.is_reserved or addr.is_multicast or addr.is_unspecified):
            return "Webhook URL must point to a public address."
    return None


def sign(payload: bytes, secret: str, ts: int | None = None) -> str:
    ts = ts or int(time.time())
    mac = hmac.new(secret.encode("utf-8"), f"{ts}.".encode("utf-8") + payload, hashlib.sha256).hexdigest()
    return f"t={ts},v1={mac}"


def dispatch_event(*, brand, event: str, data: dict[str, Any]) -> int:
    """Enqueue and immediately attempt delivery to every matching endpoint.

    Returns the number of deliveries attempted.
    """
    # Deliveries stop as soon as the brand's plan no longer includes API &
    # webhooks (downgrade); endpoints are kept and resume after an upgrade.
    from .plans import has_feature
    if not has_feature(brand, "api_access"):
        return 0
    endpoints = WebhookEndpoint.objects.filter(brand=brand, enabled=True)
    count = 0
    for ep in endpoints:
        if ep.events and event not in ep.events:
            continue
        payload = {
            "id": "evt_" + secrets.token_urlsafe(12),
            "event": event,
            "created": int(time.time()),
            "data": data,
        }
        delivery = WebhookDelivery.objects.create(endpoint=ep, event=event, payload=payload, status="pending")
        _attempt(delivery)
        count += 1
    return count


def _attempt(delivery: WebhookDelivery) -> None:
    delivery.attempts += 1
    body = json.dumps(delivery.payload, separators=(",", ":")).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        EVENT_HEADER: delivery.event,
        DELIVERY_HEADER: str(delivery.id),
        SIGNATURE_HEADER: sign(body, delivery.endpoint.secret),
    }
    try:
        resp = requests.post(delivery.endpoint.url, data=body, headers=headers, timeout=TIMEOUT_SEC)
        delivery.response_status = resp.status_code
        delivery.response_body = (resp.text or "")[:2000]
        if 200 <= resp.status_code < 300:
            delivery.status = "success"
            delivery.delivered_at = timezone.now()
            delivery.endpoint.last_status = "success"
        else:
            _schedule_retry(delivery)
    except requests.RequestException as exc:
        delivery.error = str(exc)[:255]
        _schedule_retry(delivery)
    delivery.endpoint.last_delivery_at = timezone.now()
    delivery.endpoint.save(update_fields=["last_delivery_at", "last_status"])
    delivery.save()


def _schedule_retry(delivery: WebhookDelivery) -> None:
    if delivery.attempts >= MAX_ATTEMPTS:
        delivery.status = "failed"
        delivery.endpoint.last_status = "failed"
        return
    from datetime import timedelta
    backoff_minutes = [0.5, 2, 10, 60, 360, 1440][min(delivery.attempts - 1, 5)]
    delivery.status = "retry"
    delivery.next_retry_at = timezone.now() + timedelta(minutes=backoff_minutes)
    delivery.endpoint.last_status = "retry"
