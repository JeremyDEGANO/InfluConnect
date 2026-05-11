from django.core.management.base import BaseCommand
from api.models import Message, DirectMessage
from api.views import _encrypt_message_text


class Command(BaseCommand):
    help = 'Chiffre tous les messages non chiffrés (Message et DirectMessage) dans la base de données'

    def handle(self, *args, **kwargs):
        # --- Campaign Messages ---
        msg_total = 0
        msg_skipped = 0
        for msg in Message.objects.all():
            if msg.content and not msg.content.startswith('enc:v1:'):
                msg.content = _encrypt_message_text(msg.content)
                msg.save(update_fields=['content'])
                msg_total += 1
            else:
                msg_skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f'[Message] {msg_total} chiffrés, {msg_skipped} déjà chiffrés ou vides'
        ))

        # --- Direct Messages ---
        dm_total = 0
        dm_skipped = 0
        for dm in DirectMessage.objects.all():
            if dm.content and not dm.content.startswith('enc:v1:'):
                dm.content = _encrypt_message_text(dm.content)
                dm.save(update_fields=['content'])
                dm_total += 1
            else:
                dm_skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f'[DirectMessage] {dm_total} chiffrés, {dm_skipped} déjà chiffrés ou vides'
        ))

        self.stdout.write(self.style.SUCCESS('Chiffrement terminé.'))
