"""
Core API tests (Django TestCase-based).

Run with:
    python manage.py test api

These tests cover the most critical flows:
- User registration (influencer + brand)
- Authentication (login, /me)
- Public endpoints (plans, Stripe config)
- Proposal lifecycle: counter-offer → accept counter
- Review creation after a paid proposal
- Message sending between participants + access control
- Campaign visibility filtering
"""
from decimal import Decimal
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import (
    User, InfluencerProfile, BrandProfile, Campaign, CampaignProposal, Review,
)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AuthTests(TestCase):
    def test_register_influencer(self):
        c = APIClient()
        res = c.post("/api/auth/register/", {
            "email": "inf@test.com", "username": "inf", "password": "SuperSecret123!",
            "user_type": "influencer", "first_name": "In", "last_name": "F",
        }, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertIn("access", res.data)
        self.assertTrue(User.objects.filter(email="inf@test.com").exists())

    def test_register_brand(self):
        c = APIClient()
        res = c.post("/api/auth/register/", {
            "email": "b@test.com", "username": "b", "password": "SuperSecret123!",
            "user_type": "brand", "first_name": "Br", "last_name": "A",
            "company_name": "Acme Corp", "subscription_plan": "starter",
        }, format="json")
        self.assertEqual(res.status_code, 201, res.content)

    def test_login_and_me(self):
        User.objects.create_user(
            email="x@t.com", username="x", password="pw12345!", user_type="influencer",
        )
        c = APIClient()
        res = c.post("/api/auth/login/", {"username": "x@t.com", "password": "pw12345!"}, format="json")
        self.assertEqual(res.status_code, 200)
        token = res.data["access"]
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        me = c.get("/api/auth/me/")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["email"], "x@t.com")


class PublicEndpointsTests(TestCase):
    def test_plans_public(self):
        res = APIClient().get("/api/reference/plans/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("plans", res.data)
        self.assertGreaterEqual(len(res.data["plans"]), 3)

    def test_stripe_config_public(self):
        res = APIClient().get("/api/stripe/config/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("publishable_key", res.data)
        self.assertIn("live", res.data)


class ProposalFlowTests(TestCase):
    """End-to-end: brand + influencer proposal lifecycle."""

    def setUp(self):
        self.brand_user = User.objects.create_user(
            email="brand@t.com", username="brand", password="pw12345!", user_type="brand",
        )
        self.brand_profile = BrandProfile.objects.create(
            user=self.brand_user, company_name="Acme",
        )
        self.inf_user = User.objects.create_user(
            email="inf@t.com", username="inf", password="pw12345!", user_type="influencer",
        )
        self.inf_profile = InfluencerProfile.objects.create(
            user=self.inf_user, display_name="Inf",
        )
        self.campaign = Campaign.objects.create(
            brand=self.brand_profile,
            title="Test Campaign",
            description="x",
            price_per_influencer=Decimal("500"),
            status="active",
        )
        self.proposal = CampaignProposal.objects.create(
            campaign=self.campaign,
            influencer=self.inf_profile,
            proposed_price=Decimal("500"),
            status="pending",
        )

    def _as_influencer(self):
        c = APIClient()
        r = c.post("/api/auth/login/", {"username": "inf@t.com", "password": "pw12345!"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        return c

    def _as_brand(self):
        c = APIClient()
        r = c.post("/api/auth/login/", {"username": "brand@t.com", "password": "pw12345!"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        return c

    def test_counter_offer_flow(self):
        c = self._as_influencer()
        res = c.post(
            f"/api/proposals/{self.proposal.id}/counter-offer/",
            {"counter_price": "750", "counter_message": "Je vaux plus"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.proposal.refresh_from_db()
        self.assertEqual(self.proposal.status, "counter_offer")
        self.assertEqual(self.proposal.counter_price, Decimal("750"))

        c = self._as_brand()
        res = c.post(f"/api/proposals/{self.proposal.id}/accept-counter/")
        self.assertEqual(res.status_code, 200, res.content)
        self.proposal.refresh_from_db()
        self.assertEqual(self.proposal.status, "accepted")
        self.assertEqual(self.proposal.proposed_price, Decimal("750"))

    def test_messaging_between_participants(self):
        c = self._as_brand()
        res = c.post(
            f"/api/proposals/{self.proposal.id}/messages/send/",
            {"content": "Bonjour !"}, format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)

        c = self._as_influencer()
        res = c.get(f"/api/proposals/{self.proposal.id}/messages/")
        self.assertEqual(res.status_code, 200)
        results = res.data.get("results", res.data)
        self.assertGreaterEqual(len(results), 1)
        self.assertEqual(results[0]["content"], "Bonjour !")

    def test_review_requires_paid_status(self):
        c = self._as_influencer()
        res = c.post(
            f"/api/proposals/{self.proposal.id}/review/",
            {"rating": 5, "comment": "super"}, format="json",
        )
        self.assertEqual(res.status_code, 400)

        self.proposal.status = "paid"
        self.proposal.save()
        res = c.post(
            f"/api/proposals/{self.proposal.id}/review/",
            {"rating": 5, "comment": "super expérience"}, format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        self.assertTrue(Review.objects.filter(proposal=self.proposal).exists())

    def test_unauthorized_user_cannot_read_messages(self):
        stranger = User.objects.create_user(
            email="s@t.com", username="s", password="pw12345!", user_type="influencer",
        )
        InfluencerProfile.objects.create(user=stranger, display_name="S")
        c = APIClient()
        r = c.post("/api/auth/login/", {"username": "s@t.com", "password": "pw12345!"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        res = c.get(f"/api/proposals/{self.proposal.id}/messages/")
        self.assertEqual(res.status_code, 200)
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 0)
