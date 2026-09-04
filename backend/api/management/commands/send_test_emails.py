"""One-off command to fire a live copy of every transactional email template
at a test inbox, using the real configured SMTP backend (e.g. OVH)."""
from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from api.services import email_service


class Command(BaseCommand):
    help = "Send a live test copy of every transactional email template to a given address."

    def add_arguments(self, parser):
        parser.add_argument(
            "--to", default="jeremy.degano@gmail.com",
            help="Recipient email address for all test sends (default: jeremy.degano@gmail.com).",
        )
        parser.add_argument(
            "--lang", default="fr", choices=["fr", "en"],
            help="Language variant to render (default: fr).",
        )

    def handle(self, *args, **options):
        to = options["to"]
        lang = options["lang"]
        results: list[tuple[str, bool]] = []

        def run(label, fn, *fargs, **fkwargs):
            try:
                ok = bool(fn(*fargs, **fkwargs))
            except Exception as exc:  # noqa: BLE001
                ok = False
                self.stderr.write(self.style.ERROR(f"{label}: EXCEPTION {exc}"))
            results.append((label, ok))
            style = self.style.SUCCESS if ok else self.style.WARNING
            self.stdout.write(style(f"{label}: {'sent' if ok else 'FAILED'}"))

        run("brand_registration_received", email_service.send_brand_registration_received,
            to, "ACME Corp", language=lang)
        run("brand_validated", email_service.send_brand_validated,
            to, "ACME Corp", language=lang)
        run("brand_rejected", email_service.send_brand_rejected,
            to, "ACME Corp", "SIRET invalide", language=lang)
        run("admin_new_brand_to_validate", email_service.send_admin_new_brand_to_validate,
            [to], "ACME Corp", 42)
        run("proposal_received", email_service.send_proposal_received,
            to, "Campagne Été", language=lang)
        run("escrow_funded", email_service.send_escrow_funded,
            to, 500, "Campagne Été", language=lang)
        run("payment_released", email_service.send_payment_released,
            to, 425, "Campagne Été", language=lang)
        run("contract_ready_for_signature (influencer)", email_service.send_contract_ready_for_signature,
            to, "influencer", "Campagne Été", language=lang)
        run("contract_ready_for_signature (brand)", email_service.send_contract_ready_for_signature,
            to, "brand", "Campagne Été", language=lang)
        run("contract_signed_both", email_service.send_contract_signed_both,
            to, "Campagne Été", "https://influconnect.fr/contracts/final.pdf", language=lang)
        run("content_submitted_to_brand", email_service.send_content_submitted_to_brand,
            to, "Campagne Été", "Alex Créateur", language=lang)
        run("content_validated", email_service.send_content_validated,
            to, "Campagne Été", language=lang)
        run("password_reset", email_service.send_password_reset,
            to, "https://influconnect.fr/reset-password?token=test-token", language=lang)
        run("mfa_reset", email_service.send_mfa_reset,
            to, "https://influconnect.fr/reset-mfa?token=test-token", language=lang)
        run("event_invitation", email_service.send_event_invitation,
            to, "Soirée Créateurs InfluConnect", "12 rue de la Paix, 75002 Paris",
            "15 octobre 2026 à 19h00", "https://influconnect.fr/events/1/rsvp", 1, language=lang)
        run("event_rsvp_confirmation", email_service.send_event_rsvp_confirmation,
            to, "Soirée Créateurs InfluConnect", "Confirmé", 1, language=lang)
        run("team_invitation", email_service.send_team_invitation,
            invited_email=to, inviter_name="Jérémy", organization_name="InfluConnect Demo",
            role="member", scope_summary_fr="Accès à toutes les campagnes",
            scope_summary_en="Access to all campaigns",
            accept_url="https://influconnect.fr/team/accept?token=test-token",
            expires_days=7, personal_message="Bienvenue dans l'équipe !")

        total = len(results)
        sent = sum(1 for _, ok in results if ok)
        self.stdout.write(self.style.SUCCESS(f"\n{sent}/{total} template emails sent to {to}."))
        if sent < total:
            failed = ", ".join(label for label, ok in results if not ok)
            raise CommandError(f"Some templates failed to send: {failed}")
