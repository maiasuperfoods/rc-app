#!/usr/bin/env sh
# Copies the app's invented demo dataset into the admin edge function (type imports stripped; Deno erases types).
set -e
cd "$(dirname "$0")/.."
python3 - <<'PY'
import re
s=open('src/lib/demo/data.ts').read()
s=re.sub(r'import type \{[^}]*\} from "@/lib/types";\n','',s)
s=s.replace('import type { ForecastInputs } from "@/lib/calc/forecast";\n','')
open('supabase/functions/admin/demo-data.ts','w').write('// @ts-nocheck — types are erased at runtime; this file is a generated copy of the app module.\n// Generated from src/lib/demo/data.ts by scripts/sync-demo-data.sh — do not edit here.\n'+s)
PY
