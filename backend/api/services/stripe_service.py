"""
Stripe service — STUB implementation.

This module exposes a clean interface for everything the platform needs from
Stripe (subscriptions, escrow / Stripe Connect, payouts). When real Stripe
keys are configured via the STRIPE_SECRET_KEY env variable the calls should
be replaced by `import stripe; stripe.api_key = settings.STRIPE_SECRET_KEY`
and the body of each function should call the corresponding Stripe SDK
method. For now every function returns a deterministic fake identifier so
that the rest of the platform can run end-to-end without a Stripe account.

DO NOT log secrets here. Never store raw card data — Stripe Elements only.
"""
from __future__ import annotations

import secrets
import logging
from decimal import Decimal
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)


def is_live() -> bool:
    """Return True if real Stripe keys are configured."""
    key = getattr(settings, "STRIPE_SECRET_KEY", "") or ""
    return bool(key) and not key.startswith("stub_")


def _fake_id(prefix: str) -> str:
    return f"{prefix}_stub_{secrets.token_hex(8)}"


# ---------------------------------------------------------------------------
# Customer & Subscription (Brand side)
# ---------------------------------------------------------------------------
def create_customer(email: str, name: str) -> str:
    """Create a Stripe customer for a brand. Returns the Stripe customer id."""
    if is_live():
        # import stripe ; stripe.api_key = settings.STRIPE_SECRET_KEY
        # cust = stripe.Customer.create(email=email, name=name)
        # return cust.id
        raise NotImplementedError("Live Stripe integration not yet wired")
    return _fake_id("cus")


def create_subscription(customer_id: str, price_id: str) -> dict:
    """
    Create a recurring subscription for a brand.
    Returns dict { id, status, current_period_end (iso), latest_invoice_id }.
    """
    if is_live():
        raise NotImplementedError("Live Stripe integration not yet wired")
    from django.utils import timezone
    from datetime import timedelta
    return {
        "id": _fake_id("sub"),
        "status": "active",
        "current_period_end": (timezone.now() + timedelta(days=30)).isoformat(),
        "latest_invoice_id": _fake_id("in"),
    }


def cancel_subscription(subscription_id: str) -> bool:
    if is_live():
        raise NotImplementedError("Live Stripe integration not yet wired")
    return True


def change_subscription_plan(subscription_id: str, new_price_id: str) -> dict:
    if is_live():
        raise NotImplementedError("Live Stripe integration not yet wired")
    return {"id": subscription_id, "status": "active", "new_price_id": new_price_id}


# ---------------------------------------------------------------------------
# Escrow (Stripe Connect destination charges)
# ---------------------------------------------------------------------------
def create_escrow_payment_intent(
    *, customer_id: str, amount_eur: Decimal, proposal_id: int, metadata: Optional[dict] = None
) -> dict:
    """
    Create a PaymentIntent that captures funds from the brand and holds them
    on the platform Stripe account (escrow). Funds will be transferred to the
    influencer connected account on release.
    Returns { id, client_secret, status }.
    """
    if is_live():
        raise NotImplementedError("Live Stripe integration not yet wired")
    return {
        "id": _fake_id("pi"),
        "client_secret": _fake_id("pi") + "_secret",
        "status": "requires_confirmation",
        "amount_eur": str(amount_eur),
        "metadata": {"proposal_id": str(proposal_id), **(metadata or {})},
    }


def confirm_escrow_payment(payment_intent_id: str) -> dict:
    """Mark an escrow PI as funded (in real Stripe this is done client-side)."""
    if is_live():
        raise NotImplementedError("Live Stripe integration not yet wired")
    return {"id": payment_intent_id, "status": "succeeded"}


def release_escrow_to_influencer(
    *,
    payment_intent_id: str,
    influencer_account_id: Optional[str],
    amount_eur: Decimal,
    commission_rate: Decimal,
) -> dict:
    """
    Release escrowed funds: deduct platform commission, transfer remainder
    to the influencer's connected account.
    Returns { transfer_id, net_amount_eur, commission_eur }.
    """
    commission = (amount_eur * commission_rate / Decimal(100)).quantize(Decimal("0.01"))
    net = (amount_eur - commission).quantize(Decimal("0.01"))
    if is_live():
        raise NotImplementedError("Live Stripe integration not yet wired")
    return {
        "transfer_id": _fake_id("tr"),
        "payment_intent_id": payment_intent_id,
        "net_amount_eur": str(net),
        "commission_eur": str(commission),
        "destination": influencer_account_id or "no_connected_account",
    }


def refund_escrow(payment_intent_id: str) -> dict:
    if is_live():
        raise NotImplementedError("Live Stripe integration not yet wired")
    return {"refund_id": _fake_id("re"), "payment_intent_id": payment_intent_id, "status": "succeeded"}


# ---------------------------------------------------------------------------
# Influencer Connected Accounts (Stripe Connect Express)
# ---------------------------------------------------------------------------
def create_connected_account(email: str, country: str = "FR") -> dict:
    if is_live():
        raise NotImplementedError("Live Stripe integration not yet wired")
    return {
        "id": _fake_id("acct"),
        "onboarding_url": "https://stripe.com/connect/onboarding/stub",
    }
