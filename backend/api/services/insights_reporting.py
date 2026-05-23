from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Any

from django.db.models import QuerySet

from ..models import Campaign, CampaignProposal, ContentSubmission, InfluencerProfile


DEFAULT_EMV_RULES = {
    "base_cpm_eur": 18.0,
    "engagement_value_eur": 0.35,
    "format_multipliers": {
        "video": 1.25,
        "story": 0.85,
        "image": 1.0,
        "default": 1.0,
    },
}


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        if isinstance(value, str):
            cleaned = value.replace("%", "").replace(" ", "").strip()
            if not cleaned:
                return default
            return float(cleaned)
        return float(value)
    except (TypeError, ValueError):
        return default


def _pick_stat(stats: dict[str, Any], keys: list[str], default: float = 0.0) -> float:
    for key in keys:
        if key in stats:
            value = _to_float(stats.get(key), default=default)
            if value > 0:
                return value
    return default


def _avg_social(profile: InfluencerProfile) -> tuple[float, float, list[str]]:
    networks = list(profile.social_networks.all())
    if not networks:
        return 0.0, 0.0, []
    followers = sum(float(n.followers_count or 0) for n in networks) / len(networks)
    engagement = sum(float(n.engagement_rate or 0) for n in networks) / len(networks)
    platforms = [str(n.platform or "").strip().lower() for n in networks if n.platform]
    return followers, engagement, platforms


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    if union == 0:
        return 0.0
    return inter / union


def _proximity(a: float, b: float) -> float:
    max_v = max(abs(a), abs(b), 1.0)
    return max(0.0, 1.0 - (abs(a - b) / max_v))


@dataclass
class EmvRow:
    submission_id: int
    proposal_id: int
    influencer_id: int
    influencer_name: str
    impressions: float
    engagement: float
    emv_eur: float
    confidence: str


def classify_content_format(submission: ContentSubmission) -> str:
    url = str(submission.publication_url or "").lower()
    campaign_format = str(getattr(submission.proposal.campaign, "content_format", "") or "").lower()
    if any(token in url for token in ["reel", "video", "tiktok", "youtube", "shorts"]) or "video" in campaign_format:
        return "video"
    if "story" in url or "story" in campaign_format:
        return "story"
    return "image"


def compute_campaign_emv(campaign: Campaign) -> dict[str, Any]:
    submissions = ContentSubmission.objects.select_related(
        "proposal", "proposal__influencer", "proposal__influencer__user", "proposal__campaign"
    ).filter(proposal__campaign=campaign)

    rows: list[EmvRow] = []
    influencers_map: dict[int, dict[str, Any]] = {}

    for submission in submissions:
        stats = submission.final_stats or submission.initial_stats or {}
        if not isinstance(stats, dict):
            stats = {}

        impressions = _pick_stat(stats, ["impressions", "reach", "views", "view_count"], default=0.0)

        likes = _pick_stat(stats, ["likes", "like_count"], default=0.0)
        comments = _pick_stat(stats, ["comments", "comment_count"], default=0.0)
        shares = _pick_stat(stats, ["shares", "share_count"], default=0.0)
        saves = _pick_stat(stats, ["saves", "save_count"], default=0.0)
        clicks = _pick_stat(stats, ["clicks", "link_clicks"], default=0.0)
        engagement = likes + comments + shares + saves + clicks

        confidence = "high"

        if impressions <= 0:
            confidence = "medium"
            avg_views, avg_engagement, _ = _avg_social(submission.proposal.influencer)
            if avg_views > 0:
                impressions = avg_views
            elif avg_engagement > 0:
                impressions = max(500.0, avg_engagement * 120.0)
            else:
                confidence = "low"
                impressions = 1000.0

        if engagement <= 0:
            confidence = "medium" if confidence == "high" else confidence
            avg_followers, avg_engagement, _ = _avg_social(submission.proposal.influencer)
            inferred = impressions * max(avg_engagement, 0) / 100.0
            if inferred > 0:
                engagement = inferred
            elif avg_followers > 0:
                engagement = avg_followers * 0.01
            else:
                confidence = "low"
                engagement = max(10.0, impressions * 0.005)

        format_key = classify_content_format(submission)
        mult = DEFAULT_EMV_RULES["format_multipliers"].get(format_key, DEFAULT_EMV_RULES["format_multipliers"]["default"])

        emv = ((impressions / 1000.0) * DEFAULT_EMV_RULES["base_cpm_eur"] * mult) + (
            engagement * DEFAULT_EMV_RULES["engagement_value_eur"]
        )

        influencer = submission.proposal.influencer
        influencer_name = influencer.display_name or influencer.user.username

        row = EmvRow(
            submission_id=submission.id,
            proposal_id=submission.proposal_id,
            influencer_id=influencer.id,
            influencer_name=influencer_name,
            impressions=round(impressions, 2),
            engagement=round(engagement, 2),
            emv_eur=round(emv, 2),
            confidence=confidence,
        )
        rows.append(row)

        bucket = influencers_map.setdefault(
            influencer.id,
            {
                "influencer_id": influencer.id,
                "influencer_name": influencer_name,
                "submissions": 0,
                "impressions": 0.0,
                "engagement": 0.0,
                "emv_eur": 0.0,
            },
        )
        bucket["submissions"] += 1
        bucket["impressions"] += row.impressions
        bucket["engagement"] += row.engagement
        bucket["emv_eur"] += row.emv_eur

    budget_spent = 0.0
    paid = CampaignProposal.objects.filter(campaign=campaign, status="paid")
    for p in paid:
        budget_spent += float(p.escrow_amount or 0)

    total_emv = round(sum(r.emv_eur for r in rows), 2)
    ratio = round(total_emv / budget_spent, 3) if budget_spent > 0 else None

    influencers = sorted(influencers_map.values(), key=lambda x: x["emv_eur"], reverse=True)
    for item in influencers:
        item["impressions"] = round(item["impressions"], 2)
        item["engagement"] = round(item["engagement"], 2)
        item["emv_eur"] = round(item["emv_eur"], 2)

    confidence_score = 0.0
    if rows:
        confidence_map = {"high": 1.0, "medium": 0.65, "low": 0.35}
        confidence_score = round(sum(confidence_map.get(r.confidence, 0.35) for r in rows) / len(rows), 3)

    return {
        "campaign_id": campaign.id,
        "campaign_title": campaign.title,
        "currency": "EUR",
        "rules": DEFAULT_EMV_RULES,
        "submissions_count": len(rows),
        "emv_total_eur": total_emv,
        "budget_spent_eur": round(budget_spent, 2),
        "emv_vs_spend_ratio": ratio,
        "confidence_score": confidence_score,
        "by_influencer": influencers,
        "by_submission": [r.__dict__ for r in rows],
    }


