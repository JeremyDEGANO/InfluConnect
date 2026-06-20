"""Subscription plan configuration + feature entitlement tests."""
from rest_framework.test import APITestCase

from .models import BrandProfile, SubscriptionPlanConfig, User


def _brand(username: str, plan: str | None, **kwargs) -> tuple[User, BrandProfile]:
    user = User.objects.create_user(
        username=username, email=f"{username}@example.com", password="pass1234",
        user_type="brand",
    )
    profile = BrandProfile.objects.create(
        user=user, company_name=username.title(), subscription_plan=plan,
        validation_status="approved", **kwargs,
    )
    return user, profile


class SubscriptionChangeTests(APITestCase):
    def setUp(self):
        self.user, self.profile = _brand("brand1", "starter")
        self.client.force_authenticate(self.user)

    def test_change_each_plan(self):
        for plan in ("growth", "pro", "starter"):
            r = self.client.post("/api/brands/subscription/change/", {"plan": plan}, format="json")
            self.assertEqual(r.status_code, 200, r.content)
            self.assertEqual(r.data["subscription_plan"], plan)

    def test_change_accepts_legacy_plan_code_key(self):
        r = self.client.post("/api/brands/subscription/change/", {"plan_code": "growth"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)


class AdminPlanConfigTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin", email="admin@example.com", password="pass1234",
            user_type="admin", is_staff=True,
        )
        self.client.force_authenticate(self.admin)

    def test_list_plans_returns_defs_and_defaults(self):
        r = self.client.get("/api/admin/plans/")
        self.assertEqual(r.status_code, 200)
        codes = [p["code"] for p in r.data["plans"]]
        self.assertEqual(codes, ["starter", "growth", "pro"])
        self.assertTrue(any(d["key"] == "events" for d in r.data["feature_defs"]))

    def test_patch_overrides_price_and_features(self):
        r = self.client.patch("/api/admin/plans/starter/", {
            "price_eur_monthly": "99.50",
            "features": {"events": True, "concurrent_campaigns": 5},
        }, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["price_eur_monthly"], 99.5)
        self.assertTrue(r.data["features"]["events"])
        self.assertEqual(r.data["features"]["concurrent_campaigns"], 5)
        # Public endpoint reflects the overrides
        public = self.client.get("/api/reference/plans/")
        starter = next(p for p in public.data["plans"] if p["code"] == "starter")
        self.assertEqual(starter["price_eur"], 99.5)
        self.assertTrue(starter["features"]["events"])

    def test_patch_rejects_unknown_feature_and_bad_price(self):
        r = self.client.patch("/api/admin/plans/pro/", {"features": {"nope": True}}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.patch("/api/admin/plans/pro/", {"price_eur_monthly": "abc"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_non_admin_forbidden(self):
        user, _ = _brand("brandx", "pro")
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get("/api/admin/plans/").status_code, 403)

    def test_admin_brand_update_plan_and_price_override(self):
        _, profile = _brand("brandy", "starter")
        r = self.client.patch(f"/api/admin/brands/{profile.id}/", {
            "subscription_plan": "pro",
            "subscription_price_override": "123.45",
        }, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        profile.refresh_from_db()
        self.assertEqual(profile.subscription_plan, "pro")
        self.assertEqual(str(profile.subscription_price_override), "123.45")
        # Clearing the override
        r = self.client.patch(f"/api/admin/brands/{profile.id}/", {"subscription_price_override": ""}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        profile.refresh_from_db()
        self.assertIsNone(profile.subscription_price_override)


class FeatureEnforcementTests(APITestCase):
    def test_starter_cannot_create_event(self):
        user, _ = _brand("starterbrand", "starter")
        self.client.force_authenticate(user)
        r = self.client.post("/api/events/", {
            "title": "Launch", "description": "x", "address": "1 rue", "city": "Paris",
            "starts_at": "2030-01-01T10:00:00Z",
        }, format="json")
        self.assertEqual(r.status_code, 403, r.content)

    def test_growth_can_create_event(self):
        user, _ = _brand("growthbrand", "growth")
        self.client.force_authenticate(user)
        r = self.client.post("/api/events/", {
            "title": "Launch", "description": "x", "address": "1 rue", "city": "Paris",
            "starts_at": "2030-01-01T10:00:00Z",
        }, format="json")
        self.assertIn(r.status_code, (200, 201), r.content)

    def test_admin_override_unlocks_feature(self):
        SubscriptionPlanConfig.objects.create(code="starter", features={"events": True})
        user, _ = _brand("starterplus", "starter")
        self.client.force_authenticate(user)
        r = self.client.post("/api/events/", {
            "title": "Launch", "description": "x", "address": "1 rue", "city": "Paris",
            "starts_at": "2030-01-01T10:00:00Z",
        }, format="json")
        self.assertIn(r.status_code, (200, 201), r.content)

    def test_starter_campaign_quota(self):
        user, _ = _brand("quotabrand", "starter")
        self.client.force_authenticate(user)
        payload = {"title": "C", "description": "d", "campaign_type": "paid", "budget": "100"}
        for i in range(3):
            r = self.client.post("/api/campaigns/", {**payload, "title": f"C{i}"}, format="json")
            self.assertIn(r.status_code, (200, 201), r.content)
        r = self.client.post("/api/campaigns/", {**payload, "title": "C4"}, format="json")
        self.assertEqual(r.status_code, 403, r.content)

    def test_starter_cannot_create_api_key(self):
        user, _ = _brand("apikeybrand", "starter")
        self.client.force_authenticate(user)
        r = self.client.post("/api/v1/brand/api-keys/", {"name": "k", "scopes": []}, format="json")
        self.assertEqual(r.status_code, 403, r.content)

    def test_pro_can_create_api_key(self):
        user, _ = _brand("prokeybrand", "pro")
        self.client.force_authenticate(user)
        r = self.client.post("/api/v1/brand/api-keys/", {"name": "k", "scopes": []}, format="json")
        self.assertEqual(r.status_code, 201, r.content)

    def test_me_payload_exposes_plan_features(self):
        user, _ = _brand("mebrand", "growth")
        self.client.force_authenticate(user)
        r = self.client.get("/api/auth/me/")
        self.assertEqual(r.status_code, 200)
        features = (r.data.get("active_brand") or {}).get("plan_features") or {}
        self.assertTrue(features.get("events"))
        self.assertFalse(features.get("api_access"))


class MonthlyContactsLimitTests(APITestCase):
    def _influencer(self, username: str):
        from .models import InfluencerProfile
        user = User.objects.create_user(
            username=username, email=f"{username}@example.com", password="pass1234",
            user_type="influencer",
        )
        return InfluencerProfile.objects.create(user=user, display_name=username)

    def test_marketplace_contact_blocked_when_quota_reached(self):
        SubscriptionPlanConfig.objects.create(
            code="starter", features={"monthly_influencer_contacts": 1},
        )
        user, _ = _brand("contactquota", "starter")
        self.client.force_authenticate(user)
        inf1 = self._influencer("inf1")
        inf2 = self._influencer("inf2")

        r = self.client.post("/api/marketplace/contact/", {
            "influencer_id": inf1.id, "message": "Bonjour, collaborons ensemble !",
        }, format="json")
        self.assertIn(r.status_code, (200, 201), r.content)

        r = self.client.post("/api/marketplace/contact/", {
            "influencer_id": inf2.id, "message": "Bonjour, collaborons ensemble !",
        }, format="json")
        self.assertEqual(r.status_code, 403, r.content)
        self.assertIn("Limite mensuelle", str(r.data.get("detail", "")))

    def test_send_proposals_blocked_when_batch_exceeds_quota(self):
        from .models import Campaign
        SubscriptionPlanConfig.objects.create(
            code="starter", features={"monthly_influencer_contacts": 1},
        )
        user, profile = _brand("proposalquota", "starter")
        self.client.force_authenticate(user)
        campaign = Campaign.objects.create(
            brand=profile, title="C", description="d", campaign_type="paid", status="active",
        )
        ids = [self._influencer(f"propinf{i}").id for i in range(2)]
        r = self.client.post(f"/api/campaigns/{campaign.id}/send-proposals/", {
            "influencer_ids": ids, "proposed_price": 100,
        }, format="json")
        self.assertEqual(r.status_code, 403, r.content)


class DowngradeRevokesEntitlementsTests(APITestCase):
    """A plan downgrade must cut access at runtime, not only at creation."""

    def test_api_key_stops_working_after_downgrade(self):
        from .services import api_keys as api_keys_service
        _, profile = _brand("downgradekeys", "pro")
        issued = api_keys_service.generate(brand=profile, name="k", scopes=["campaigns:read"])
        auth = {"HTTP_AUTHORIZATION": f"Bearer {issued.full_key}"}

        r = self.client.get("/api/v1/campaigns/", **auth)
        self.assertEqual(r.status_code, 200, r.content)

        profile.subscription_plan = "starter"
        profile.save(update_fields=["subscription_plan"])
        r = self.client.get("/api/v1/campaigns/", **auth)
        self.assertEqual(r.status_code, 401, r.content)

        profile.subscription_plan = "pro"
        profile.save(update_fields=["subscription_plan"])
        r = self.client.get("/api/v1/campaigns/", **auth)
        self.assertEqual(r.status_code, 200, r.content)

    def test_webhook_dispatch_skipped_after_downgrade(self):
        from .models import WebhookEndpoint
        from .services import webhooks as webhooks_service
        _, profile = _brand("downgradehooks", "pro")
        WebhookEndpoint.objects.create(
            brand=profile, url="https://example.com/hook",
            secret="whsec_test", events=[], enabled=True,
        )
        profile.subscription_plan = "starter"
        profile.save(update_fields=["subscription_plan"])
        count = webhooks_service.dispatch_event(
            brand=profile, event="webhook.test", data={"ping": True},
        )
        self.assertEqual(count, 0)

    def test_sso_resolution_skipped_after_downgrade(self):
        from .models import BrandDomain, BrandSSOConfig
        from .services import sso_office365
        _, profile = _brand("downgradesso", "pro")
        BrandDomain.objects.create(
            brand=profile, domain="acme.test", verification_token="tok", status="verified",
        )
        BrandSSOConfig.objects.create(brand=profile, enabled=True)
        self.assertIsNotNone(sso_office365.resolve_sso_config_by_email("user@acme.test"))

        profile.subscription_plan = "starter"
        profile.save(update_fields=["subscription_plan"])
        self.assertIsNone(sso_office365.resolve_sso_config_by_email("user@acme.test"))
