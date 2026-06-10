"""
Email service — uses Django's `send_mail` so the SMTP backend can be configured
entirely via environment variables (settings.py reads EMAIL_* from env).

In dev: defaults to console backend (emails are printed to stdout).
In prod: set EMAIL_HOST / EMAIL_HOST_USER / EMAIL_HOST_PASSWORD / EMAIL_PORT /
EMAIL_USE_TLS / DEFAULT_FROM_EMAIL in your .env file (e.g. OVH SMTP).
"""
from __future__ import annotations

import logging
from typing import Iterable, Optional

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string

from ..models import User

logger = logging.getLogger(__name__)


def _frontend_url(path: str = "") -> str:
    base = getattr(settings, "FRONTEND_URL", "https://influconnect.fr").rstrip("/")
    if not path:
        return base
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{base}/{path.lstrip('/')}"


def _normalize_language(language: str | None) -> str:
    if (language or "").lower().startswith("fr"):
        return "fr"
    return "en"


def _resolve_language(language: str | None, email: str | None = None) -> str:
    if language:
        return _normalize_language(language)
    if email:
        user = User.objects.filter(email__iexact=email).only("language_preference").first()
        if user:
            return _normalize_language(user.language_preference)
    return "en"


def build_transactional_email_html(
    *,
    title: str,
    greeting: str,
    paragraphs: list[str],
    cta_label: str | None = None,
    cta_url: str | None = None,
    footer_note: str | None = None,
) -> str:
    return render_to_string(
        "emails/transactional_base.html",
        {
            "title": title,
            "greeting": greeting,
            "paragraphs": paragraphs,
            "cta_label": cta_label,
            "cta_url": cta_url,
            "footer_note": footer_note,
        },
    )


def send(
    *,
    to: Iterable[str] | str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    fail_silently: bool = True,
) -> bool:
    if isinstance(to, str):
        recipients = [to]
    else:
        recipients = [r for r in to if r]
    if not recipients:
        return False
    try:
        send_mail(
            subject=subject,
            message=body_text,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@influconnect.fr"),
            recipient_list=recipients,
            html_message=body_html,
            fail_silently=fail_silently,
        )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.exception("Email send failed: %s", exc)
        return False


def send_team_invitation(
    *,
    invited_email: str,
    inviter_name: str,
    organization_name: str,
    role: str,
    scope_summary_fr: str,
    scope_summary_en: str,
    accept_url: str,
    expires_days: int,
    personal_message: str = "",
) -> bool:
    lang = _resolve_language(None, invited_email)
    is_fr = lang == "fr"
    role_fr = "administrateur" if role == "admin" else "membre"
    role_en = "administrator" if role == "admin" else "member"

    if is_fr:
        subject = f"{inviter_name} vous invite à rejoindre {organization_name} sur InfluConnect"
        paragraphs = [
            f"{inviter_name} vous invite à rejoindre l'espace de travail "
            f"{organization_name} sur InfluConnect en tant que {role_fr}.",
            f"Accès : {scope_summary_fr}.",
        ]
        if personal_message:
            paragraphs.append(f"Message : « {personal_message} »")
        paragraphs.append(
            f"Cette invitation expire dans {expires_days} jours. "
            "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email."
        )
        body_text = (
            f"Bonjour,\n\n"
            f"{inviter_name} vous invite à rejoindre {organization_name} sur InfluConnect "
            f"en tant que {role_fr}.\n"
            f"Accès : {scope_summary_fr}.\n\n"
            f"Acceptez l'invitation : {accept_url}\n\n"
            f"Cette invitation expire dans {expires_days} jours.\n\n"
            "L'équipe InfluConnect"
        )
        title = "Invitation à rejoindre une équipe"
        greeting = "Bonjour,"
        cta = "Accepter l'invitation"
    else:
        subject = f"{inviter_name} invited you to join {organization_name} on InfluConnect"
        paragraphs = [
            f"{inviter_name} invited you to join the {organization_name} "
            f"workspace on InfluConnect as a {role_en}.",
            f"Access: {scope_summary_en}.",
        ]
        if personal_message:
            paragraphs.append(f'Message: "{personal_message}"')
        paragraphs.append(
            f"This invitation expires in {expires_days} days. "
            "If you weren't expecting it, you can safely ignore this email."
        )
        body_text = (
            f"Hello,\n\n"
            f"{inviter_name} invited you to join {organization_name} on InfluConnect "
            f"as a {role_en}.\n"
            f"Access: {scope_summary_en}.\n\n"
            f"Accept the invitation: {accept_url}\n\n"
            f"This invitation expires in {expires_days} days.\n\n"
            "The InfluConnect Team"
        )
        title = "Team invitation"
        greeting = "Hello,"
        cta = "Accept the invitation"

    return send(
        to=invited_email,
        subject=subject,
        body_text=body_text,
        body_html=build_transactional_email_html(
            title=title,
            greeting=greeting,
            paragraphs=paragraphs,
            cta_label=cta,
            cta_url=accept_url,
        ),
    )


