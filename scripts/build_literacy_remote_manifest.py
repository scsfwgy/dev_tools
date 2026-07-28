#!/usr/bin/env python3
"""Build the production literacy manifest from CommonShell pipeline output.

The generated manifest keeps labels, pronunciation metadata, attribution, and
HTTPS media URLs. It intentionally excludes CommonShell's absolute local paths.

Development dependencies:
    python3 -m pip install pypinyin eng-to-ipa
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    import eng_to_ipa
    from pypinyin import Style, lazy_pinyin
except ImportError as error:
    raise SystemExit(
        "Install development dependencies first: "
        "python3 -m pip install pypinyin eng-to-ipa"
    ) from error


ROOT = Path(__file__).resolve().parents[1]
COMMON_SHELL = ROOT.parent / "CommonShell"
DEFAULT_PRIMARY = COMMON_SHELL / "gen-output" / "manifest.json"
DEFAULT_BACKUP = COMMON_SHELL / "gen-output_backup" / "manifest.json"
DEFAULT_OUTPUT = ROOT / "frontend" / "data" / "literacy" / "manifest.json"

IPA_OVERRIDES = {
    "lychee": "ˈliːtʃiː",
    "durian": "ˈdʊriən",
    "jackfruit": "ˈdʒækfruːt",
    "persimmon": "pərˈsɪmən",
    "ginkgo": "ˈɡɪŋkoʊ",
    "double-decker-bus": "ˌdʌbəl ˈdekər bʌs",
}


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def pronunciation(item: dict) -> dict:
    label = item["label"]
    pinyin = " ".join(
        lazy_pinyin(
            label["zh-CN"],
            style=Style.TONE,
            neutral_tone_with_five=False,
        )
    )
    ipa = IPA_OVERRIDES.get(item["id"])
    if not ipa:
        ipa = eng_to_ipa.convert(label["en"].lower())
    if "*" in ipa:
        raise ValueError(f"Unresolved English IPA for {item['id']}: {ipa}")
    return {
        "chinese": label["zh-CN"],
        "pinyin": pinyin,
        "english": label["en"],
        "ipa": f"/{ipa}/",
    }


def remote_audio(item: dict) -> dict:
    audio = item.get("audio") or {}
    urls = {
        "zh-CN": (audio.get("zh") or {}).get("oss", ""),
        "en-US": (audio.get("en") or {}).get("oss", ""),
    }
    if not all(url.startswith("https://") for url in urls.values()):
        raise ValueError(f"Missing HTTPS audio URL for {item['id']}")
    return urls


def remote_image(item: dict) -> dict | None:
    image = item.get("image")
    if not image:
        return None
    url = image.get("oss", "")
    if not url.startswith("https://"):
        raise ValueError(f"Invalid image URL for {item['id']}: {url}")
    attribution = image.get("attribution") or {}
    return {
        "url": url,
        "width": image.get("width"),
        "height": image.get("height"),
        "attribution": {
            "source": attribution.get("source", ""),
            "fileTitle": attribution.get("fileTitle", ""),
            "sourcePage": attribution.get("sourcePage", ""),
            "author": attribution.get("author", ""),
            "license": attribution.get("license", ""),
            "licenseUrl": attribution.get("licenseUrl", ""),
            "modifications": attribution.get("modifications", ""),
        },
    }


def build_category(category: dict) -> dict:
    items = []
    for source_item in category["items"]:
        spoken = pronunciation(source_item)
        items.append(
            {
                "id": source_item["id"],
                "label": source_item["label"],
                "image": remote_image(source_item),
                "pronunciation": {
                    **spoken,
                    "audio": remote_audio(source_item),
                },
            }
        )
    return {
        "id": category["category"],
        "items": items,
    }


def build(primary: Path, backup: Path) -> dict:
    sources = [read_json(primary), read_json(backup)]
    categories = []
    seen = set()
    for source in sources:
        if "oss" not in source.get("steps_completed", []):
            raise ValueError("CommonShell manifest has not completed OSS upload")
        for category in source["categories"]:
            category_id = category["category"]
            if category_id in seen:
                raise ValueError(f"Duplicate category: {category_id}")
            seen.add(category_id)
            categories.append(build_category(category))

    if seen != {"animals", "fruits", "plants", "vehicles"}:
        raise ValueError(f"Unexpected literacy categories: {sorted(seen)}")
    if any(len(category["items"]) != 40 for category in categories):
        raise ValueError("Every remote literacy category must contain 40 items")

    return {
        "schemaVersion": 1,
        "id": "literacy-remote",
        "media": {
            "mode": "remote",
            "provider": "Aliyun OSS",
            "host": "mateo-oss.oss-cn-shanghai.aliyuncs.com",
        },
        "categories": categories,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--primary", type=Path, default=DEFAULT_PRIMARY)
    parser.add_argument("--backup", type=Path, default=DEFAULT_BACKUP)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        manifest = build(args.primary, args.backup)
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    total = sum(len(category["items"]) for category in manifest["categories"])
    missing_images = sum(
        item["image"] is None
        for category in manifest["categories"]
        for item in category["items"]
    )
    print(
        f"Wrote {args.output}: {len(manifest['categories'])} categories, "
        f"{total} items, {missing_images} text-only fallbacks"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
