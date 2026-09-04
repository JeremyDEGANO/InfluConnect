"""
Simple FR↔EN translation service using DeepL Free API.
Falls back to the original text when:
  - DEEPL_API_KEY is not configured
  - the request fails (network error, quota exceeded, …)
  - source and target language are identical

Two-level cache:
  L1 — in-process dict (fast, reset on restart)
  L2 — TranslationCache DB table (persistent across restarts)
"""
import hashlib
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# L1 in-process cache (avoids repeated DB hits in same process)
_cache: dict[str, str] = {}


def translate(text: str, target_lang: str) -> str:
    """
    Translate *text* to *target_lang* (e.g. 'EN', 'FR').
    Returns the original text unchanged on any failure.
    """
    if not text or not text.strip():
        return text

    api_key: str = getattr(settings, "DEEPL_API_KEY", "") or ""
    if not api_key:
        return text  # Not configured — silent no-op

    target = target_lang.upper()
    cache_key = hashlib.sha256(f"{text}\x00{target}".encode()).hexdigest()

    # L1 — in-process
    if cache_key in _cache:
        return _cache[cache_key]

    # L2 — DB (imported late to avoid AppRegistryNotReady at module load)
    try:
        from api.models import TranslationCache
        entry = TranslationCache.objects.filter(cache_key=cache_key).first()
        if entry:
            _cache[cache_key] = entry.translated_text
            return entry.translated_text
    except Exception:
        pass  # DB not ready yet — skip L2 silently

    # Call DeepL API
    try:
        resp = requests.post(
            "https://api-free.deepl.com/v2/translate",
            headers={"Authorization": f"DeepL-Auth-Key {api_key}"},
            data={"text": text, "target_lang": target},
            timeout=5,
        )
        resp.raise_for_status()
        result = resp.json()["translations"][0]
        translated: str = result["text"]

        # Persist to L1 and L2
        _cache[cache_key] = translated
        try:
            from api.models import TranslationCache
            TranslationCache.objects.get_or_create(
                cache_key=cache_key,
                defaults={"translated_text": translated},
            )
        except Exception:
            pass  # Non-blocking — cache failure should not break the response

        return translated
    except Exception as exc:  # noqa: BLE001
        logger.warning("DeepL translation failed: %s", exc)
        return text
