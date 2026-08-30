import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const problemId = packageJson.name.endsWith("p02") ? "P02" : packageJson.name.endsWith("p08") ? "P08" : "UNKNOWN";
const required = ["EVENT.md", "README.md", "LICENSES.md", "evaluation-manifest.json", "index.html", "package.json"];
let failures = 0;

function fail(message) { failures += 1; console.error(`FAIL  ${message}`); }
function pass(message) { console.log(`PASS  ${message}`); }

for (const file of required) {
  try { await access(path.join(root, file)); pass(`${file} exists`); }
  catch { fail(`${file} is missing`); }
}

for (const file of ["README.md", "evaluation-manifest.json"]) {
  try {
    const text = await readFile(path.join(root, file), "utf8");
    if (/TODO|<START-CODE>|LSH26-T###|P##/.test(text)) fail(`${file} still contains a submission placeholder`);
    else pass(`${file} has no obvious placeholders`);
  } catch {}
}

try {
  const manifest = JSON.parse(await readFile(path.join(root, "evaluation-manifest.json"), "utf8"));
  if (manifest.release_version !== "2.1") fail("manifest release_version must be 2.1");
  else pass("manifest release_version is 2.1");
  if (manifest.team_id !== "LSH26-T065") fail("manifest team_id must be LSH26-T065");
  else pass("manifest team_id is LSH26-T065");
  if (!Array.isArray(manifest.problems) || manifest.problems.length !== 2) fail("manifest must describe exactly two problems");
  else pass("manifest describes exactly two problems");
  for (const item of manifest.problems ?? []) {
    if (!/^https:\/\//.test(item.repository_url ?? "")) fail(`${item.problem_id}: repository_url is not final`);
    if (!/^https:\/\//.test(item.live_url ?? "")) fail(`${item.problem_id}: live_url is not final`);
    if (!/^[0-9a-f]{40}$/i.test(item.commit_sha ?? "")) fail(`${item.problem_id}: commit_sha is not an exact 40-character SHA`);
    for (const id of ["R1", "R2", "R3", "R4"]) {
      if (item.requirements?.[id]?.status !== "complete") fail(`${item.problem_id} ${id}: status is not complete`);
    }
  }
} catch (error) {
  fail(`evaluation-manifest.json could not be validated: ${error.message}`);
}

try {
  const event = await readFile(path.join(root, "EVENT.md"), "utf8");
  if (!event.includes("LSH26-T065")) fail("EVENT.md does not contain team ID LSH26-T065");
  if (!event.includes(problemId)) fail(`EVENT.md does not contain problem ID ${problemId}`);
  if (!event.includes("LSH26-8490-C900")) fail("EVENT.md does not contain the event start code");
  if (event.includes("Yes / No")) fail("EVENT.md still contains the repository-created Yes / No placeholder");
  if (!failures) pass("EVENT.md identifiers look final");
} catch {}

console.log("");
if (failures) {
  console.error(`${failures} preflight issue(s) found. Fix them before the team leader submits.`);
  process.exitCode = 1;
} else {
  console.log("Submission preflight passed.");
}