def compute_lookalikes(
    campaign: Campaign,
    reference_influencer_id: int,
    limit: int = 20,
    min_score: float = 0.35,
) -> list[dict[str, Any]]:
    try:
        reference = InfluencerProfile.objects.select_related("user").prefetch_related("social_networks").get(pk=reference_influencer_id)
    except InfluencerProfile.DoesNotExist:
        return []

    ref_followers, ref_engagement, ref_platforms = _avg_social(reference)
    ref_themes = {str(v).strip().lower() for v in (reference.content_themes or []) if str(v).strip()}
    ref_location = str(reference.user.location or "").strip().lower()
    ref_rating = float(reference.average_rating or 0)

    qs: QuerySet[InfluencerProfile] = InfluencerProfile.objects.select_related("user").prefetch_related("social_networks")
    qs = qs.filter(onboarding_completed=True).exclude(pk=reference.id)

    platforms = [str(v).strip().lower() for v in (campaign.target_networks or []) if str(v).strip()]
    if platforms:
        qs = qs.filter(social_networks__platform__in=platforms).distinct()

    results: list[dict[str, Any]] = []

    for candidate in qs[:300]:
        c_followers, c_engagement, c_platforms = _avg_social(candidate)
        c_themes = {str(v).strip().lower() for v in (candidate.content_themes or []) if str(v).strip()}
        c_location = str(candidate.user.location or "").strip().lower()
        c_rating = float(candidate.average_rating or 0)

        theme_score = _jaccard(ref_themes, c_themes)
        platform_score = _jaccard(set(ref_platforms), set(c_platforms))
        followers_score = _proximity(ref_followers, c_followers)
        engagement_score = _proximity(ref_engagement, c_engagement)
        rating_score = _proximity(ref_rating, c_rating)
        location_score = 1.0 if (ref_location and c_location and ref_location == c_location) else 0.0

        total = (
            (0.30 * theme_score)
            + (0.20 * platform_score)
            + (0.20 * followers_score)
            + (0.15 * engagement_score)
            + (0.10 * rating_score)
            + (0.05 * location_score)
        )

        if total < min_score:
            continue

        reason_pairs = [
            ("themes", theme_score),
            ("platforms", platform_score),
            ("audience", followers_score),
            ("engagement", engagement_score),
            ("rating", rating_score),
            ("location", location_score),
        ]
        reason_pairs.sort(key=lambda x: x[1], reverse=True)

        results.append({
            "influencer_id": candidate.id,
            "display_name": candidate.display_name or candidate.user.username,
            "pseudo": candidate.display_name or candidate.user.username,
            "avatar": candidate.user.avatar.url if getattr(candidate.user, "avatar", None) else None,
            "location": candidate.user.location,
            "themes": list(candidate.content_themes or []),
            "platforms": c_platforms,
            "followers_avg": round(c_followers, 2),
            "engagement_rate_avg": round(c_engagement, 2),
            "rating": round(c_rating, 2),
            "score": round(total, 4),
            "reasons": [k for k, _ in reason_pairs[:3]],
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[: max(1, min(limit, 50))]


def build_campaign_report_payload(campaign: Campaign) -> dict[str, Any]:
    emv = compute_campaign_emv(campaign)
    proposals = CampaignProposal.objects.filter(campaign=campaign)

    status_counts: dict[str, int] = {}
    for status in [
        "pending",
        "accepted",
        "declined",
        "counter_offer",
        "contract_signed",
        "in_progress",
        "content_submitted",
        "validated",
        "paid",
        "disputed",
    ]:
        status_counts[status] = proposals.filter(status=status).count()

    return {
        "campaign": {
            "id": campaign.id,
            "title": campaign.title,
            "status": campaign.status,
            "deadline": campaign.deadline.isoformat() if campaign.deadline else None,
            "budget_per_influencer": float(campaign.price_per_influencer or 0),
            "max_influencers": int(campaign.max_influencers or 0),
        },
        "proposals": {
            "total": proposals.count(),
            "status_counts": status_counts,
        },
        "emv": emv,
    }


def render_report_pdf(report: dict[str, Any]) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 60
    c.setFont("Helvetica-Bold", 18)
    c.drawString(40, y, "InfluConnect Campaign Report")
    y -= 28

    campaign = report["campaign"]
    emv = report["emv"]

    c.setFont("Helvetica", 11)
    c.drawString(40, y, f"Campaign: {campaign['title']} (#{campaign['id']})")
    y -= 18
    c.drawString(40, y, f"Status: {campaign['status']}   Deadline: {campaign['deadline'] or '-'}")
    y -= 18
    c.drawString(40, y, f"Budget per influencer: EUR {campaign['budget_per_influencer']:.2f}")
    y -= 30

    c.setFont("Helvetica-Bold", 13)
    c.drawString(40, y, "EMV")
    y -= 20
    c.setFont("Helvetica", 11)
    c.drawString(40, y, f"Total EMV: EUR {emv['emv_total_eur']:.2f}")
    y -= 16
    c.drawString(40, y, f"Budget spent: EUR {emv['budget_spent_eur']:.2f}")
    y -= 16
    ratio = emv.get("emv_vs_spend_ratio")
    c.drawString(40, y, f"EMV/Spend ratio: {ratio if ratio is not None else '-'}")
    y -= 24

    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, y, "Top influencers by EMV")
    y -= 18
    c.setFont("Helvetica", 10)

    for idx, row in enumerate(emv.get("by_influencer", [])[:8], start=1):
        c.drawString(40, y, f"{idx}. {row['influencer_name']} - EUR {row['emv_eur']:.2f} ({int(row['submissions'])} submissions)")
        y -= 14
        if y < 80:
            c.showPage()
            y = height - 60
            c.setFont("Helvetica", 10)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.read()


def render_report_pptx(report: dict[str, Any]) -> bytes:
    from pptx import Presentation

    prs = Presentation()

    # Slide 1 - title
    slide = prs.slides.add_slide(prs.slide_layouts[0])
    slide.shapes.title.text = "InfluConnect Campaign Report"
    slide.placeholders[1].text = report["campaign"]["title"]

    # Slide 2 - KPI overview
    slide = prs.slides.add_slide(prs.slide_layouts[1])
    slide.shapes.title.text = "Campaign KPI Overview"
    body = slide.shapes.placeholders[1].text_frame
    campaign = report["campaign"]
    proposals = report["proposals"]
    body.text = f"Campaign ID: {campaign['id']}"
    body.add_paragraph().text = f"Status: {campaign['status']}"
    body.add_paragraph().text = f"Deadline: {campaign['deadline'] or '-'}"
    body.add_paragraph().text = f"Total proposals: {proposals['total']}"

    # Slide 3 - EMV summary
    slide = prs.slides.add_slide(prs.slide_layouts[1])
    slide.shapes.title.text = "Earned Media Value"
    body = slide.shapes.placeholders[1].text_frame
    emv = report["emv"]
    body.text = f"Total EMV: EUR {emv['emv_total_eur']:.2f}"
    body.add_paragraph().text = f"Budget spent: EUR {emv['budget_spent_eur']:.2f}"
    ratio = emv.get("emv_vs_spend_ratio")
    body.add_paragraph().text = f"EMV/Spend ratio: {ratio if ratio is not None else '-'}"
    body.add_paragraph().text = f"Confidence score: {emv.get('confidence_score', 0):.3f}"

    # Slide 4 - top influencers
    slide = prs.slides.add_slide(prs.slide_layouts[5])
    slide.shapes.title.text = "Top influencers by EMV"
    rows = emv.get("by_influencer", [])[:8]

    if rows:
        table = slide.shapes.add_table(len(rows) + 1, 3, left=400000, top=1300000, width=8200000, height=3500000).table
        table.cell(0, 0).text = "Influencer"
        table.cell(0, 1).text = "EMV (EUR)"
        table.cell(0, 2).text = "Submissions"
        for idx, row in enumerate(rows, start=1):
            table.cell(idx, 0).text = str(row.get("influencer_name", "-"))
            table.cell(idx, 1).text = f"{float(row.get('emv_eur', 0)):.2f}"
            table.cell(idx, 2).text = str(row.get("submissions", 0))

    out = BytesIO()
    prs.save(out)
    out.seek(0)
    return out.read()
