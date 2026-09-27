// Copies job-platform-crawler/seed/jobs.json into src/mocks so the offline fallback
// shows the same records the crawler seeds into PostgreSQL + Elasticsearch.
import { copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(process.env.CRAWLER_SEED_PATH || resolve(root, "../job-platform-crawler/seed/jobs.json"));
const target = resolve(root, "src/mocks/seedJobs.json");

if (!existsSync(source)) {
  console.error(`Seed not found: ${source}. Pull job-platform-crawler or set CRAWLER_SEED_PATH.`);
  process.exit(1);
}
copyFileSync(source, target);
console.log(`Synced ${source} -> ${target}`);
