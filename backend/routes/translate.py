"""Translate API routes."""
import json
import logging
from time import perf_counter

import requests
from flask import Blueprint, jsonify, request

import app_settings
from service import cache_store

translate_bp = Blueprint("translate", __name__, url_prefix="/api")
logger = logging.getLogger(__name__)


def _is_chinese(text: str) -> bool:
    """True if >30% characters are CJK."""
    if not text.strip():
        return False
    cjk = sum(1 for c in text if "一" <= c <= "鿿")
    return cjk / max(len(text), 1) > 0.3


def _is_short(text: str) -> bool:
    """True if ≤5 words."""
    return len(text.strip().split()) <= 5


def _build_prompt(text: str) -> str:
    """Build translation prompt based on language direction and length."""
    is_cn = _is_chinese(text)
    short = _is_short(text)

    if is_cn and short:
        return (
            "Translate this Chinese word/phrase to English.\n"
            "Return ONLY valid JSON (no markdown, no explanation):\n"
            '{"translation": "English translation", '
            '"phonetic": "Three lines separated by \\n:\\n'
            'Line1: IPA notation\\n'
            'Line2: 谐音「Chinese characters approximation」\\n'
            'Line3: English syllable respelling (stressed in UPPERCASE)\\n'
            'Examples:\\n'
            'strawberry → /ˈstrɔːbɛri/\\n谐音「斯抓伯瑞」\\nSTRAW-ber-ee\\n'
            'beautiful → /ˈbjuːtɪfəl/\\n谐音「标特否」\\nBYOO-ti-fuhl", '
            '"pos": "part of speech in English"}\n\n'
            f"Text: {text}"
        )
    if is_cn:
        return (
            "Translate the following Chinese text to fluent, natural English.\n"
            "Return ONLY valid JSON (no markdown, no explanation):\n"
            '{"translation": "the complete fluent translation"}\n\n'
            f"Text: {text}"
        )
    if short:
        return (
            "Translate this word/phrase to Simplified Chinese.\n"
            "Return ONLY valid JSON (no markdown, no explanation):\n"
            '{"translation": "中文翻译", '
            '"phonetic": "拼音 with tone marks. '
            'Format: pīn yīn (with tone marks on vowels, e.g. xī guā, měi lì, kuài lè)", '
            '"pos": "词性 in Chinese e.g. 名词/动词/形容词"}\n\n'
            f"Text: {text}"
        )
    return (
        "Translate the following text to fluent, natural Simplified Chinese.\n"
        "Return ONLY valid JSON (no markdown, no explanation):\n"
        '{"translation": "the complete fluent translation"}\n\n'
        f"Text: {text}"
    )


@translate_bp.route("/translate", methods=["POST"])
def translate():
    started = perf_counter()
    if not app_settings._DEEPSEEK_KEY:
        return jsonify({"ok": False, "error": "DeepSeek API key not configured"}), 503

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"ok": False, "error": "empty text"}), 400
    if len(text) > 5000:
        return jsonify({"ok": False, "error": "text too long (max 5000 chars)"}), 400

    prompt = _build_prompt(text)

    try:
        resp = requests.post(
            app_settings._DEEPSEEK_URL,
            headers={
                "Authorization": f"Bearer {app_settings._DEEPSEEK_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-v4-flash",
                "messages": [
                    {"role": "system", "content": "You are a professional translator. Always return valid JSON exactly as requested."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 2048,
            },
            timeout=15,
        )
        resp.raise_for_status()
        body = resp.json()
        raw = body["choices"][0]["message"]["content"].strip()

        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()

        result = json.loads(raw)
    except (json.JSONDecodeError, KeyError, requests.exceptions.RequestException) as e:
        logger.warning(
            "event=translate_failed chars=%s error_type=%s duration_ms=%.1f",
            len(text),
            type(e).__name__,
            (perf_counter() - started) * 1000,
        )
        return jsonify({"ok": False, "error": "Translation failed, please retry"}), 500

    cache_store.cache_incr("translate_count")
    source_lang = "zh" if _is_chinese(text) else "auto"
    target_lang = "en" if _is_chinese(text) else "zh"
    entry = json.dumps({"src": text[:120], "tgt": result.get("translation", "")[:120], "dir": f"{source_lang}→{target_lang}"}, ensure_ascii=False)
    cache_store.cache_lpush("translate_history", entry)
    cache_store.cache_ltrim("translate_history", 0, 199)

    short = _is_short(text)
    logger.info(
        "event=translate_success source=%s target=%s chars=%s short=%s duration_ms=%.1f",
        source_lang,
        target_lang,
        len(text),
        short,
        (perf_counter() - started) * 1000,
    )
    return jsonify({
        "ok": True,
        "translation": result.get("translation", ""),
        "phonetic": result.get("phonetic") if short else None,
        "pos": result.get("pos") if short else None,
        "is_short": short,
        "source_lang": source_lang,
        "target_lang": target_lang,
    })