# ---------------------------------------------------------------------------
# Pre-built templates (CDC §5.1 — brand validation workflow)
# ---------------------------------------------------------------------------
def send_brand_registration_received(brand_email: str, company_name: str, language: str | None = None) -> bool:
    lang = _resolve_language(language, brand_email)
    is_fr = lang == "fr"
    return send(
        to=brand_email,
        subject=(
            "InfluConnect — Demande d'inscription reçue"
            if is_fr else
            "InfluConnect — Registration request received"
        ),
        body_text=(
            (
                f"Bonjour {company_name},\n\n"
                "Nous avons bien reçu votre demande d'inscription sur InfluConnect.\n"
                "Notre équipe va vérifier vos informations sous 48h ouvrables.\n"
                "Vous recevrez un email dès que votre compte sera validé.\n\n"
                "L'équipe InfluConnect"
            )
            if is_fr else
            (
                f"Hello {company_name},\n\n"
                "We have received your registration request on InfluConnect.\n"
                "Our team will review your information within 48 business hours.\n"
                "You will receive an email as soon as your account is approved.\n\n"
                "The InfluConnect Team"
            )
        ),
        body_html=build_transactional_email_html(
            title="Demande d'inscription reçue" if is_fr else "Registration request received",
            greeting=(f"Bonjour {company_name}," if is_fr else f"Hello {company_name},"),
            paragraphs=(
                [
                    "Nous avons bien reçu votre demande d'inscription sur InfluConnect.",
                    "Notre équipe va vérifier vos informations sous 48h ouvrables.",
                    "Vous recevrez un email dès que votre compte sera validé.",
                ]
                if is_fr else
                [
                    "We have received your registration request on InfluConnect.",
                    "Our team will review your information within 48 business hours.",
                    "You will receive an email as soon as your account is approved.",
                ]
            ),
            cta_label="Accéder à InfluConnect" if is_fr else "Open InfluConnect",
            cta_url=_frontend_url("/login"),
        ),
    )


