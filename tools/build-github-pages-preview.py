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
# Production Firebase is explicitly authorized for this published preview.
# Local caches, saves and service-worker scopes remain isolated by the bootstrap.
# Set OT_PAGES_FIREBASE=disabled for a disconnected recovery build.
FIREBASE_MODE = os.environ.get("OT_PAGES_FIREBASE", "enabled")
if FIREBASE_MODE not in {"enabled", "disabled"}:
    raise SystemExit("Invalid OT_PAGES_FIREBASE")
FIREBASE_ENABLED = FIREBASE_MODE == "enabled"
if FIREBASE_ENABLED:
    PREVIEW_POLICY = PREVIEW_POLICY.replace(
        "connect-src 'self'",
        "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com "
        "https://www.googleapis.com https://firebaseinstallations.googleapis.com "
        "https://otthi-656c5.firebaseapp.com https://thiaguinhogame-ac91b.firebaseapp.com "
        "https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebasedatabase.app",
        1,
    ).replace(
        "frame-src 'self'",
        "frame-src 'self' https://otthi-656c5.firebaseapp.com https://thiaguinhogame-ac91b.firebaseapp.com "
        "https://*.firebaseio.com https://*.firebasedatabase.app",
        1,
    )

# Remove only the three explicit offline-homologation guards in the staged
# source. Keep the original auth methods, account encryption and database paths.
LIVE_SOURCE_PATCHES = {
    "arcade/app.js": [
        ("const preview=Boolean(window.CONSOLEGAMES_PREVIEW);",
         "const preview=Boolean(window.CONSOLEGAMES_PREVIEW)&&!window.OTTHOS_FIREBASE_CONFIG?.enabled;"),
        ("if(window.CONSOLEGAMES_PREVIEW){setFeedback(",
         "if(window.CONSOLEGAMES_PREVIEW&&!window.OTTHOS_FIREBASE_CONFIG?.enabled){setFeedback("),
    ],
    "games/otthi/assets/js/multiplayer-rtdb.js": [
        ("if(window.CONSOLEGAMES_PREVIEW)return{enabled:false};",
         "if(window.CONSOLEGAMES_PREVIEW&&!window.OTTHOS_FIREBASE_CONFIG?.enabled)return{enabled:false};"),
    ],
    "games/otthi/src/modules/02-state-save-cloud-account.js": [
        ("if(window.CONSOLEGAMES_PREVIEW){",
         "if(window.CONSOLEGAMES_PREVIEW&&!window.OTTHOS_FIREBASE_CONFIG?.enabled){"),
    ],
}

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
    if not FIREBASE_ENABLED:
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
    patched_live_sources = set()
    for item in OUTPUT.rglob("*"):
        if not item.is_file() or item.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        try:
            original = item.read_text("utf-8")
        except UnicodeError:
            continue
        relative = item.relative_to(OUTPUT).as_posix()
        # Signed native APK metadata describes immutable binary contents.
        # Never rewrite its embedded server address during web packaging.
        if relative in {"arcade/downloads/release.json", "arcade/downloads/release-ot.json"}:
            continue
        # Rewrite staged web paths, not signed native package metadata.
        revised = original.replace(OLD_BASE, NEW_BASE)
        if item.suffix.lower() in {'.html', '.htm'}:
            revised = re.sub(r"""https://github\.com/tsvalencio-IA/ConsoleGames(?=["']|$)""",
                             'https://github.com/tsvalencio-IA/ConsoleGames-Preview', revised)
        if item.suffix.lower() in {'.html', '.htm'}:
            revised = prepare_document(revised, bootstrap)
        elif item.name == 'sw.js':
            revised = "'use strict';\n" + bootstrap + '\n' + revised
        elif item.name == 'firebase-config.js' and not FIREBASE_ENABLED:
            revised = 'window.OTTHOS_FIREBASE_CONFIG = Object.freeze({enabled: false});\n'
        if FIREBASE_ENABLED and relative in LIVE_SOURCE_PATCHES:
            for before, after in LIVE_SOURCE_PATCHES[relative]:
                if revised.count(before) != 1:
                    raise SystemExit("Firebase activation guard changed in " + relative)
                revised = revised.replace(before, after, 1)
            patched_live_sources.add(relative)
        if revised != original:
            item.write_text(revised, encoding="utf-8")
            changed += 1

    if FIREBASE_ENABLED:
        if patched_live_sources != set(LIVE_SOURCE_PATCHES):
            raise SystemExit("Missing source for Firebase activation")
        # Ensure both original public configurations are intact before building.
        for relative in ("arcade/firebase-config.js", "games/otthi/firebase-config.js"):
            if (OUTPUT / relative).read_bytes() != (ROOT / relative).read_bytes():
                raise SystemExit("Original Firebase configuration changed: " + relative)
    # Pin the public Pages ID only in the deployed mount, preserving the
    # portable source manifest and the original implicit installed identity.
    arcade_manifest = OUTPUT / 'arcade/manifest.webmanifest'
    arcade = json.loads(arcade_manifest.read_text('utf-8'))
    if arcade.get('start_url') != './' or arcade.get('scope') != '../':
        raise SystemExit('Canonical Arcade launch URL or scope changed')
    arcade['id'] = NEW_BASE + 'arcade/'
    arcade_manifest.write_text(json.dumps(arcade, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    subprocess.run([sys.executable, str(OUTPUT / 'games/otthi/tools/build_project.py')], check=True)
    release = verify_manifest()
    for relative in ('arcade/downloads/release.json', 'arcade/downloads/release-ot.json'):
        if (OUTPUT / relative).read_bytes() != (ROOT / relative).read_bytes():
            raise SystemExit('Native APK metadata must not be rewritten: ' + relative)
    git_sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    metadata = {'source': SOURCE_SHA, 'commit': git_sha, 'build': release['build'],
                'revision': release['revision'], 'storagePrefix': 'consolegames-preview:', 'firebase': FIREBASE_MODE}
    (OUTPUT / 'preview-release.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    (OUTPUT / ".nojekyll").write_text("", encoding="utf-8")
    for route in MINIMUM_ROUTES:
        if not (OUTPUT / route).is_file():
            raise SystemExit("Missing game route in Pages artifact: " + route)

    print(f"Prepared {OUTPUT}: {changed} text files adapted, {len(release['files'])} final hashes verified.")
    print(f"Pages preview {release['build']} / {release['revision']} with isolated local storage and Firebase {FIREBASE_MODE}.")


if __name__ == "__main__":
    main()
