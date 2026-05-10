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

logger = logging.getLogger(__name__)


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


# ---------------------------------------------------------------------------
# Pre-built templates (CDC §5.1 — brand validation workflow)
# ---------------------------------------------------------------------------
def send_brand_registration_received(brand_email: str, company_name: str) -> bool:
    return send(
        to=brand_email,
        subject="InfluConnect — Demande d'inscription reçue",
        body_text=(
            f"Bonjour {company_name},\n\n"
            "Nous avons bien reçu votre demande d'inscription sur InfluConnect.\n"
            "Notre équipe va vérifier vos informations sous 48h ouvrables.\n"
            "Vous recevrez un email dès que votre compte sera validé.\n\n"
            "L'équipe InfluConnect"
        ),
    )


def send_brand_validated(brand_email: str, company_name: str) -> bool:
    return send(
        to=brand_email,
        subject="InfluConnect — Votre compte a été validé 🎉",
        body_text=(
            f"Bonjour {company_name},\n\n"
            "Bonne nouvelle : votre compte marque InfluConnect a été validé !\n"
            "Vous pouvez désormais vous connecter et créer vos premières campagnes.\n\n"
            "L'équipe InfluConnect"
        ),
    )


def send_brand_rejected(brand_email: str, company_name: str, reason: str) -> bool:
    return send(
        to=brand_email,
        subject="InfluConnect — Votre demande d'inscription",
        body_text=(
            f"Bonjour {company_name},\n\n"
            "Après examen, votre demande d'inscription n'a pas pu être validée pour le motif suivant :\n\n"
            f"{reason}\n\n"
            "Vous pouvez corriger les informations et soumettre à nouveau votre demande.\n\n"
            "L'équipe InfluConnect"
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
    )


def send_proposal_received(influencer_email: str, campaign_title: str) -> bool:
    return send(
        to=influencer_email,
        subject=f"InfluConnect — Nouvelle proposition de collaboration : {campaign_title}",
        body_text=(
            "Bonjour,\n\n"
            f"Vous avez reçu une nouvelle proposition de collaboration pour la campagne « {campaign_title} ».\n"
            "Connectez-vous à votre tableau de bord pour la consulter.\n\n"
            "L'équipe InfluConnect"
        ),
    )


def send_escrow_funded(influencer_email: str, amount_eur, campaign_title: str) -> bool:
    return send(
        to=influencer_email,
        subject="InfluConnect — Fonds séquestrés pour votre collaboration ✅",
        body_text=(
            "Bonjour,\n\n"
            f"Bonne nouvelle : la marque a versé {amount_eur} € sur le compte séquestre pour la campagne "
            f"« {campaign_title} ».\nVous pouvez désormais commencer la création du contenu en toute sérénité.\n\n"
            "Les fonds vous seront versés automatiquement après validation du contenu.\n\n"
            "L'équipe InfluConnect"
        ),
    )


def send_payment_released(influencer_email: str, net_amount_eur, campaign_title: str) -> bool:
    return send(
        to=influencer_email,
        subject="InfluConnect — Paiement libéré 💸",
        body_text=(
            "Bonjour,\n\n"
            f"Votre paiement de {net_amount_eur} € (net de commission) pour la campagne "
            f"« {campaign_title} » vient d'être libéré et transféré.\n\n"
            "L'équipe InfluConnect"
        ),
    )


def send_contract_ready_for_signature(recipient_email: str, role: str, campaign_title: str) -> bool:
    """role: 'brand' or 'influencer' — indicates who is asked to sign now."""
    who = "marque" if role == "brand" else "influenceur"
    return send(
        to=recipient_email,
        subject=f"InfluConnect — Contrat prêt à signer ({campaign_title})",
        body_text=(
            "Bonjour,\n\n"
            f"Le contrat pour la campagne « {campaign_title} » est prêt et attend votre signature ({who}).\n"
            "Connectez-vous à votre tableau de bord pour le consulter et le signer électroniquement.\n\n"
            "L'équipe InfluConnect"
        ),
    )


def send_contract_signed_both(recipient_email: str, campaign_title: str, pdf_url: str | None = None) -> bool:
    body = (
        "Bonjour,\n\n"
        f"Le contrat pour la campagne « {campaign_title} » est désormais signé par les deux parties.\n"
    )
    if pdf_url:
        body += f"Vous pouvez télécharger la version finale ici : {pdf_url}\n\n"
    body += "L'équipe InfluConnect"
    return send(
        to=recipient_email,
        subject=f"InfluConnect — Contrat signé ({campaign_title})",
        body_text=body,
    )


def send_content_submitted_to_brand(brand_email: str, campaign_title: str, influencer_name: str) -> bool:
    return send(
        to=brand_email,
        subject=f"InfluConnect — Contenu soumis pour validation ({campaign_title})",
        body_text=(
            f"Bonjour,\n\n"
            f"{influencer_name} vient de soumettre le contenu pour la campagne « {campaign_title} ».\n"
            "Connectez-vous à votre tableau de bord pour le valider ou demander des modifications.\n\n"
            "L'équipe InfluConnect"
        ),
    )


def send_content_validated(influencer_email: str, campaign_title: str) -> bool:
    return send(
        to=influencer_email,
        subject=f"InfluConnect — Contenu validé ({campaign_title})",
        body_text=(
            "Bonjour,\n\n"
            f"Bonne nouvelle : votre contenu pour la campagne « {campaign_title} » a été validé.\n"
            "Le paiement va être libéré sous peu.\n\n"
            "L'équipe InfluConnect"
        ),
    )


def send_password_reset(user_email: str, reset_url: str) -> bool:
    return send(
        to=user_email,
        subject="InfluConnect — Réinitialisation de votre mot de passe",
        body_text=(
            "Bonjour,\n\n"
            "Vous avez demandé la réinitialisation de votre mot de passe.\n"
            f"Cliquez sur le lien suivant (valide 1h) : {reset_url}\n\n"
            "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n\n"
            "L'équipe InfluConnect"
        ),
    )


def send_mfa_reset(user_email: str, reset_url: str) -> bool:
    return send(
        to=user_email,
        subject="InfluConnect — Réinitialisation de la double authentification",
        body_text=(
            "Bonjour,\n\n"
            "Vous avez demandé la désactivation de la double authentification (TOTP).\n"
            f"Cliquez sur le lien suivant (valide 1h) pour confirmer : {reset_url}\n\n"
            "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message et changez "
            "immédiatement votre mot de passe.\n\n"
            "L'équipe InfluConnect"
        ),
    )