def send_brand_validated(brand_email: str, company_name: str, language: str | None = None) -> bool:
    lang = _resolve_language(language, brand_email)
    is_fr = lang == "fr"
    return send(
        to=brand_email,
        subject=("InfluConnect — Votre compte a été validé 🎉" if is_fr else "InfluConnect — Your account has been approved 🎉"),
        body_text=(
            (
                f"Bonjour {company_name},\n\n"
                "Bonne nouvelle : votre compte marque InfluConnect a été validé !\n"
                "Vous pouvez désormais vous connecter et créer vos premières campagnes.\n\n"
                "L'équipe InfluConnect"
            )
            if is_fr else
            (
                f"Hello {company_name},\n\n"
                "Great news: your InfluConnect brand account has been approved.\n"
                "You can now sign in and create your first campaigns.\n\n"
                "The InfluConnect Team"
            )
        ),
        body_html=build_transactional_email_html(
            title=("Votre compte a été validé" if is_fr else "Your account has been approved"),
            greeting=(f"Bonjour {company_name}," if is_fr else f"Hello {company_name},"),
            paragraphs=(
                [
                    "Bonne nouvelle : votre compte marque InfluConnect a été validé.",
                    "Vous pouvez désormais vous connecter et créer vos premières campagnes.",
                ]
                if is_fr else
                [
                    "Great news: your InfluConnect brand account has been approved.",
                    "You can now sign in and create your first campaigns.",
                ]
            ),
            cta_label=("Se connecter" if is_fr else "Sign in"),
            cta_url=_frontend_url("/login"),
        ),
    )


def send_brand_rejected(brand_email: str, company_name: str, reason: str, language: str | None = None) -> bool:
    lang = _resolve_language(language, brand_email)
    is_fr = lang == "fr"
    return send(
        to=brand_email,
        subject=("InfluConnect — Votre demande d'inscription" if is_fr else "InfluConnect — Your registration request"),
        body_text=(
            (
                f"Bonjour {company_name},\n\n"
                "Après examen, votre demande d'inscription n'a pas pu être validée pour le motif suivant :\n\n"
                f"{reason}\n\n"
                "Vous pouvez corriger les informations et soumettre à nouveau votre demande.\n\n"
                "L'équipe InfluConnect"
            )
            if is_fr else
            (
                f"Hello {company_name},\n\n"
                "After review, your registration request could not be approved for the following reason:\n\n"
                f"{reason}\n\n"
                "You can update your information and submit a new request.\n\n"
                "The InfluConnect Team"
            )
        ),
        body_html=build_transactional_email_html(
            title=("Votre demande d'inscription" if is_fr else "Your registration request"),
            greeting=(f"Bonjour {company_name}," if is_fr else f"Hello {company_name},"),
            paragraphs=(
                [
                    "Après examen, votre demande d'inscription n'a pas pu être validée.",
                    f"Motif : {reason}",
                    "Vous pouvez corriger les informations et soumettre à nouveau votre demande.",
                ]
                if is_fr else
                [
                    "After review, your registration request could not be approved.",
                    f"Reason: {reason}",
                    "You can update your information and submit a new request.",
                ]
            ),
            cta_label=("Mettre à jour mon dossier" if is_fr else "Update my application"),
            cta_url=_frontend_url("/login"),
        ),
    )


def send_admin_new_brand_to_validate(admin_emails: list[str], company_name: str, brand_id: int) -> bool:
    return send(
        to=admin_emails,
        subject=f"[InfluConnect Admin] Nouvelle marque à valider — {company_name}",
        body_text=(
            f"Une nouvelle marque vient de soumettre une demande d'inscription :\n\n"
            f"Entreprise : {company_name}\n"
            f"ID marque : {brand_id}\n\n"
            f"Validez ou refusez la demande dans le back-office admin."
        ),
        body_html=build_transactional_email_html(
            title="Nouvelle marque à valider",
            greeting="Bonjour équipe admin,",
            paragraphs=[
                "Une nouvelle marque vient de soumettre une demande d'inscription.",
                f"Entreprise : {company_name}",
                f"ID marque : {brand_id}",
                "Validez ou refusez la demande dans le back-office admin.",
            ],
            cta_label="Ouvrir l'espace admin",
            cta_url=_frontend_url("/admin"),
        ),
    )


