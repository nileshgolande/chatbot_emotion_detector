from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Conversation, Message

WELCOME_TITLE = "Welcome"
# First-time chat: list preview matches mock (“Try the WhatsApp-style background…”); one welcoming bubble.
WELCOME_BOT_MESSAGE = (
    "Try the WhatsApp-style background — Hi there 💛, welcome! ✨ I'm glad you're here 🫧 "
    "Say what's on your mind when you're ready."
)


@receiver(post_save, sender=User)
def create_welcome_conversation(sender, instance, created, **kwargs):
    if not created:
        return
    convo = Conversation.objects.create(user=instance, title=WELCOME_TITLE)
    Message.objects.create(conversation=convo, sender="bot", content=WELCOME_BOT_MESSAGE)
