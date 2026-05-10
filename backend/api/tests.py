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
    BrandMembership, AgencyDelegation, SupportTicket,
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

    def test_register_influencer_rejects_invalid_pseudo(self):
        c = APIClient()
        res = c.post("/api/auth/register/", {
            "email": "badpseudo@test.com", "username": "badpseudo", "password": "SuperSecret123!",
            "user_type": "influencer", "first_name": "Bad", "last_name": "Pseudo",
            "display_name": "bad&pseudo",
        }, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("display_name", res.data)

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

    def test_update_email_via_me(self):
        user = User.objects.create_user(
            email="old@test.com", username="oldemail", password="pw12345!", user_type="influencer",
        )
        c = APIClient()
        res = c.post("/api/auth/login/", {"username": "old@test.com", "password": "pw12345!"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        update = c.patch("/api/auth/me/", {"email": "new@test.com"}, format="json")
        self.assertEqual(update.status_code, 200, update.content)
        user.refresh_from_db()
        self.assertEqual(user.email, "new@test.com")

    def test_update_email_via_me_rejects_duplicate(self):
        user = User.objects.create_user(
            email="olddup@test.com", username="olddup", password="pw12345!", user_type="influencer",
        )
        User.objects.create_user(
            email="exists@test.com", username="existsdup", password="pw12345!", user_type="influencer",
        )
        c = APIClient()
        res = c.post("/api/auth/login/", {"username": "olddup@test.com", "password": "pw12345!"}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        update = c.patch("/api/auth/me/", {"email": "exists@test.com"}, format="json")
        self.assertEqual(update.status_code, 400)
        self.assertIn("email", update.data)


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


class InfluencerPseudoValidationTests(TestCase):
    def setUp(self):
        self.first_user = User.objects.create_user(
            email="first@t.com", username="firstuser", password="pw12345!", user_type="influencer",
        )
        self.first_profile = InfluencerProfile.objects.create(
            user=self.first_user, display_name="alpha.creator",
        )
        self.second_user = User.objects.create_user(
            email="second@t.com", username="reservedslug", password="pw12345!", user_type="influencer",
        )
        self.second_profile = InfluencerProfile.objects.create(
            user=self.second_user, display_name="legacy&pseudo",
        )

    def _as_user(self, email, password="pw12345!"):
        c = APIClient()
        r = c.post("/api/auth/login/", {"username": email, "password": password}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        return c

    def test_profile_update_rejects_duplicate_pseudo(self):
        c = self._as_user("second@t.com")
        res = c.patch("/api/influencers/profile/", {"display_name": "alpha.creator"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("display_name", res.data)

    def test_profile_update_rejects_pseudo_matching_other_username(self):
        c = self._as_user("first@t.com")
        res = c.patch("/api/influencers/profile/", {"display_name": "reservedslug"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("display_name", res.data)

    def test_profile_update_rejects_accent_insensitive_duplicate(self):
        self.first_profile.display_name = "jérémy"
        self.first_profile.save(update_fields=["display_name"])
        c = self._as_user("second@t.com")
        res = c.patch("/api/influencers/profile/", {"display_name": "jeremy"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("display_name", res.data)

    def test_profile_update_allows_unchanged_legacy_pseudo(self):
        c = self._as_user("second@t.com")
        res = c.patch("/api/influencers/profile/", {"display_name": "legacy&pseudo", "bio": "Updated"}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.second_profile.refresh_from_db()
        self.assertEqual(self.second_profile.bio, "Updated")

    def test_pseudo_availability_returns_suggestions(self):
        c = self._as_user("first@t.com")
        res = c.get("/api/influencers/pseudo-availability/?value=legacy%26pseudo")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertFalse(res.data["available"])
        self.assertGreaterEqual(len(res.data["suggestions"]), 1)


class BrandMembershipTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@brand.com", username="ownerbrand", password="pw12345!", user_type="brand",
        )
        self.brand = BrandProfile.objects.create(user=self.owner, company_name="Acme Team")

        self.admin_user = User.objects.create_user(
            email="admin@brand.com", username="adminbrand", password="pw12345!", user_type="brand",
        )
        self.member_user = User.objects.create_user(
            email="member@brand.com", username="memberbrand", password="pw12345!", user_type="brand",
        )
        BrandMembership.objects.create(
            brand=self.brand, user=self.admin_user, invited_email=self.admin_user.email,
            role="admin", status="active", invited_by=self.owner,
        )
        BrandMembership.objects.create(
            brand=self.brand, user=self.member_user, invited_email=self.member_user.email,
            role="member", status="active", invited_by=self.owner,
        )

    def _as(self, email, password="pw12345!"):
        c = APIClient()
        r = c.post("/api/auth/login/", {"username": email, "password": password}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        return c

    def test_owner_can_invite_member(self):
        c = self._as("owner@brand.com")
        res = c.post("/api/brands/memberships/", {"invited_email": "new@brand.com", "role": "member"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data["invited_email"], "new@brand.com")

    def test_admin_can_invite_member(self):
        c = self._as("admin@brand.com")
        res = c.post("/api/brands/memberships/", {"invited_email": "team2@brand.com", "role": "member"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)

    def test_member_cannot_invite(self):
        c = self._as("member@brand.com")
        res = c.post("/api/brands/memberships/", {"invited_email": "blocked@brand.com", "role": "member"}, format="json")
        self.assertEqual(res.status_code, 403)


class AgencyDelegationTests(TestCase):
    def setUp(self):
        self.agency_user = User.objects.create_user(
            email="agency@test.com", username="agency", password="pw12345!", user_type="brand",
        )
        self.agency_brand = BrandProfile.objects.create(
            user=self.agency_user, company_name="Agency Co", is_agency=True, agency_default_commission_percent=25,
        )

        self.influ_user = User.objects.create_user(
            email="influ@test.com", username="influencerx", password="pw12345!", user_type="influencer",
        )
        self.influ_profile = InfluencerProfile.objects.create(user=self.influ_user, display_name="Influ X")

    def _as(self, email, password="pw12345!"):
        c = APIClient()
        r = c.post("/api/auth/login/", {"username": email, "password": password}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        return c

    def test_agency_invite_then_influencer_accept(self):
        agency_client = self._as("agency@test.com")
        create = agency_client.post(
            "/api/agency/delegations/",
            {"influencer": "influencerx", "commission_percent": 18, "invitation_message": "Let us manage your deals."},
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.content)
        delegation_id = create.data["id"]

        influ_client = self._as("influ@test.com")
        action = influ_client.post(f"/api/agency/delegations/{delegation_id}/action/", {"action": "accept"}, format="json")
        self.assertEqual(action.status_code, 200, action.content)
        self.assertEqual(action.data["status"], "accepted")

        delegation = AgencyDelegation.objects.get(pk=delegation_id)
        self.assertEqual(delegation.status, "accepted")
        self.assertIsNotNone(delegation.accepted_at)

    def test_non_agency_cannot_create_delegation(self):
        non_agency_user = User.objects.create_user(
            email="brand2@test.com", username="brand2", password="pw12345!", user_type="brand",
        )
        BrandProfile.objects.create(user=non_agency_user, company_name="Regular Brand", is_agency=False)
        c = self._as("brand2@test.com")
        res = c.post("/api/agency/delegations/", {"influencer": "influencerx", "commission_percent": 12}, format="json")
        self.assertEqual(res.status_code, 403)


class SupportTicketTests(TestCase):
    def setUp(self):
        self.requester = User.objects.create_user(
            email="requester@test.com", username="requester", password="pw12345!", user_type="influencer",
        )
        InfluencerProfile.objects.create(user=self.requester, display_name="Requester")

        self.admin = User.objects.create_user(
            email="admin@test.com", username="admin", password="pw12345!", user_type="admin",
        )
        self.admin.is_staff = True
        self.admin.is_superuser = True
        self.admin.save(update_fields=["is_staff", "is_superuser"])

    def _as(self, email, password="pw12345!"):
        c = APIClient()
        r = c.post("/api/auth/login/", {"username": email, "password": password}, format="json")
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        return c

    def test_user_can_create_support_ticket(self):
        c = self._as("requester@test.com")
        res = c.post(
            "/api/support/tickets/",
            {"subject": "Paiement bloqué", "message": "Le statut ne bouge plus.", "priority": "high"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data["status"], "open")
        self.assertTrue(SupportTicket.objects.filter(requester=self.requester, subject="Paiement bloqué").exists())

    def test_admin_can_update_ticket_status(self):
        ticket = SupportTicket.objects.create(
            requester=self.requester,
            subject="Contrat", message="Besoin d'aide", priority="normal",
        )
        admin_client = self._as("admin@test.com")
        res = admin_client.patch(
            f"/api/admin/support/tickets/{ticket.id}/",
            {"status": "in_progress", "admin_note": "Pris en charge"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, "in_progress")
        self.assertEqual(ticket.admin_note, "Pris en charge")
