#!/usr/bin/env bash
# Rebuilds index.html from src/ (head.html + engine/presets/link/app scripts)
set -e
cd "$(dirname "$0")"
python3 - <<'PY'
h=open('src/head.html').read()
for tag,f in [('ENGINE','engine.js'),('PRESETS','presets.js'),('LINK','link.js'),('APP','app.js')]:
    h=h.replace('/*@@%s@@*/'%tag, open('src/'+f).read())
open('index.html','w').write(h)
print('index.html', len(h), 'bytes')
PY
