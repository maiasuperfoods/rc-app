// Manual runner: npx tsx workers/wbr.ts. Production runs through /api/cron/wbr.
import { runWbr } from "../src/lib/jobs/wbr";
runWbr().then((r) => { console.log(r); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