def send_proposal_received(influencer_email: str, campaign_title: str, language: str | None = None) -> bool:
    lang = _resolve_language(language, influencer_email)
    is_fr = lang == "fr"
    return send(
        to=influencer_email,
        subject=(
            f"InfluConnect — Nouvelle proposition de collaboration : {campaign_title}"
            if is_fr else
            f"InfluConnect — New collaboration proposal: {campaign_title}"
        ),
        body_text=(
            (
                "Bonjour,\n\n"
                f"Vous avez reçu une nouvelle proposition de collaboration pour la campagne « {campaign_title} ».\n"
                "Connectez-vous à votre tableau de bord pour la consulter.\n\n"
                "L'équipe InfluConnect"
            )
            if is_fr else
            (
                "Hello,\n\n"
                f"You received a new collaboration proposal for the campaign \"{campaign_title}\".\n"
                "Sign in to your dashboard to review it.\n\n"
                "The InfluConnect Team"
            )
        ),
        body_html=build_transactional_email_html(
            title=("Nouvelle proposition de collaboration" if is_fr else "New collaboration proposal"),
            greeting=("Bonjour," if is_fr else "Hello,"),
            paragraphs=(
                [
                    f"Vous avez reçu une nouvelle proposition pour la campagne « {campaign_title} ».",
                    "Connectez-vous à votre tableau de bord pour la consulter.",
                ]
                if is_fr else
                [
                    f"You received a new proposal for campaign \"{campaign_title}\".",
                    "Sign in to your dashboard to review it.",
                ]
            ),
            cta_label=("Voir mes propositions" if is_fr else "View my proposals"),
            cta_url=_frontend_url("/influencer/proposals"),
        ),
    )


def send_escrow_funded(influencer_email: str, amount_eur, campaign_title: str, language: str | None = None) -> bool:
    lang = _resolve_language(language, influencer_email)
    is_fr = lang == "fr"
    return send(
        to=influencer_email,
        subject=("InfluConnect — Fonds séquestrés pour votre collaboration ✅" if is_fr else "InfluConnect — Escrow funded for your collaboration ✅"),
        body_text=(
            (
                "Bonjour,\n\n"
                f"Bonne nouvelle : la marque a versé {amount_eur} € sur le compte séquestre pour la campagne "
                f"« {campaign_title} ».\nVous pouvez désormais commencer la création du contenu en toute sérénité.\n\n"
                "Les fonds vous seront versés automatiquement après validation du contenu.\n\n"
                "L'équipe InfluConnect"
            )
            if is_fr else
            (
                "Hello,\n\n"
                f"Great news: the brand funded {amount_eur} EUR in escrow for campaign \"{campaign_title}\".\n"
                "You can now start content production with confidence.\n\n"
                "Funds will be released automatically once content is approved.\n\n"
                "The InfluConnect Team"
            )
        ),
        body_html=build_transactional_email_html(
            title=("Fonds séquestrés confirmés" if is_fr else "Escrow funded"),
            greeting=("Bonjour," if is_fr else "Hello,"),
            paragraphs=(
                [
                    f"La marque a versé {amount_eur} € sur le compte séquestre pour la campagne « {campaign_title} ».",
                    "Vous pouvez commencer la création du contenu en toute sérénité.",
                    "Les fonds vous seront versés automatiquement après validation du contenu.",
                ]
                if is_fr else
                [
                    f"The brand funded {amount_eur} EUR in escrow for campaign \"{campaign_title}\".",
                    "You can now start content production with confidence.",
                    "Funds will be released automatically once content is approved.",
                ]
            ),
            cta_label=("Ouvrir mon tableau de bord" if is_fr else "Open my dashboard"),
            cta_url=_frontend_url("/influencer"),
        ),
    )


