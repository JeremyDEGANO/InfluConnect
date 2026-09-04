from decimal import Decimal
import tempfile

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import (
    AmbassadorProgram,
    BrandMembership,
    BrandProfile,
    Campaign,
    CampaignDocument,
    CampaignProposal,
    Event,
    EventInvitation,
    InfluencerProfile,
    MediaKitImage,
    Message,
    Review,
    SocialNetwork,
    User,
)

_TINY_PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753"
    "de0000000c4944415478da6360000002000155bfabc50000000049454e44ae426082"
)


def _tiny_png(name="tiny.png"):
    """Fresh 1x1 PNG upload, used to satisfy ImageField validation in completion tests."""
    return SimpleUploadedFile(name, _TINY_PNG_BYTES, content_type="image/png")



class AuthorizationRegressionTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner-security",
            email="owner-security@example.com",
            password="StrongPass123!",
            user_type="brand",
        )
        self.brand = BrandProfile.objects.create(
            user=self.owner,
            company_name="Secure Brand",
            subscription_plan="pro",
            subscription_active=True,
            validation_status="approved",
        )
        self.member = User.objects.create_user(
            username="member-security",
            email="member-security@example.com",
            password="StrongPass123!",
            user_type="brand",
            active_brand_workspace=self.brand,
        )
        BrandMembership.objects.create(
            brand=self.brand,
            user=self.member,
            invited_email=self.member.email,
            role="member",
            status="active",
            invited_by=self.owner,
        )
        self.influencer_user = User.objects.create_user(
            username="influencer-security",
            email="influencer-security@example.com",
            password="StrongPass123!",
            user_type="influencer",
        )
        self.influencer = InfluencerProfile.objects.create(
            user=self.influencer_user,
            display_name="secure.creator",
        )
        self.campaign = Campaign.objects.create(
            brand=self.brand,
            title="Secure Campaign",
            campaign_type="paid",
            status="active",
            price_per_influencer=Decimal("500.00"),
        )
        self.proposal = CampaignProposal.objects.create(
            campaign=self.campaign,
            influencer=self.influencer,
            proposed_price=Decimal("500.00"),
        )

    @override_settings(MEDIA_ROOT=tempfile.mkdtemp())
    def test_message_attachment_upload_is_stored(self):
        self.client.force_authenticate(self.influencer_user)
        response = self.client.post(
            f"/api/proposals/{self.proposal.id}/messages/send/",
            {"content": "Voici le fichier", "attachments": _tiny_png("brief.png")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.content)
        message = Message.objects.get(pk=response.data["id"])
        self.assertTrue(message.attachments)

    @override_settings(MEDIA_ROOT=tempfile.mkdtemp())
    def test_campaign_documents_are_limited_and_access_controlled(self):
        self.client.force_authenticate(self.owner)
        for index in range(CampaignDocument.MAX_PER_CAMPAIGN):
            response = self.client.post(
                f"/api/campaigns/{self.campaign.id}/documents/",
                {"file": _tiny_png(f"doc{index}.png")},
                format="multipart",
            )
            self.assertEqual(response.status_code, 201, response.content)

        overflow = self.client.post(
            f"/api/campaigns/{self.campaign.id}/documents/",
            {"file": _tiny_png("doc6.png")},
            format="multipart",
        )
        self.assertEqual(overflow.status_code, 400, overflow.content)

        # Invited influencer can read them, an unrelated influencer cannot.
        self.client.force_authenticate(self.influencer_user)
        allowed = self.client.get(f"/api/campaigns/{self.campaign.id}/documents/")
        self.assertEqual(allowed.status_code, 200, allowed.content)
        self.assertEqual(len(allowed.data), CampaignDocument.MAX_PER_CAMPAIGN)

        stranger = User.objects.create_user(
            username="stranger-docs",
            email="stranger-docs@example.com",
            password="StrongPass123!",
            user_type="influencer",
        )
        InfluencerProfile.objects.create(user=stranger, display_name="stranger.docs")
        self.client.force_authenticate(stranger)
        denied = self.client.get(f"/api/campaigns/{self.campaign.id}/documents/")
        self.assertEqual(denied.status_code, 403, denied.content)

    @override_settings(MEDIA_ROOT=tempfile.mkdtemp())
    def test_media_kit_pdf_requires_authentication(self):
        self.influencer.media_kit_pdf.save("kit.pdf", ContentFile(b"%PDF-1.4 test"), save=True)
        url = f"/api/influencers/{self.influencer.id}/media-kit/"

        self.client.force_authenticate(user=None)
        anonymous = self.client.get(url)
        self.assertIn(anonymous.status_code, (401, 403))

        self.client.force_authenticate(self.owner)
        allowed = self.client.get(url)
        self.assertEqual(allowed.status_code, 200)

    def test_contract_generation_requires_active_subscription(self):
        self.proposal.status = "accepted"
        self.proposal.save(update_fields=["status"])
        self.brand.subscription_active = False
        self.brand.save(update_fields=["subscription_active"])

        self.client.force_authenticate(self.owner)
        blocked = self.client.post(f"/api/proposals/{self.proposal.id}/generate-contract/")
        self.assertEqual(blocked.status_code, 402, blocked.content)
        self.assertEqual(blocked.data.get("code"), "subscription_required")

        self.brand.subscription_active = True
        self.brand.save(update_fields=["subscription_active"])
        allowed = self.client.post(f"/api/proposals/{self.proposal.id}/generate-contract/")
        self.assertNotEqual(allowed.status_code, 402, allowed.content)

    def test_brand_can_register_without_a_plan(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "user_type": "brand",
                "email": "freemium-brand@example.com",
                "password": "StrongPass123!",
                "company_name": "Freemium Brand",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        created = BrandProfile.objects.get(company_name="Freemium Brand")
        self.assertFalse(created.subscription_active)

    def test_member_cannot_update_brand_profile(self):
        self.client.force_authenticate(self.member)
        response = self.client.patch(
            "/api/brands/profile/",
            {"company_name": "Hijacked", "subscription_plan": "pro"},
            format="json",
        )
        self.assertEqual(response.status_code, 403, response.content)
        self.brand.refresh_from_db()
        self.assertEqual(self.brand.company_name, "Secure Brand")

    def test_invited_influencer_cannot_update_event(self):
        event = Event.objects.create(
            brand=self.brand,
            title="Private Event",
            address="1 rue de Paris",
            starts_at="2030-01-01T10:00:00Z",
        )
        EventInvitation.objects.create(event=event, influencer=self.influencer)
        self.client.force_authenticate(self.influencer_user)
        response = self.client.patch(
            f"/api/events/{event.id}/", {"title": "Hijacked"}, format="json",
        )
        self.assertEqual(response.status_code, 403, response.content)
        event.refresh_from_db()
        self.assertEqual(event.title, "Private Event")

    def test_influencer_only_sees_own_nested_event_invitation(self):
        other_user = User.objects.create_user(
            username="other-invitee",
            email="other-invitee@example.com",
            password="StrongPass123!",
            user_type="influencer",
        )
        other = InfluencerProfile.objects.create(user=other_user, display_name="other.creator")
        event = Event.objects.create(
            brand=self.brand,
            title="Private Event",
            address="1 rue de Paris",
            starts_at="2030-01-01T10:00:00Z",
        )
        own_invitation = EventInvitation.objects.create(event=event, influencer=self.influencer)
        EventInvitation.objects.create(event=event, influencer=other)
        self.client.force_authenticate(self.influencer_user)
        response = self.client.get(f"/api/events/{event.id}/")
        self.assertEqual(response.status_code, 200, response.content)
        invitations = response.data["invitations"]
        self.assertEqual(len(invitations), 1)
        self.assertEqual(invitations[0]["invite_token"], str(own_invitation.invite_token))

    def test_influencer_cannot_update_ambassador_program(self):
        program = AmbassadorProgram.objects.create(
            brand=self.brand,
            influencer=self.influencer,
            name="Ambassador 2026",
            monthly_budget=Decimal("1000.00"),
            starts_at="2030-01-01",
        )
        self.client.force_authenticate(self.influencer_user)
        response = self.client.patch(
            f"/api/ambassador-programs/{program.id}/",
            {"monthly_budget": "999999.00"},
            format="json",
        )
        self.assertEqual(response.status_code, 403, response.content)
        program.refresh_from_db()
        self.assertEqual(program.monthly_budget, Decimal("1000.00"))

    def test_stranger_read_does_not_mark_proposal_messages_read(self):
        message = Message.objects.create(
            proposal=self.proposal,
            sender=self.owner,
            content="Private message",
            read=False,
        )
        stranger_user = User.objects.create_user(
            username="stranger-security",
            email="stranger-security@example.com",
            password="StrongPass123!",
            user_type="influencer",
        )
        InfluencerProfile.objects.create(user=stranger_user, display_name="stranger.creator")
        self.client.force_authenticate(stranger_user)
        response = self.client.get(f"/api/proposals/{self.proposal.id}/messages/")
        self.assertEqual(response.status_code, 200, response.content)
        message.refresh_from_db()
        self.assertFalse(message.read)

    def test_unpublished_reviews_are_hidden(self):
        review = Review.objects.create(
            proposal=self.proposal,
            reviewer=self.owner,
            reviewee=self.influencer_user,
            rating=5,
            comment="Pending moderation",
            is_published=False,
        )
        self.client.force_authenticate(self.owner)
        response = self.client.get(f"/api/users/{self.influencer_user.id}/reviews/")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data.get("count"), 0)
        review.is_published = True
        review.save(update_fields=["is_published"])
        response = self.client.get(f"/api/users/{self.influencer_user.id}/reviews/")
        self.assertEqual(response.data.get("count"), 1)

    @override_settings(MEDIA_ROOT=tempfile.mkdtemp())
    def test_public_marketplace_only_lists_verified_complete_active_profiles(self):
        self.influencer_user.avatar = _tiny_png()
        self.influencer_user.location = "Paris"
        # A listed creator has a confirmed address: brands must be able to
        # reach them about a proposal.
        self.influencer_user.email_verified = True
        self.influencer_user.save(update_fields=["avatar", "location", "email_verified"])
        self.influencer.is_verified = True
        self.influencer.bio = "Lifestyle & travel content creator based in Paris."
        self.influencer.languages = ["fr", "en"]
        self.influencer.content_themes = ["beauty"]
        self.influencer.content_types_offered = ["reel"]
        self.influencer.pricing = {"reel": 300}
        self.influencer.collaboration_pitch = "I love collaborating with brands on authentic content."
        self.influencer.payment_method = "bank_transfer"
        self.influencer.payment_details = "encrypted-iban"
        self.influencer.onboarding_completed = True
        self.influencer.save()
        SocialNetwork.objects.create(
            influencer=self.influencer, platform="instagram", profile_url="https://instagram.com/secure.creator",
        )
        MediaKitImage.objects.create(influencer=self.influencer, image=_tiny_png("gallery.png"))
        hidden_user = User.objects.create_user(
            username="hidden-security",
            email="hidden-security@example.com",
            password="StrongPass123!",
            user_type="influencer",
        )
        InfluencerProfile.objects.create(
            user=hidden_user,
            display_name="hidden.creator",
            is_verified=False,
            onboarding_completed=True,
        )
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/public/marketplace/")
        self.assertEqual(response.status_code, 200, response.content)
        results = response.data.get("results", response.data)
        self.assertEqual([row["id"] for row in results], [self.influencer.id])

    def test_public_marketplace_excludes_partially_complete_profile(self):
        # Verified + active but profile completion below 100% must stay hidden.
        self.influencer.is_verified = True
        self.influencer.bio = "Short bio over ten characters."
        self.influencer.onboarding_completed = True
        self.influencer.save()
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/public/marketplace/")
        self.assertEqual(response.status_code, 200, response.content)
        results = response.data.get("results", response.data)
        self.assertEqual([row["id"] for row in results], [])

    def test_sso_sync_does_not_elevate_manual_membership(self):
        from .models import BrandSSOConfig, SSOGroupMapping
        from .services.sso_office365 import _sync_user_access
        from .workspace import ensure_brand_organization

        organization = ensure_brand_organization(self.brand)
        self.brand.refresh_from_db()
        config = BrandSSOConfig.objects.create(brand=self.brand, provisioning_mode="groups")
        mapping = SSOGroupMapping.objects.create(
            sso_config=config,
            group_object_id="admins",
            group_name="Admins",
            role="admin",
            scope="environments",
        )
        mapping.environments.add(self.brand)
        _sync_user_access(user=self.member, sso=config, matched_mappings=[mapping])
        membership = BrandMembership.objects.get(brand=self.brand, user=self.member)
        self.assertEqual(membership.role, "member")
        self.assertFalse(membership.provisioned_by_sso)
        self.assertEqual(self.brand.organization_id, organization.id)
