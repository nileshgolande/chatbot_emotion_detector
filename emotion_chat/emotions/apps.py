import logging
import os
import threading

from django.apps import AppConfig

logger = logging.getLogger(__name__)

_warmup_thread_lock = threading.Lock()
_warmup_thread_started = False


class EmotionsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "emotions"

    def ready(self) -> None:
        global _warmup_thread_started
        if os.environ.get("EMOTION_DISABLE_WARMUP", "").strip().lower() in (
            "1",
            "true",
            "yes",
        ):
            return
        with _warmup_thread_lock:
            if _warmup_thread_started:
                return
            _warmup_thread_started = True

        def _run() -> None:
            try:
                from emotions.emotion_detector import warmup_emotion_classifier

                warmup_emotion_classifier()
                logger.info("Emotion classifier warmup finished")
            except Exception:
                logger.exception("Emotion classifier warmup thread failed")

        threading.Thread(target=_run, daemon=True).start()
