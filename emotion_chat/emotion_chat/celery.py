import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "emotion_chat.settings")

app = Celery("emotion_chat")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