def send_payment_released(influencer_email: str, net_amount_eur, campaign_title: str, language: str | None = None) -> bool:
    lang = _resolve_language(language, influencer_email)
    is_fr = lang == "fr"
    return send(
        to=influencer_email,
        subject=("InfluConnect — Paiement libéré 💸" if is_fr else "InfluConnect — Payment released 💸"),
        body_text=(
            (
                "Bonjour,\n\n"
                f"Votre paiement de {net_amount_eur} € (net de commission) pour la campagne "
                f"« {campaign_title} » vient d'être libéré et transféré.\n\n"
                "L'équipe InfluConnect"
            )
            if is_fr else
            (
                "Hello,\n\n"
                f"Your payment of {net_amount_eur} EUR (net of commission) for campaign \"{campaign_title}\" has been released and transferred.\n\n"
                "The InfluConnect Team"
            )
        ),
        body_html=build_transactional_email_html(
            title=("Paiement libéré" if is_fr else "Payment released"),
            greeting=("Bonjour," if is_fr else "Hello,"),
            paragraphs=[
                (
                    f"Votre paiement de {net_amount_eur} € (net de commission) pour la campagne « {campaign_title} » vient d'être libéré et transféré."
                    if is_fr else
                    f"Your payment of {net_amount_eur} EUR (net of commission) for campaign \"{campaign_title}\" has been released and transferred."
                )
            ],
            cta_label=("Voir mes paiements" if is_fr else "View my payments"),
            cta_url=_frontend_url("/influencer/earnings"),
        ),
    )


def send_contract_ready_for_signature(
    recipient_email: str, role: str, campaign_title: str, language: str | None = None,
) -> bool:
    """role: 'brand' or 'influencer' — indicates who is asked to sign now."""
    who = "marque" if role == "brand" else "influenceur"
    lang = _resolve_language(language, recipient_email)
    is_fr = lang == "fr"
    return send(
        to=recipient_email,
        subject=(
            f"InfluConnect — Contrat prêt à signer ({campaign_title})"
            if is_fr else
            f"InfluConnect — Contract ready to sign ({campaign_title})"
        ),
        body_text=(
            (
                "Bonjour,\n\n"
                f"Le contrat pour la campagne « {campaign_title} » est prêt et attend votre signature ({who}).\n"
                "Connectez-vous à votre tableau de bord pour le consulter et le signer électroniquement.\n\n"
                "L'équipe InfluConnect"
            )
            if is_fr else
            (
                "Hello,\n\n"
                f"The contract for campaign \"{campaign_title}\" is ready and waiting for your signature ({'brand' if role == 'brand' else 'influencer'}).\n"
                "Sign in to your dashboard to review and sign it electronically.\n\n"
                "The InfluConnect Team"
            )
        ),
        body_html=build_transactional_email_html(
            title=("Contrat prêt à signer" if is_fr else "Contract ready to sign"),
            greeting=("Bonjour," if is_fr else "Hello,"),
            paragraphs=(
                [
                    f"Le contrat pour la campagne « {campaign_title} » est prêt et attend votre signature ({who}).",
                    "Connectez-vous à votre tableau de bord pour le consulter et le signer électroniquement.",
                ]
                if is_fr else
                [
                    f"The contract for campaign \"{campaign_title}\" is ready and waiting for your signature ({'brand' if role == 'brand' else 'influencer'}).",
                    "Sign in to your dashboard to review and sign it electronically.",
                ]
            ),
            cta_label=("Signer le contrat" if is_fr else "Sign contract"),
            cta_url=_frontend_url("/contracts"),
        ),
    )


