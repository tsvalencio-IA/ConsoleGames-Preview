#!/usr/bin/env python3
"""Mount the exact compiled .54 candidate as a separate playtest with original account authentication.
The stable package and all original game sources are untouched.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

root = Path(sys.argv[1]).resolve()
stable = Path(sys.argv[2]).resolve()
expected = 'd620a3fa4e5c9278656595f71462ccff54b2ed34'
assert os.environ.get('GITHUB_REPOSITORY') == 'tsvalencio-IA/ConsoleGames-Preview'
assert subprocess.check_output(['git','rev-parse','HEAD'], cwd=root,text=True).strip() == expected
assert json.loads((stable/'preview-release.json').read_text())['build'] == '705.28.53-camera-multiplayer'
mount = '/ConsoleGames-Preview/teste-54/'
prefix = 'consolegames-preview-54-live:'
# Modify only the temporary checkout's packaging parameters, not game source.
for name in ('tools/build-github-pages-preview.py','tools/pages-preview-isolation.js'):
    file = root/name
    text = file.read_text()
    assert '/ConsoleGames-Preview/' in text and 'consolegames-preview:' in text
    file.write_text(text.replace('/ConsoleGames-Preview/',mount).replace('consolegames-preview:',prefix))
env = dict(os.environ, OT_PAGES_FIREBASE='enabled')
subprocess.run([sys.executable, str(root/'tools/build-github-pages-preview.py')], cwd=root,env=env,check=True)
prepared=root/'_pages_preview'
metadata=json.loads((prepared/'preview-release.json').read_text())
assert metadata['commit']==expected and metadata['build']=='705.28.54-simulador-servicos'
assert metadata['storagePrefix']==prefix and metadata['firebase']=='enabled'
world=prepared/'games/otthi'
release=json.loads((world/'release-manifest.json').read_text())
for name,digest in release['files'].items():
    assert hashlib.sha256((world/name).read_bytes()).hexdigest()==digest,name
# Do not copy signed Android installers into a browser-only playtest.
target=stable/'teste-54'
assert not target.exists()
shutil.copytree(prepared,target)
print('Isolated .54 playtest:',mount,'commit:',expected,'hashes:',len(release['files']))
