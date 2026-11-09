// Manual runner: npx tsx workers/sync.ts [--backfill] [--tenant <id>]. Production runs through /api/cron/*.
import { runSync } from "../src/lib/jobs/sync";
const args = process.argv.slice(2);
runSync({ backfill: args.includes("--backfill"), tenantId: args.includes("--tenant") ? args[args.indexOf("--tenant") + 1] : null })
  .then((r) => { console.log(r); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