def send_contract_signed_both(
    recipient_email: str, campaign_title: str, pdf_url: str | None = None, language: str | None = None,
) -> bool:
    lang = _resolve_language(language, recipient_email)
    is_fr = lang == "fr"
    body = (
        (
            "Bonjour,\n\n"
            f"Le contrat pour la campagne « {campaign_title} » est désormais signé par les deux parties.\n"
        )
        if is_fr else
        (
            "Hello,\n\n"
            f"The contract for campaign \"{campaign_title}\" is now signed by both parties.\n"
        )
    )
    if pdf_url:
        body += (
            f"Vous pouvez télécharger la version finale ici : {pdf_url}\n\n"
            if is_fr else
            f"You can download the final version here: {pdf_url}\n\n"
        )
    body += "L'équipe InfluConnect" if is_fr else "The InfluConnect Team"
    return send(
        to=recipient_email,
        subject=(f"InfluConnect — Contrat signé ({campaign_title})" if is_fr else f"InfluConnect — Contract signed ({campaign_title})"),
        body_text=body,
        body_html=build_transactional_email_html(
            title=("Contrat signé par les deux parties" if is_fr else "Contract signed by both parties"),
            greeting=("Bonjour," if is_fr else "Hello,"),
            paragraphs=[
                (
                    f"Le contrat pour la campagne « {campaign_title} » est désormais signé par les deux parties."
                    if is_fr else
                    f"The contract for campaign \"{campaign_title}\" is now signed by both parties."
                ),
            ],
            cta_label=(("Télécharger le contrat final" if is_fr else "Download final contract") if pdf_url else None),
            cta_url=pdf_url,
        ),
    )


def send_content_submitted_to_brand(
    brand_email: str, campaign_title: str, influencer_name: str, language: str | None = None,
) -> bool:
    lang = _resolve_language(language, brand_email)
    is_fr = lang == "fr"
    return send(
        to=brand_email,
        subject=(
            f"InfluConnect — Contenu soumis pour validation ({campaign_title})"
            if is_fr else
            f"InfluConnect — Content submitted for review ({campaign_title})"
        ),
        body_text=(
            (
                f"Bonjour,\n\n"
                f"{influencer_name} vient de soumettre le contenu pour la campagne « {campaign_title} ».\n"
                "Connectez-vous à votre tableau de bord pour le valider ou demander des modifications.\n\n"
                "L'équipe InfluConnect"
            )
            if is_fr else
            (
                "Hello,\n\n"
                f"{influencer_name} just submitted content for campaign \"{campaign_title}\".\n"
                "Sign in to your dashboard to approve it or request changes.\n\n"
                "The InfluConnect Team"
            )
        ),
        body_html=build_transactional_email_html(
            title=("Contenu soumis pour validation" if is_fr else "Content submitted for review"),
            greeting=("Bonjour," if is_fr else "Hello,"),
            paragraphs=(
                [
                    f"{influencer_name} vient de soumettre le contenu pour la campagne « {campaign_title} ».",
                    "Connectez-vous à votre tableau de bord pour le valider ou demander des modifications.",
                ]
                if is_fr else
                [
                    f"{influencer_name} just submitted content for campaign \"{campaign_title}\".",
                    "Sign in to your dashboard to approve it or request changes.",
                ]
            ),
            cta_label=("Valider le contenu" if is_fr else "Review content"),
            cta_url=_frontend_url("/brand/campaigns"),
        ),
    )


def send_content_validated(influencer_email: str, campaign_title: str, language: str | None = None) -> bool:
    lang = _resolve_language(language, influencer_email)
    is_fr = lang == "fr"
    return send(
        to=influencer_email,
        subject=(f"InfluConnect — Contenu validé ({campaign_title})" if is_fr else f"InfluConnect — Content approved ({campaign_title})"),
        body_text=(
            (
                "Bonjour,\n\n"
                f"Bonne nouvelle : votre contenu pour la campagne « {campaign_title} » a été validé.\n"
                "Le paiement va être libéré sous peu.\n\n"
                "L'équipe InfluConnect"
            )
            if is_fr else
            (
                "Hello,\n\n"
                f"Great news: your content for campaign \"{campaign_title}\" has been approved.\n"
                "Payment will be released shortly.\n\n"
                "The InfluConnect Team"
            )
        ),
        body_html=build_transactional_email_html(
            title=("Contenu validé" if is_fr else "Content approved"),
            greeting=("Bonjour," if is_fr else "Hello,"),
            paragraphs=(
                [
                    f"Bonne nouvelle : votre contenu pour la campagne « {campaign_title} » a été validé.",
                    "Le paiement va être libéré sous peu.",
                ]
                if is_fr else
                [
                    f"Great news: your content for campaign \"{campaign_title}\" has been approved.",
                    "Payment will be released shortly.",
                ]
            ),
            cta_label=("Voir mes collaborations" if is_fr else "View my collaborations"),
            cta_url=_frontend_url("/influencer/proposals"),
        ),
    )


