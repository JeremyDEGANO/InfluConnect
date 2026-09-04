"""Subscription plan configuration + feature entitlement tests."""
import io

from rest_framework.test import APITestCase

from .models import BrandProfile, SubscriptionPlanConfig, User


def _brand(username: str, plan: str | None, **kwargs) -> tuple[User, BrandProfile]:
    user = User.objects.create_user(
        username=username, email=f"{username}@example.com", password="pass1234",
        user_type="brand",
    )
    subscription_active = kwargs.pop("subscription_active", True)
    profile = BrandProfile.objects.create(
        user=user, company_name=username.title(), subscription_plan=plan,
        subscription_active=subscription_active, validation_status="approved", **kwargs,
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

    def test_admin_can_toggle_platform_features(self):
        r = self.client.patch("/api/admin/settings/", {
            "ambassador_programs_enabled": False,
            "events_enabled": False,
            "referral_program_enabled": False,
        }, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertFalse(r.data["ambassador_programs_enabled"])
        self.assertFalse(r.data["events_enabled"])
        self.assertFalse(r.data["referral_program_enabled"])

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
    def test_inactive_pro_has_no_entitlements(self):
        user, _ = _brand("inactivepro", "pro", subscription_active=False)
        self.client.force_authenticate(user)
        r = self.client.post("/api/v1/brand/api-keys/", {"name": "k", "scopes": []}, format="json")
        self.assertEqual(r.status_code, 403, r.content)

    def test_global_event_toggle_overrides_plan(self):
        from .models import PlatformSettings

        settings = PlatformSettings.get_instance()
        settings.events_enabled = False
        settings.save(update_fields=["events_enabled"])
        user, _ = _brand("eventdisabled", "growth")
        self.client.force_authenticate(user)
        r = self.client.post("/api/events/", {
            "title": "Launch", "description": "x", "address": "1 rue", "city": "Paris",
            "starts_at": "2030-01-01T10:00:00Z",
        }, format="json")
        self.assertEqual(r.status_code, 403, r.content)

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


class FreeUntilContractTests(APITestCase):
    """Discovery is free: the paywall is contracting, not campaigning."""

    def _influencer(self, username: str):
        from .models import InfluencerProfile
        user = User.objects.create_user(
            username=username, email=f"{username}@example.com", password="pass1234",
            user_type="influencer",
        )
        return InfluencerProfile.objects.create(user=user, display_name=username)

    def test_brand_without_subscription_can_create_campaign(self):
        user, _ = _brand("freecampaign", "starter", subscription_active=False)
        self.client.force_authenticate(user)
        r = self.client.post("/api/campaigns/", {
            "title": "C", "description": "d", "campaign_type": "paid", "status": "active",
        }, format="json")
        self.assertIn(r.status_code, (200, 201), r.content)

    def test_brand_without_subscription_can_contact_influencer(self):
        user, _ = _brand("freecontact", "starter", subscription_active=False)
        self.client.force_authenticate(user)
        inf = self._influencer("freeinf")
        r = self.client.post("/api/marketplace/contact/", {
            "influencer_id": inf.id, "message": "Bonjour, collaborons ensemble !",
        }, format="json")
        self.assertIn(r.status_code, (200, 201), r.content)

    def test_brand_without_subscription_can_send_proposals(self):
        from .models import Campaign
        user, profile = _brand("freeproposal", "starter", subscription_active=False)
        self.client.force_authenticate(user)
        campaign = Campaign.objects.create(
            brand=profile, title="C", description="d", campaign_type="paid", status="active",
        )
        ids = [self._influencer(f"freepropinf{i}").id for i in range(3)]
        r = self.client.post(f"/api/campaigns/{campaign.id}/send-proposals/", {
            "influencer_ids": ids, "proposed_price": 100,
        }, format="json")
        self.assertIn(r.status_code, (200, 201), r.content)

    def test_contract_generation_requires_subscription(self):
        from .models import Campaign, CampaignProposal
        user, profile = _brand("paywall", "starter", subscription_active=False)
        self.client.force_authenticate(user)
        campaign = Campaign.objects.create(
            brand=profile, title="C", description="d", campaign_type="paid", status="active",
        )
        proposal = CampaignProposal.objects.create(
            campaign=campaign, influencer=self._influencer("paywallinf"),
            status="accepted", proposed_price=100,
        )
        r = self.client.post(f"/api/proposals/{proposal.id}/generate-contract/", {}, format="json")
        self.assertEqual(r.status_code, 402, r.content)


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


class AdminHistoryTests(APITestCase):
    """The cockpit charts must plot measured facts, not estimates."""

    def _admin(self):
        return User.objects.create_user(
            username="histadmin", email="histadmin@example.com", password="pass1234",
            user_type="brand", is_staff=True, is_superuser=True,
        )

    def test_history_buckets_revenue_into_the_month_it_was_released(self):
        from datetime import timedelta
        from decimal import Decimal

        from django.utils import timezone

        from .models import Campaign, CampaignProposal, InfluencerProfile, PlatformSettings

        settings_row = PlatformSettings.get_instance()
        settings_row.commission_rate = 15
        settings_row.save(update_fields=["commission_rate"])

        _, profile = _brand("histbrand", "growth")
        influencer_user = User.objects.create_user(
            username="histinf", email="histinf@example.com", password="pass1234",
            user_type="influencer",
        )
        influencer = InfluencerProfile.objects.create(user=influencer_user, display_name="histinf")
        campaign = Campaign.objects.create(
            brand=profile, title="C", description="d", campaign_type="paid", status="active",
        )
        proposal = CampaignProposal.objects.create(
            campaign=campaign, influencer=influencer, status="paid", proposed_price=1000,
            escrow_amount=Decimal("1000"), escrow_funded=True, escrow_released=True,
        )

        last_month = timezone.now().replace(day=1) - timedelta(days=2)
        CampaignProposal.objects.filter(pk=proposal.pk).update(
            escrow_funded_at=last_month, escrow_released_at=last_month, created_at=last_month,
        )

        self.client.force_authenticate(self._admin())
        r = self.client.get("/api/admin/history/?months=3")
        self.assertEqual(r.status_code, 200, r.content)

        points = r.data["points"]
        self.assertEqual(len(points), 3)
        self.assertTrue(points[-1]["is_current_month"])
        # Oldest first, and the released escrow lands in last month, not this one.
        previous = points[-2]
        self.assertEqual(previous["gmv_eur"], 1000.0)
        self.assertEqual(previous["commission_eur"], 150.0)
        self.assertEqual(previous["active_influencers"], 1)
        self.assertEqual(points[-1]["commission_eur"], 0.0)

    def test_history_rejects_arbitrary_ranges(self):
        self.client.force_authenticate(self._admin())
        for months, expected in ((3, 3), (6, 6), (12, 12), (99, 6), (0, 6)):
            r = self.client.get(f"/api/admin/history/?months={months}")
            self.assertEqual(r.status_code, 200, r.content)
            self.assertEqual(r.data["months"], expected)
            self.assertEqual(len(r.data["points"]), expected)

    def test_history_requires_staff(self):
        user, _ = _brand("histnonadmin", "starter")
        self.client.force_authenticate(user)
        r = self.client.get("/api/admin/history/")
        self.assertEqual(r.status_code, 403, r.content)


class SchedulerTests(APITestCase):
    """The recurring jobs must actually be scheduled, not just runnable by hand."""

    def test_job_fires_once_per_day_at_its_hour(self):
        from datetime import timedelta

        from django.utils import timezone

        from .management.commands.run_scheduler import Job

        job = Job(name="t", every=timedelta(days=1), at_hour=4, run=lambda: None)
        at_four = timezone.localtime().replace(hour=4, minute=0, second=0, microsecond=0)

        self.assertTrue(job.is_due(at_four))
        job.last_run = at_four
        # Same window, already ran.
        self.assertFalse(job.is_due(at_four + timedelta(minutes=10)))
        # Wrong hour the next day.
        self.assertFalse(job.is_due((at_four + timedelta(days=1)).replace(hour=5)))
        # Next day, right hour.
        self.assertTrue(job.is_due(at_four + timedelta(days=1)))

    def test_a_failing_job_does_not_stop_the_loop(self):
        from datetime import timedelta

        from django.core.management.base import OutputWrapper
        from django.utils import timezone

        from .management.commands.run_scheduler import Command, Job

        command = Command()
        command.stdout = OutputWrapper(io.StringIO())
        command.stderr = OutputWrapper(io.StringIO())

        def _boom():
            raise RuntimeError("provider down")

        job = Job(name="boom", every=timedelta(days=1), run=_boom)
        before = timezone.localtime()
        # Must swallow the exception...
        command._run(job)
        # ...and still mark the attempt, so a broken job cannot spin the loop.
        self.assertIsNotNone(job.last_run)
        self.assertGreaterEqual(job.last_run, before)

    def test_run_scheduler_once_executes_and_exits(self):
        from django.core.management import call_command

        out = io.StringIO()
        call_command("run_scheduler", "--once", stdout=out)
        output = out.getvalue()
        self.assertIn("refresh_social_stats", output)
        self.assertIn("refresh_campaign_videos", output)
        self.assertIn("all jobs ran once", output)


class MarketplaceVisibilityTests(APITestCase):
    """A near-complete profile must be reachable by brands."""

    def _influencer(self, username: str):
        from .models import InfluencerProfile, SocialNetwork

        user = User.objects.create_user(
            username=username, email=f"{username}@example.com", password="pass1234",
            user_type="influencer", location="Paris", email_verified=True,
        )
        profile = InfluencerProfile.objects.create(
            user=user, display_name=username,
            bio="Creatrice lifestyle et beaute basee a Paris.",
            languages=["fr"], content_themes=["beaute"], content_types_offered=["reel"],
            pricing={"reel": 300},
            collaboration_pitch="Je collabore avec des marques engagees et durables.",
            payment_method="stripe", payment_details={"iban": "x"},
            is_verified=True,
        )
        SocialNetwork.objects.create(influencer=profile, platform="tiktok", followers_count=25000)
        return profile

    def test_profile_without_avatar_is_still_listed(self):
        from .services.completion import compute_influencer_completion

        user, _ = _brand("mktbrand", "growth")
        profile = self._influencer("visibleinf")
        # Deliberately short of 100%: no avatar, no media-kit image.
        completion = compute_influencer_completion(profile)
        self.assertLess(completion, 100)
        self.assertGreaterEqual(completion, 80)

        self.client.force_authenticate(user)
        r = self.client.get("/api/influencers/")
        self.assertEqual(r.status_code, 200, r.content)
        results = r.data.get("results", r.data)
        self.assertEqual(len(results), 1, results)

    def test_unverified_email_keeps_the_profile_hidden(self):
        user, _ = _brand("mktbrand3", "growth")
        profile = self._influencer("unverifiedinf")
        profile.user.email_verified = False
        profile.user.save(update_fields=["email_verified"])

        self.client.force_authenticate(user)
        r = self.client.get("/api/influencers/")
        results = r.data.get("results", r.data)
        self.assertEqual(len(results), 0, results)

    def test_clearly_incomplete_profile_stays_hidden(self):
        from .models import InfluencerProfile

        user, _ = _brand("mktbrand2", "growth")
        bare_user = User.objects.create_user(
            username="bareinf", email="bareinf@example.com", password="pass1234",
            user_type="influencer",
        )
        InfluencerProfile.objects.create(user=bare_user, display_name="bareinf")

        self.client.force_authenticate(user)
        r = self.client.get("/api/influencers/")
        results = r.data.get("results", r.data)
        self.assertEqual(len(results), 0, results)


class BrandProfileValidationTests(APITestCase):
    """Onboarding must collect a usable postal address, and say so clearly."""

    def _brand_user(self):
        from .models import BrandProfile

        user = User.objects.create_user(
            username="bpv", email="bpv@example.com", password="pass1234", user_type="brand",
        )
        BrandProfile.objects.create(user=user, company_name="", validation_status="pending")
        return user

    def test_invalid_siret_and_postal_code_are_rejected(self):
        self.client.force_authenticate(self._brand_user())
        r = self.client.patch("/api/brands/profile/", {
            "company_name": "ACME", "siret": "123",
            "billing_postal_code": "!!", "billing_city": "P",
        }, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("siret", r.data)
        self.assertIn("billing_postal_code", r.data)
        self.assertIn("billing_city", r.data)

    def test_siret_spaces_are_normalised_and_country_upcased(self):
        self.client.force_authenticate(self._brand_user())
        r = self.client.patch("/api/brands/profile/", {
            "siret": "123 456 789 00012", "billing_country": "fr",
        }, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["siret"], "12345678900012")
        self.assertEqual(r.data["billing_country"], "FR")

    def test_address_is_required_before_submitting_for_validation(self):
        user = self._brand_user()
        self.client.force_authenticate(user)
        r = self.client.get("/api/brands/onboarding/")
        for field in ("billing_address", "billing_postal_code", "billing_city"):
            self.assertIn(field, r.data["missing_fields"])

    def test_logo_upload_returns_an_absolute_url(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
            b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        self.client.force_authenticate(self._brand_user())
        upload = SimpleUploadedFile("logo.png", png, content_type="image/png")
        r = self.client.patch("/api/brands/profile/", {"logo_upload": upload}, format="multipart")
        self.assertEqual(r.status_code, 200, r.content)
        # A relative path 404s when the SPA is served from another origin.
        self.assertTrue(str(r.data["logo"]).startswith("http"), r.data["logo"])


class EmailLanguageTests(APITestCase):
    """A French-first platform must not silently email in English."""

    def test_registration_defaults_to_french(self):
        r = self.client.post("/api/auth/register/", {
            "email": "marque@example.fr", "password": "pass12345",
            "user_type": "brand", "company_name": "ACME",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(User.objects.get(email="marque@example.fr").language_preference, "fr")

    def test_registration_honours_an_explicit_english_choice(self):
        r = self.client.post("/api/auth/register/", {
            "email": "brand@example.com", "password": "pass12345",
            "user_type": "brand", "company_name": "ACME EN",
            "language_preference": "en",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(User.objects.get(email="brand@example.com").language_preference, "en")

    def test_rejection_email_is_french(self):
        from django.core import mail

        from .models import BrandProfile

        admin = User.objects.create_user(
            username="mailadmin", email="mailadmin@example.com", password="pass1234",
            user_type="brand", is_staff=True, is_superuser=True,
        )
        self.client.post("/api/auth/register/", {
            "email": "refuse@example.fr", "password": "pass12345",
            "user_type": "brand", "company_name": "ACME",
        }, format="json")
        profile = BrandProfile.objects.get(user__email="refuse@example.fr")
        mail.outbox.clear()

        self.client.force_authenticate(admin)
        r = self.client.post(f"/api/admin/brands/{profile.id}/reject/",
                             {"reason": "SIRET illisible"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(mail.outbox)
        message = mail.outbox[-1]
        self.assertIn("Votre demande d'inscription", message.subject)
        self.assertIn("Bonjour", message.body)

    def test_email_header_has_a_solid_background_for_clients_without_gradients(self):
        from .services.email_service import build_transactional_email_html

        html = build_transactional_email_html(
            title="Titre", greeting="Bonjour,", paragraphs=["Corps du message."],
        )
        # Outlook ignores linear-gradient; without this the header was white on white.
        self.assertIn('bgcolor="#4f46e5"', html)
        self.assertIn("background-color:#4f46e5", html)


class EmailVerificationTests(APITestCase):
    """Signup must prove the address is real, without locking anyone out."""

    def _register(self, email="nouveau@example.fr"):
        r = self.client.post("/api/auth/register/", {
            "email": email, "password": "pass12345",
            "user_type": "influencer", "display_name": "nina",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return User.objects.get(email=email)

    def _token_from_outbox(self):
        import re

        from django.core import mail

        messages = [m for m in mail.outbox if "onfirm" in m.subject]
        self.assertTrue(messages, [m.subject for m in mail.outbox])
        found = re.search(r"#token=([\w:\-\.]+)", messages[-1].body)
        self.assertIsNotNone(found, messages[-1].body)
        return found.group(1)

    def test_signup_sends_a_verification_link_and_starts_unverified(self):
        user = self._register()
        self.assertFalse(user.email_verified)
        self.assertIsNone(user.email_verified_at)
        self._token_from_outbox()

    def test_valid_token_verifies_once_and_cannot_be_replayed(self):
        user = self._register()
        token = self._token_from_outbox()

        r = self.client.post("/api/auth/verify-email-confirm/", {"token": token}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        user.refresh_from_db()
        self.assertTrue(user.email_verified)
        self.assertIsNotNone(user.email_verified_at)

        # Single-use: the nonce is burned.
        r = self.client.post("/api/auth/verify-email-confirm/", {"token": token}, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_forged_token_is_rejected(self):
        user = self._register()
        r = self.client.post("/api/auth/verify-email-confirm/", {"token": "not-a-token"}, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        user.refresh_from_db()
        self.assertFalse(user.email_verified)

    def test_verification_flag_cannot_be_set_through_the_profile_api(self):
        user = self._register()
        self.client.force_authenticate(user)
        r = self.client.patch("/api/auth/me/", {"email_verified": True}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        user.refresh_from_db()
        self.assertFalse(user.email_verified)

    def test_changing_the_email_requires_verifying_again(self):
        user = self._register()
        token = self._token_from_outbox()
        self.client.post("/api/auth/verify-email-confirm/", {"token": token}, format="json")
        user.refresh_from_db()
        self.assertTrue(user.email_verified)

        user.set_password("pass12345")
        user.save(update_fields=["password"])
        self.client.force_authenticate(user)
        r = self.client.patch("/api/auth/me/", {
            "email": "autre@example.fr", "current_password": "pass12345",
        }, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        user.refresh_from_db()
        self.assertFalse(user.email_verified)

    def test_unverified_account_can_still_use_the_platform(self):
        # Verification is a reminder, not a lockout: a bounced email must not
        # trap someone out of their own account.
        user = self._register()
        self.client.force_authenticate(user)
        r = self.client.get("/api/auth/me/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertFalse(r.data["email_verified"])
