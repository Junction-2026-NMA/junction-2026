// Small inspection helper: node tests/gauntlet/peek.mjs <path> [jq-ish dotted key]. Prints compact JSON, never HTML.
import { BASE } from "./lib.mjs";
const [path, limit = "1200"] = process.argv.slice(2);
const response = await fetch(`${BASE}${path}`);
const text = await response.text();
let out;
try { out = JSON.stringify(JSON.parse(text)); } catch { out = `NOT JSON (HTTP ${response.status}): ${text.slice(0, 120).replace(/\s+/g, " ")}`; }
console.log(`HTTP ${response.status} ${out.slice(0, Number(limit))}`);
