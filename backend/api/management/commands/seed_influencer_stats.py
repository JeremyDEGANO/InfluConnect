from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from api.models import BrandProfile, Campaign, CampaignProposal, InfluencerProfile


def _shift_month_start(value, months_back):
    month_index = value.month - months_back - 1
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return value.replace(
        year=year,
        month=month,
        day=1,
        hour=12,
        minute=0,
        second=0,
        microsecond=0,
    )


class Command(BaseCommand):
    help = "Seed demo proposals/earnings for one influencer so dashboard statistics are visible."

    def add_arguments(self, parser):
        parser.add_argument("--email", default="jeremy.degano@gmail.com", help="Influencer email to seed")
        parser.add_argument("--brand-email", default="", help="Optional brand owner email to use/create the demo brand")
        parser.add_argument("--months", type=int, default=6, help="How many months of history to create")
        parser.add_argument("--reset", action="store_true", help="Delete previously seeded demo data before recreating it")

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        influencer_user = User.objects.filter(email__iexact=options["email"]).select_related("influencer_profile").first()
        if not influencer_user or not hasattr(influencer_user, "influencer_profile"):
            raise CommandError(f"Influencer not found for email={options['email']}")

        influencer = influencer_user.influencer_profile
        months = max(1, int(options["months"]))
        demo_prefix = "[Demo Stats]"

        brand_owner = None
        if options["brand_email"]:
            brand_owner = User.objects.filter(email__iexact=options["brand_email"]).first()
            if brand_owner and not hasattr(brand_owner, "brand_profile"):
                brand_owner = None
        if not brand_owner:
            brand_owner = User.objects.filter(user_type="brand", brand_profile__validation_status="approved").select_related("brand_profile").first()
        if not brand_owner:
            brand_owner = User.objects.filter(user_type="brand").select_related("brand_profile").first()
        if not brand_owner:
            brand_owner = User.objects.create_user(
                username="demo.brand",
                email="demo.brand@local.dev",
                password="DemoBrand123!",
                user_type="brand",
                first_name="Demo",
                last_name="Brand",
            )
            BrandProfile.objects.create(
                user=brand_owner,
                company_name="Demo Brand",
                website="https://example.com",
                sector="Demo",
                subscription_plan="growth",
                validation_status="approved",
            )

        brand = brand_owner.brand_profile

        if options["reset"]:
            CampaignProposal.objects.filter(campaign__title__startswith=demo_prefix, influencer=influencer).delete()
            Campaign.objects.filter(title__startswith=demo_prefix, brand=brand).delete()

        now = timezone.now()
        statuses = ["pending", "accepted", "counter_offer", "contract_signed", "in_progress", "paid"]
        paid_amounts = [0, 0, 0, 0, 0, 1250]
        proposal_counts = [1, 1, 1, 1, 2, 2]

        created_campaigns = 0
        created_proposals = 0
        current_month_start = now.replace(day=1, hour=12, minute=0, second=0, microsecond=0)

        for offset in range(min(months, 6)):
            month_start = _shift_month_start(current_month_start, offset)
            for idx in range(proposal_counts[offset]):
                status = statuses[(offset + idx) % len(statuses)]
                amount = 250 + (offset * 85) + (idx * 40)
                if status == "paid":
                    amount = paid_amounts[offset] or 1250 + (offset * 150)

                campaign = Campaign.objects.create(
                    brand=brand,
                    title=f"{demo_prefix} Campaign {month_start:%Y-%m} #{idx + 1}",
                    description=f"Demo campaign for stats view, month {month_start:%Y-%m}.",
                    campaign_type="paid",
                    status="active" if status != "paid" else "completed",
                    price_per_influencer=amount,
                    deadline=(month_start + timedelta(days=25)).date(),
                    target_networks=["instagram"],
                    content_formats=[{"code": "story", "quantity": 1}],
                    max_influencers=1,
                )
                campaign.created_at = month_start + timedelta(days=min(2 + idx, 18))
                campaign.updated_at = month_start + timedelta(days=min(3 + idx, 19))
                campaign.save(update_fields=["created_at", "updated_at"])
                created_campaigns += 1

                proposal = CampaignProposal.objects.create(
                    campaign=campaign,
                    influencer=influencer,
                    status=status,
                    proposed_price=amount,
                    counter_price=amount + 100 if status == "counter_offer" else None,
                    counter_message="Demo counter offer" if status == "counter_offer" else "",
                    escrow_amount=amount if status == "paid" else (amount if status in ["accepted", "contract_signed", "in_progress", "content_submitted"] else None),
                    escrow_funded=status in ["accepted", "contract_signed", "in_progress", "content_submitted", "paid"],
                    escrow_released=status == "paid",
                )
                proposal.created_at = month_start + timedelta(days=min(3 + idx, 20))
                proposal.updated_at = month_start + timedelta(days=min(4 + idx, 21))

                if status == "paid":
                    proposal.escrow_funded_at = month_start + timedelta(days=10)
                    proposal.escrow_released_at = month_start + timedelta(days=20)
                    proposal.contract_signed_brand = True
                    proposal.contract_signed_influencer = True
                    proposal.contract_signed_at = month_start + timedelta(days=8)
                    proposal.brand_signed_at = month_start + timedelta(days=6)
                    proposal.influencer_signed_at = month_start + timedelta(days=7)
                    proposal.save(update_fields=[
                        "created_at", "updated_at",
                        "escrow_funded_at", "escrow_released_at", "contract_signed_brand",
                        "contract_signed_influencer", "contract_signed_at", "brand_signed_at",
                        "influencer_signed_at",
                    ])
                elif status in ["contract_signed", "in_progress", "content_submitted"]:
                    proposal.escrow_funded_at = month_start + timedelta(days=10)
                    proposal.brand_signed_at = month_start + timedelta(days=6)
                    proposal.influencer_signed_at = month_start + timedelta(days=7)
                    proposal.contract_signed_brand = True
                    proposal.contract_signed_influencer = True
                    proposal.contract_signed_at = month_start + timedelta(days=8)
                    proposal.save(update_fields=[
                        "created_at", "updated_at",
                        "escrow_funded_at", "brand_signed_at", "influencer_signed_at",
                        "contract_signed_brand", "contract_signed_influencer", "contract_signed_at",
                    ])
                else:
                    proposal.save(update_fields=["created_at", "updated_at"])

                created_proposals += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {created_campaigns} campaigns and {created_proposals} proposals for {influencer_user.email}"
        ))