def send_password_reset(user_email: str, reset_url: str, language: str | None = None) -> bool:
    lang = _resolve_language(language, user_email)
    is_fr = lang == "fr"
    return send(
        to=user_email,
        subject=("InfluConnect — Réinitialisation de votre mot de passe" if is_fr else "InfluConnect — Reset your password"),
        body_text=(
            (
                "Bonjour,\n\n"
                "Vous avez demandé la réinitialisation de votre mot de passe.\n"
                f"Cliquez sur le lien suivant (valide 1h) : {reset_url}\n\n"
                "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n\n"
                "L'équipe InfluConnect"
            )
            if is_fr else
            (
                "Hello,\n\n"
                "A password reset was requested for your account.\n"
                f"Use this link within 1 hour: {reset_url}\n\n"
                "If you did not request this, you can ignore this email.\n\n"
                "The InfluConnect Team"
            )
        ),
        body_html=build_transactional_email_html(
            title=("Réinitialisation de votre mot de passe" if is_fr else "Reset your password"),
            greeting=("Bonjour," if is_fr else "Hello,"),
            paragraphs=(
                [
                    "Vous avez demandé la réinitialisation de votre mot de passe.",
                    "Ce lien est valide pendant 1 heure.",
                ]
                if is_fr else
                [
                    "A password reset was requested for your account.",
                    "This link is valid for 1 hour.",
                ]
            ),
            cta_label=("Réinitialiser mon mot de passe" if is_fr else "Reset my password"),
            cta_url=reset_url,
            footer_note=(
                "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message."
                if is_fr else
                "If you did not request this, you can ignore this email."
            ),
        ),
    )


def send_mfa_reset(user_email: str, reset_url: str, language: str | None = None) -> bool:
    lang = _resolve_language(language, user_email)
    is_fr = lang == "fr"
    return send(
        to=user_email,
        subject=("InfluConnect — Réinitialisation de la double authentification" if is_fr else "InfluConnect — Reset two-factor authentication"),
        body_text=(
            (
                "Bonjour,\n\n"
                "Vous avez demandé la désactivation de la double authentification (TOTP).\n"
                f"Cliquez sur le lien suivant (valide 1h) pour confirmer : {reset_url}\n\n"
                "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message et changez "
                "immédiatement votre mot de passe.\n\n"
                "L'équipe InfluConnect"
            )
            if is_fr else
            (
                "Hello,\n\n"
                "A request was made to disable your two-factor authentication (TOTP).\n"
                f"Use this link within 1 hour to confirm: {reset_url}\n\n"
                "If you did not request this, ignore this email and change your password immediately.\n\n"
                "The InfluConnect Team"
            )
        ),
        body_html=build_transactional_email_html(
            title=("Réinitialisation de la double authentification" if is_fr else "Reset two-factor authentication"),
            greeting=("Bonjour," if is_fr else "Hello,"),
            paragraphs=(
                [
                    "Vous avez demandé la désactivation de la double authentification (TOTP).",
                    "Ce lien est valide pendant 1 heure.",
                ]
                if is_fr else
                [
                    "A request was made to disable your two-factor authentication (TOTP).",
                    "This link is valid for 1 hour.",
                ]
            ),
            cta_label=("Réinitialiser ma 2FA" if is_fr else "Reset my 2FA"),
            cta_url=reset_url,
            footer_note=(
                "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message et changez immédiatement votre mot de passe."
                if is_fr else
                "If you did not request this, ignore this email and change your password immediately."
            ),
        ),
    )


