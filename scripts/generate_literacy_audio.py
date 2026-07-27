#!/usr/bin/env python3
"""Generate and verify static literacy pronunciation audio.

Generation uses Azure Speech only during development. The deployed literacy
tool reads the resulting MP3 files and never sends text or credentials to
Azure.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
AUDIO_ROOT = FRONTEND / "audio" / "literacy"
CORE_MANIFEST = AUDIO_ROOT / "core-manifest.json"
ANIMAL_MANIFEST = FRONTEND / "images" / "literacy" / "animals" / "manifest.json"
FRUIT_MANIFEST = FRONTEND / "images" / "literacy" / "fruits" / "manifest.json"
CATALOG_PATH = AUDIO_ROOT / "catalog.json"

VOICES = {
    "zh-CN": "zh-CN-XiaoxiaoNeural",
    "en-US": "en-US-JennyNeural",
}
OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3"
EXPECTED_CLIPS = 178
MAX_TOTAL_BYTES = 5 * 1024 * 1024


@dataclass(frozen=True)
class Job:
    source: str
    item_id: str
    locale: str
    text: str

    @property
    def voice(self) -> str:
        return VOICES[self.locale]


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_atomic(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=path.parent, delete=False
    ) as handle:
        handle.write(content)
        temporary = Path(handle.name)
    temporary.replace(path)


def build_jobs(core: dict, animals: dict, fruits: dict) -> list[Job]:
    jobs: list[Job] = []
    for item in core["numbers"]:
        pronunciation = item["pronunciation"]
        jobs.append(Job("numbers", item["id"], "zh-CN", pronunciation["chinese"]))
        jobs.append(Job("numbers", item["id"], "en-US", pronunciation["english"]))
    for item in core["letters"]:
        jobs.append(Job("letters", item["id"], "en-US", item["value"]))
    for source, manifest in (("animals", animals), ("fruits", fruits)):
        for item in manifest["items"]:
            jobs.append(Job(source, item["id"], "zh-CN", item["caption"]["zh-CN"]))
            jobs.append(
                Job(source, item["id"], "en-US", item["pronunciation"]["english"])
            )
    if len(jobs) != EXPECTED_CLIPS:
        raise ValueError(
            f"Expected {EXPECTED_CLIPS} clips, found {len(jobs)}. "
            "Update EXPECTED_CLIPS after intentionally changing the data sets."
        )
    return jobs


def azure_ssml(job: Job) -> bytes:
    language = job.locale
    voice = html.escape(job.voice, quote=True)
    text = html.escape(job.text)
    return (
        f"<speak version='1.0' xml:lang='{language}'>"
        f"<voice xml:lang='{language}' name='{voice}'>"
        f"<prosody rate='-8%'>{text}</prosody>"
        "</voice></speak>"
    ).encode("utf-8")


def synthesize(job: Job, key: str, region: str, output: Path) -> None:
    endpoint = (
        f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
    )
    request = urllib.request.Request(
        endpoint,
        data=azure_ssml(job),
        headers={
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
            "User-Agent": "Tools24-Literacy-Audio-Generator",
        },
        method="POST",
    )
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                output.write_bytes(response.read())
            return
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(
        f"Azure synthesis failed for {job.source}/{job.item_id}/{job.locale}: "
        f"{last_error}"
    )


def normalize_audio(raw_path: Path, normalized_path: Path) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required to normalize literacy audio")
    audio_filter = (
        "silenceremove=start_periods=1:start_duration=0.03:start_threshold=-50dB:"
        "stop_periods=1:stop_duration=0.18:stop_threshold=-50dB,"
        "loudnorm=I=-18:TP=-1.5:LRA=7,apad=pad_dur=0.12"
    )
    completed = subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(raw_path),
            "-af",
            audio_filter,
            "-ar",
            "24000",
            "-ac",
            "1",
            "-b:a",
            "48k",
            str(normalized_path),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode:
        raise RuntimeError(
            f"ffmpeg failed for {raw_path.name}: {completed.stderr.strip()}"
        )


def audio_duration(path: Path) -> float:
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        raise RuntimeError("ffprobe is required to verify literacy audio")
    completed = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return round(float(completed.stdout.strip()), 3)


def public_path(path: Path) -> str:
    return "/" + path.relative_to(FRONTEND).as_posix()


def assign_audio_path(
    job: Job, path: str, core: dict, animals: dict, fruits: dict
) -> None:
    if job.source == "numbers":
        item = next(item for item in core["numbers"] if item["id"] == job.item_id)
        item["pronunciation"]["audio"][job.locale] = path
        return
    if job.source == "letters":
        item = next(item for item in core["letters"] if item["id"] == job.item_id)
        item["audio"][job.locale] = path
        return
    manifest = animals if job.source == "animals" else fruits
    item = next(item for item in manifest["items"] if item["id"] == job.item_id)
    pronunciation = item["pronunciation"]
    pronunciation["chinese"] = item["caption"]["zh-CN"]
    pronunciation.setdefault("audio", {})[job.locale] = path


def generate() -> None:
    key = os.getenv("AZURE_SPEECH_KEY", "").strip()
    region = os.getenv("AZURE_SPEECH_REGION", "").strip()
    if not key or not region:
        raise RuntimeError(
            "Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION before generation"
        )

    core = read_json(CORE_MANIFEST)
    animals = read_json(ANIMAL_MANIFEST)
    fruits = read_json(FRUIT_MANIFEST)
    jobs = build_jobs(core, animals, fruits)
    catalog_clips: list[dict] = []

    with tempfile.TemporaryDirectory(prefix="literacy-audio-") as temporary:
        temp_root = Path(temporary)
        for index, job in enumerate(jobs, 1):
            raw_path = temp_root / f"{index}.raw.mp3"
            normalized_path = temp_root / f"{index}.mp3"
            print(
                f"[{index:03d}/{len(jobs)}] "
                f"{job.source}/{job.item_id}/{job.locale} {job.text}"
            )
            synthesize(job, key, region, raw_path)
            normalize_audio(raw_path, normalized_path)
            content = normalized_path.read_bytes()
            sha256 = hashlib.sha256(content).hexdigest()
            filename = f"{job.item_id}.{job.locale}.{sha256[:12]}.mp3"
            destination = AUDIO_ROOT / job.source / filename
            destination.parent.mkdir(parents=True, exist_ok=True)
            if not destination.exists():
                destination.write_bytes(content)
            path = public_path(destination)
            assign_audio_path(job, path, core, animals, fruits)
            catalog_clips.append(
                {
                    "source": job.source,
                    "id": job.item_id,
                    "locale": job.locale,
                    "text": job.text,
                    "voice": job.voice,
                    "path": path,
                    "sha256": sha256,
                    "durationSeconds": audio_duration(destination),
                    "reviewed": False,
                }
            )

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    generation = {
        "provider": "Azure Speech",
        "generatedAt": generated_at,
        "outputFormat": OUTPUT_FORMAT,
        "rate": "-8%",
        "normalization": "EBU R128 -18 LUFS, -1.5 dBTP",
        "voices": VOICES,
    }
    core["schemaVersion"] = 2
    core["audioGeneration"] = generation
    animals["schemaVersion"] = 3
    animals["audioGeneration"] = generation
    fruits["schemaVersion"] = 3
    fruits["audioGeneration"] = generation
    catalog = {
        "schemaVersion": 1,
        "id": "literacy-audio",
        "generatedAt": generated_at,
        "generation": generation,
        "clips": catalog_clips,
    }
    write_json_atomic(CORE_MANIFEST, core)
    write_json_atomic(ANIMAL_MANIFEST, animals)
    write_json_atomic(FRUIT_MANIFEST, fruits)
    write_json_atomic(CATALOG_PATH, catalog)
    print(
        f"Generated {len(catalog_clips)} clips. "
        "Run --verify, review every clip, then mark reviewed=true in catalog.json."
    )


def verify(require_reviewed: bool) -> None:
    if not CATALOG_PATH.exists():
        raise RuntimeError(
            "catalog.json does not exist; generate the Azure audio first"
        )
    catalog = read_json(CATALOG_PATH)
    clips = catalog.get("clips", [])
    if len(clips) != EXPECTED_CLIPS:
        raise RuntimeError(
            f"Expected {EXPECTED_CLIPS} catalog clips, found {len(clips)}"
        )
    total_bytes = 0
    pending = 0
    for clip in clips:
        path = FRONTEND / clip["path"].lstrip("/")
        if not path.is_file():
            raise RuntimeError(f"Missing audio file: {clip['path']}")
        content = path.read_bytes()
        total_bytes += len(content)
        digest = hashlib.sha256(content).hexdigest()
        if digest != clip["sha256"]:
            raise RuntimeError(f"SHA-256 mismatch: {clip['path']}")
        duration = audio_duration(path)
        if duration <= 0 or duration > 8:
            raise RuntimeError(
                f"Unexpected duration {duration}s: {clip['path']}"
            )
        if not clip.get("reviewed"):
            pending += 1
    if total_bytes > MAX_TOTAL_BYTES:
        raise RuntimeError(
            f"Audio totals {total_bytes / 1024 / 1024:.2f} MB; "
            "the initial budget is 5 MB"
        )
    if require_reviewed and pending:
        raise RuntimeError(f"{pending} clips still require pronunciation review")
    print(
        f"Verified {len(clips)} clips, {total_bytes / 1024 / 1024:.2f} MB, "
        f"{pending} pending review"
    )


def list_jobs(as_json: bool) -> None:
    jobs = build_jobs(
        read_json(CORE_MANIFEST),
        read_json(ANIMAL_MANIFEST),
        read_json(FRUIT_MANIFEST),
    )
    summary: dict[str, int] = {}
    for job in jobs:
        key = f"{job.source}:{job.locale}"
        summary[key] = summary.get(key, 0) + 1
    if as_json:
        print(json.dumps({"total": len(jobs), "groups": summary}, sort_keys=True))
    else:
        print(f"Total clips: {len(jobs)}")
        for name, count in sorted(summary.items()):
            print(f"  {name}: {count}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--generate", action="store_true")
    action.add_argument("--verify", action="store_true")
    action.add_argument("--list", action="store_true")
    parser.add_argument("--json", action="store_true", help="JSON output for --list")
    parser.add_argument(
        "--require-reviewed",
        action="store_true",
        help="Fail verification when any catalog clip is not reviewed",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.generate:
            generate()
        elif args.verify:
            verify(args.require_reviewed)
        else:
            list_jobs(args.json)
        return 0
    except (KeyError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
