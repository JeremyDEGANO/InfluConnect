from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from api.services.email_service import build_transactional_email_html


class Command(BaseCommand):
    help = "Render HTML previews for all transactional email templates."

    def handle(self, *args, **options):
        base_dir = Path(settings.BASE_DIR)
        output_dir = base_dir / "email_previews"
        output_dir.mkdir(parents=True, exist_ok=True)

        previews = {
            "01_brand_registration_received.html": build_transactional_email_html(
                title="Demande d'inscription reçue",
                greeting="Bonjour ACME,",
                paragraphs=[
                    "Nous avons bien reçu votre demande d'inscription sur InfluConnect.",
                    "Notre équipe va vérifier vos informations sous 48h ouvrables.",
                    "Vous recevrez un email dès que votre compte sera validé.",
                ],
            ),
            "02_brand_validated.html": build_transactional_email_html(
                title="Votre compte a été validé",
                greeting="Bonjour ACME,",
                paragraphs=[
                    "Bonne nouvelle : votre compte marque InfluConnect a été validé.",
                    "Vous pouvez désormais vous connecter et créer vos premières campagnes.",
                ],
            ),
            "03_brand_rejected.html": build_transactional_email_html(
                title="Votre demande d'inscription",
                greeting="Bonjour ACME,",
                paragraphs=[
                    "Après examen, votre demande d'inscription n'a pas pu être validée.",
                    "Motif : SIRET invalide.",
                    "Vous pouvez corriger les informations et soumettre a nouveau votre demande.",
                ],
            ),
            "04_admin_new_brand.html": build_transactional_email_html(
                title="Nouvelle marque à valider",
                greeting="Bonjour équipe admin,",
                paragraphs=[
                    "Une nouvelle marque vient de soumettre une demande d'inscription.",
                    "Entreprise : ACME",
                    "ID marque : 42",
                    "Validez ou refusez la demande dans le back-office admin.",
                ],
            ),
            "05_proposal_received.html": build_transactional_email_html(
                title="Nouvelle proposition de collaboration",
                greeting="Bonjour,",
                paragraphs=[
                    "Vous avez reçu une nouvelle proposition pour la campagne « Campagne Été ».",
                    "Connectez-vous à votre tableau de bord pour la consulter.",
                ],
            ),
            "06_escrow_funded.html": build_transactional_email_html(
                title="Fonds séquestrés confirmés",
                greeting="Bonjour,",
                paragraphs=[
                    "La marque a versé 500 EUR sur le compte séquestre pour la campagne « Campagne Été ».",
                    "Vous pouvez commencer la création du contenu en toute sérénité.",
                    "Les fonds vous seront versés automatiquement après validation du contenu.",
                ],
            ),
            "07_payment_released.html": build_transactional_email_html(
                title="Paiement libéré",
                greeting="Bonjour,",
                paragraphs=[
                    "Votre paiement de 425 EUR (net de commission) pour la campagne « Campagne Été » vient d'être libéré et transféré.",
                ],
            ),
            "08_contract_ready.html": build_transactional_email_html(
                title="Contrat prêt à signer",
                greeting="Bonjour,",
                paragraphs=[
                    "Le contrat pour la campagne « Campagne Été » est prêt et attend votre signature (influenceur).",
                    "Connectez-vous à votre tableau de bord pour le consulter et le signer électroniquement.",
                ],
            ),
            "09_contract_signed.html": build_transactional_email_html(
                title="Contrat signé par les deux parties",
                greeting="Bonjour,",
                paragraphs=[
                    "Le contrat pour la campagne « Campagne Été » est désormais signé par les deux parties.",
                ],
                cta_label="Télécharger le contrat final",
                cta_url="https://influconnect.fr/contracts/final.pdf",
            ),
            "10_content_submitted.html": build_transactional_email_html(
                title="Contenu soumis pour validation",
                greeting="Bonjour,",
                paragraphs=[
                    "Alice Dupont vient de soumettre le contenu pour la campagne « Campagne Été ».",
                    "Connectez-vous à votre tableau de bord pour le valider ou demander des modifications.",
                ],
            ),
            "11_content_validated.html": build_transactional_email_html(
                title="Contenu validé",
                greeting="Bonjour,",
                paragraphs=[
                    "Bonne nouvelle : votre contenu pour la campagne « Campagne Été » a été validé.",
                    "Le paiement va être libéré sous peu.",
                ],
            ),
            "12_password_reset.html": build_transactional_email_html(
                title="Réinitialisation de votre mot de passe",
                greeting="Bonjour,",
                paragraphs=[
                    "Vous avez demandé la réinitialisation de votre mot de passe.",
                    "Ce lien est valide pendant 1 heure.",
                ],
                cta_label="Réinitialiser mon mot de passe",
                cta_url="https://influconnect.fr/reset-password/confirm#token=example",
                footer_note="Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
            ),
            "13_mfa_reset.html": build_transactional_email_html(
                title="Réinitialisation de la double authentification",
                greeting="Bonjour,",
                paragraphs=[
                    "Vous avez demandé la désactivation de la double authentification (TOTP).",
                    "Ce lien est valide pendant 1 heure.",
                ],
                cta_label="Réinitialiser ma 2FA",
                cta_url="https://influconnect.fr/security/reset-mfa#token=example",
                footer_note="Si vous n'êtes pas à l'origine de cette demande, ignorez ce message et changez immédiatement votre mot de passe.",
            ),
            "14_event_invitation.html": build_transactional_email_html(
                title="Invitation événement",
                greeting="Bonjour,",
                paragraphs=[
                    "Vous êtes invité(e) à l'événement « Influence Night 2026 ».",
                    "Adresse : 10 rue de Paris, 75001 Paris",
                    "Date : 24/06/2026 19:30",
                    "Accompagnants autorisés : +1",
                ],
                cta_label="Répondre à l'invitation",
                cta_url="https://influconnect.fr/events/rsvp/example-token",
            ),
            "15_event_rsvp_confirmation.html": build_transactional_email_html(
                title="RSVP confirmé",
                greeting="Bonjour,",
                paragraphs=[
                    "Votre réponse à l'événement « Influence Night 2026 » a été enregistrée : Présent.",
                    "Accompagnants confirmés : +1",
                ],
            ),
            "16_auth_password_reset_en.html": build_transactional_email_html(
                title="Password reset",
                greeting="Hello John,",
                paragraphs=[
                    "A password reset was requested for your account.",
                    "Click the button below within 1 hour to set a new password.",
                ],
                cta_label="Reset my password",
                cta_url="https://influconnect.fr/reset-password/confirm#token=example",
                footer_note="If you did not request this, you can ignore this email.",
            ),
            "17_auth_login_code.html": build_transactional_email_html(
                title="Code de connexion",
                greeting="Bonjour John,",
                paragraphs=[
                    "Votre code de vérification pour vous connecter est :",
                    "123456",
                    "Ce code expire dans 10 minutes.",
                ],
                footer_note="Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
            ),
            "18_auth_mfa_reset.html": build_transactional_email_html(
                title="Réinitialisation 2FA / MFA reset",
                greeting="Bonjour John,",
                paragraphs=[
                    "Une demande de réinitialisation de l'authentification à deux facteurs a été reçue pour votre compte.",
                    "Cliquez sur le bouton ci-dessous dans l'heure pour désactiver la 2FA et reconfigurer un nouvel authentificateur.",
                ],
                cta_label="Réinitialiser ma 2FA",
                cta_url="https://influconnect.fr/security/reset-mfa#token=example",
                footer_note="Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
            ),
        }

        for name, html in previews.items():
            (output_dir / name).write_text(html, encoding="utf-8")

        self.stdout.write(self.style.SUCCESS(f"Generated {len(previews)} previews in: {output_dir}"))
