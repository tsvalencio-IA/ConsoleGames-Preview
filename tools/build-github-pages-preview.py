#!/usr/bin/env python3
"""Prepare a GitHub Pages artifact for an ISOLATED ConsoleGames-Preview repository.

Do not deploy this artifact to the production ConsoleGames Pages site.  This
script changes ONLY files copied to _pages_preview; sources are never rewritten.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREVIEW_REPO = "tsvalencio-IA/ConsoleGames-Preview"
OUTPUT = ROOT / "_pages_preview"
OLD_BASE = "/ConsoleGames/"
NEW_BASE = "/ConsoleGames-Preview/"
TEXT_EXTENSIONS = {
    ".html", ".htm", ".js", ".mjs", ".css", ".json", ".webmanifest",
    ".xml", ".svg", ".txt", ".md", ".webapp",
}
EXCLUDED_DIRS = {
    ".git", ".github", ".venv", "node_modules", "__pycache__",
    "_pages_preview", "test-results", ".pytest_cache",
}
EXCLUDED_ROOT = {
    ".gitignore", "README.md", "tools", "tests",
}
SOURCE_SHA = "df28dd51f9624347330ec97dbb804804d72468bf"
FIREBASE_SDK_TAG = re.compile(r'<script\b[^>]*\bsrc=["\']https://www\.gstatic\.com/firebasejs/[^"\']+["\'][^>]*>\s*</script>', re.I)
PREVIEW_POLICY = (
    "connect-src 'self' https://cdn.jsdelivr.net https://unpkg.com "
    "https://storage.googleapis.com/mediapipe-models/ https://storage.googleapis.com/tfhub-lite-models/ "
    "https://tfhub.dev https://www.kaggle.com https://www.youtube.com https://www.youtube-nocookie.com; "
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; "
    "form-action 'self'; object-src 'none'; base-uri 'self'"
)
MINIMUM_ROUTES = (
    "index.html", "arcade/index.html", "games/otthi/index.html",
    "games/otthi/app.js", "games/otthi/style.css",
    "games/kart/index.html", "games/boxe/index.html",
    "games/tenis/index.html", "games/ar/index.html",
    "games/voo/index.html", "games/familia/3d/index.html",
    "games/danca/index.html",
)


def ignored(directory: str, names: list[str]) -> set[str]:
    excluded = EXCLUDED_DIRS.intersection(names)
    if Path(directory).resolve() == ROOT:
        excluded |= EXCLUDED_ROOT.intersection(names)
    return excluded


def prepare_document(source: str, bootstrap: str) -> str:
    source = FIREBASE_SDK_TAG.sub('', source)
    source = re.sub(r'<meta\s+charset=[^>]+>', '', source, flags=re.I)
    injection = f'\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="{PREVIEW_POLICY}">\n<script>\n{bootstrap}\n</script>\n'
    head = re.search(r'<head\b[^>]*>', source, re.I)
    if head:
        return source[:head.end()] + injection + source[head.end():]
    doctype = re.match(r'\s*<!doctype[^>]*>', source, re.I)
    start = doctype.end() if doctype else 0
    return source[:start] + '<head>' + injection + '</head>' + source[start:]


def verify_manifest() -> dict:
    world = OUTPUT / 'games' / 'otthi'
    release = json.loads((world / 'release-manifest.json').read_text('utf-8'))
    for filename, digest in release['files'].items():
        entry = (world / filename).resolve()
        if not entry.is_relative_to(OUTPUT) or hashlib.sha256(entry.read_bytes()).hexdigest() != digest:
            raise SystemExit('Hash incompatível no pacote final: ' + filename)
    return release


def main() -> None:
    if os.environ.get("GITHUB_REPOSITORY") != PREVIEW_REPO:
        raise SystemExit(
            "SAFETY STOP: GitHub Pages preview may only run in " + PREVIEW_REPO
            + ". The original ConsoleGames/main must not be deployed or changed."
        )
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)
    # Copy the existing console and all game assets without altering their source.
    for child in ROOT.iterdir():
        if child.name in EXCLUDED_DIRS or child.name in EXCLUDED_ROOT:
            continue
        target = OUTPUT / child.name
        if child.is_dir():
            shutil.copytree(child, target, ignore=ignored, symlinks=False)
        elif child.is_file():
            shutil.copy2(child, target)

    bootstrap = (ROOT / 'tools' / 'pages-preview-isolation.js').read_text('utf-8')
    changed = 0
    for item in OUTPUT.rglob("*"):
        if not item.is_file() or item.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        try:
            original = item.read_text("utf-8")
        except UnicodeError:
            continue
        # Rewrite the staged source before generating the final release hashes.
        revised = original.replace(OLD_BASE, NEW_BASE)
        if item.suffix.lower() in {'.html', '.htm'}:
            revised = prepare_document(revised, bootstrap)
        elif item.name == 'sw.js':
            revised = "'use strict';\n" + bootstrap + '\n' + revised
        elif item.name == 'firebase-config.js':
            revised = 'window.OTTHOS_FIREBASE_CONFIG = Object.freeze({enabled: false});\n'
        if revised != original:
            item.write_text(revised, encoding="utf-8")
            changed += 1

    subprocess.run([sys.executable, str(OUTPUT / 'games/otthi/tools/build_project.py')], check=True)
    release = verify_manifest()
    git_sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    metadata = {'source': SOURCE_SHA, 'commit': git_sha, 'build': release['build'],
                'revision': release['revision'], 'storagePrefix': 'consolegames-preview:', 'firebase': 'disabled'}
    (OUTPUT / 'preview-release.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    (OUTPUT / ".nojekyll").write_text("", encoding="utf-8")
    for route in MINIMUM_ROUTES:
        if not (OUTPUT / route).is_file():
            raise SystemExit("Missing game route in Pages artifact: " + route)

    print(f"Prepared {OUTPUT}: {changed} text files adapted, {len(release['files'])} final hashes verified.")
    print(f"Pages preview {release['build']} / {release['revision']} with isolated local storage and disconnected Firebase.")


if __name__ == "__main__":
    main()
