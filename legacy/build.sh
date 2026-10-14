set -e
cd "$1"
python3 patch_v8.py "$1" 2>&1 | grep -E "^patched|Error|expected" || true
cp spirit-origin-list.html base_v9.html
python3 patch_v9.py "$1"
cp spirit-origin-list.html base_v10.html
python3 patch_v10.py "$1"
cp spirit-origin-list.html base_v11.html
python3 patch_v11.py "$1" ${V11MODS:-v11_motion.js v11_icons.js v11_summon.js v11_home.js}
cp spirit-origin-list.html base_v12.html
python3 patch_v12.py "$1"
python3 patch_v15.py "$1"
python3 patch_v16.py "$1"
python3 patch_v17.py "$1"
python3 patch_v18.py "$1"
python3 patch_v19.py "$1"
python3 patch_v20.py "$1"
python3 patch_v21.py "$1"
python3 make_standalone.py "$1" | tail -1
python3 -c "
import re
h=open('out/Fate_Grand_Index.html').read()
open('out/check.js','w').write(re.findall(r'<script>([\s\S]*?)</script>',h)[-1])"
node --check out/check.js && echo SYNTAX-OK