def send_event_invitation(
    influencer_email: str,
    event_title: str,
    event_address: str,
    starts_at_label: str,
    rsvp_url: str,
    max_plus_ones: int,
    language: str | None = None,
) -> bool:
    lang = _resolve_language(language, influencer_email)
    is_fr = lang == "fr"
    return send(
        to=influencer_email,
        subject=(f"InfluConnect — Invitation événement : {event_title}" if is_fr else f"InfluConnect — Event invitation: {event_title}"),
        body_text=(
            (
                "Bonjour,\n\n"
                f"Vous êtes invité(e) à l'événement « {event_title} ».\n"
                f"Adresse : {event_address}\n"
                f"Date : {starts_at_label}\n"
                f"Accompagnants autorisés : +{max_plus_ones}\n\n"
                f"Répondre à l'invitation : {rsvp_url}\n\n"
                "L'équipe InfluConnect"
            )
            if is_fr else
            (
                "Hello,\n\n"
                f"You are invited to the event \"{event_title}\".\n"
                f"Address: {event_address}\n"
                f"Date: {starts_at_label}\n"
                f"Allowed guests: +{max_plus_ones}\n\n"
                f"RSVP here: {rsvp_url}\n\n"
                "The InfluConnect Team"
            )
        ),
        body_html=build_transactional_email_html(
            title=("Invitation événement" if is_fr else "Event invitation"),
            greeting=("Bonjour," if is_fr else "Hello,"),
            paragraphs=(
                [
                    f"Vous êtes invité(e) à l'événement « {event_title} ».",
                    f"Adresse : {event_address}",
                    f"Date : {starts_at_label}",
                    f"Accompagnants autorisés : +{max_plus_ones}",
                ]
                if is_fr else
                [
                    f"You are invited to event \"{event_title}\".",
                    f"Address: {event_address}",
                    f"Date: {starts_at_label}",
                    f"Allowed guests: +{max_plus_ones}",
                ]
            ),
            cta_label=("Répondre à l'invitation" if is_fr else "RSVP to event"),
            cta_url=rsvp_url,
        ),
    )


def send_event_rsvp_confirmation(
    recipient_email: str,
    event_title: str,
    status_label: str,
    plus_ones_confirmed: int,
    language: str | None = None,
) -> bool:
    lang = _resolve_language(language, recipient_email)
    is_fr = lang == "fr"
    return send(
        to=recipient_email,
        subject=(f"InfluConnect — RSVP confirmé ({event_title})" if is_fr else f"InfluConnect — RSVP confirmed ({event_title})"),
        body_text=(
            (
                "Bonjour,\n\n"
                f"Votre réponse à l'événement « {event_title} » a été enregistrée : {status_label}.\n"
                f"Accompagnants confirmés : +{plus_ones_confirmed}\n\n"
                "L'équipe InfluConnect"
            )
            if is_fr else
            (
                "Hello,\n\n"
                f"Your response for event \"{event_title}\" has been recorded: {status_label}.\n"
                f"Confirmed guests: +{plus_ones_confirmed}\n\n"
                "The InfluConnect Team"
            )
        ),
        body_html=build_transactional_email_html(
            title=("RSVP confirmé" if is_fr else "RSVP confirmed"),
            greeting=("Bonjour," if is_fr else "Hello,"),
            paragraphs=(
                [
                    f"Votre réponse à l'événement « {event_title} » a été enregistrée : {status_label}.",
                    f"Accompagnants confirmés : +{plus_ones_confirmed}",
                ]
                if is_fr else
                [
                    f"Your response for event \"{event_title}\" has been recorded: {status_label}.",
                    f"Confirmed guests: +{plus_ones_confirmed}",
                ]
            ),
            cta_label=("Voir mes événements" if is_fr else "View my events"),
            cta_url=_frontend_url("/influencer/events"),
        ),
    )
