import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const TEAM_ID = "LSH26-T065";
const EVENT_START_CODE = "LSH26-8490-C900";

const requiredFiles = [
  "EVENT.md",
  "README.md",
  "LICENSES.md",
  "evaluation-manifest.json",
  "index.html",
  "package.json"
];

let failures = 0;

function pass(message) {
  console.log(`PASS  ${message}`);
}

function fail(message) {
  console.log(`FAIL  ${message}`);
  failures++;
}

function check(condition, message) {
  condition ? pass(message) : fail(message);
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function hasPlaceholder(text) {
  return (
    /<[^>\n]+>/i.test(text) ||
    /\bTODO\b/i.test(text) ||
    /example\.com/i.test(text) ||
    /T###/i.test(text) ||
    /P##/i.test(text) ||
    /START-CODE/i.test(text) ||
    /MEMBER NAME/i.test(text) ||
    /GITHUB USERNAME/i.test(text)
  );
}

/* -------------------------------------------------------
 * Required repository files
 * ----------------------------------------------------- */

for (const file of requiredFiles) {
  check(
    fs.existsSync(path.join(ROOT, file)),
    `${file} exists`
  );
}

if (failures > 0) {
  console.error(
    `\n${failures} preflight issue(s) found. Fix them before submission.`
  );
  process.exit(1);
}

/* -------------------------------------------------------
 * Read documentation
 * ----------------------------------------------------- */

const readme = read("README.md");
const event = read("EVENT.md");
const licenses = read("LICENSES.md");

check(
  !hasPlaceholder(readme),
  "README.md has no obvious placeholders"
);

check(
  !hasPlaceholder(event),
  "EVENT.md has no obvious placeholders"
);

check(
  !hasPlaceholder(licenses),
  "LICENSES.md has no obvious placeholders"
);

/* -------------------------------------------------------
 * Parse organizer evaluation manifest
 * ----------------------------------------------------- */

let manifest;

try {
  manifest = JSON.parse(read("evaluation-manifest.json"));
  pass("evaluation-manifest.json is valid JSON");
} catch (error) {
  fail(`evaluation-manifest.json is invalid JSON: ${error.message}`);
}

if (!manifest) {
  console.error(
    `\n${failures} preflight issue(s) found. Fix them before submission.`
  );
  process.exit(1);
}

/* -------------------------------------------------------
 * Official organizer schema checks
 * ----------------------------------------------------- */

check(
  manifest.team_id === TEAM_ID,
  `manifest team_id is ${TEAM_ID}`
);

check(
  ["P02", "P08"].includes(manifest.problem_id),
  "manifest problem_id is P02 or P08"
);

const expectedRepository =
  manifest.problem_id === "P02"
    ? "lsh26-t065-p02"
    : manifest.problem_id === "P08"
      ? "lsh26-t065-p08"
      : null;

check(
  manifest.repository_name === expectedRepository,
  `manifest repository_name matches ${expectedRepository ?? "selected problem"}`
);

check(
  manifest.event_start_code === EVENT_START_CODE,
  `manifest event_start_code is ${EVENT_START_CODE}`
);

check(
  typeof manifest.live_url === "string" &&
  /^https:\/\/.+/i.test(manifest.live_url) &&
  !/example\.com/i.test(manifest.live_url),
  "manifest contains a real HTTPS live URL"
);

check(
  typeof manifest.repository_created_before_release === "boolean",
  "manifest repository_created_before_release is boolean"
);

check(
  Array.isArray(manifest.pre_event_materials),
  "manifest pre_event_materials is an array"
);

/* -------------------------------------------------------
 * Sample data
 * ----------------------------------------------------- */

check(
  manifest.sample_data &&
  manifest.sample_data.loads_published_fixture === true,
  "manifest confirms published fixture loading"
);

check(
  typeof manifest.sample_data?.method === "string" &&
  manifest.sample_data.method.trim().length > 0,
  "manifest describes sample-data loading method"
);

check(
  typeof manifest.sample_data?.reset_instructions === "string" &&
  manifest.sample_data.reset_instructions.trim().length > 0,
  "manifest contains reset instructions"
);

/* -------------------------------------------------------
 * Problem-solving method
 * ----------------------------------------------------- */

check(
  typeof manifest.problem_solving_method === "string" &&
  manifest.problem_solving_method.trim().length > 0,
  "manifest contains problem-solving method"
);

/* -------------------------------------------------------
 * R1-R4
 * ----------------------------------------------------- */

const requirementIds = ["R1", "R2", "R3", "R4"];

check(
  manifest.requirements &&
  requirementIds.every((id) => manifest.requirements[id]),
  "manifest describes exactly R1-R4"
);

for (const id of requirementIds) {
  const requirement = manifest.requirements?.[id];

  if (!requirement) continue;

  check(
    ["complete", "partial", "not_attempted"].includes(requirement.status),
    `${id} has a valid status`
  );

  check(
    typeof requirement.evidence === "string" &&
    requirement.evidence.trim().length > 0,
    `${id} contains evidence`
  );
}

check(
  requirementIds.every(
    (id) => manifest.requirements?.[id]?.status === "complete"
  ),
  "all four required items are marked complete"
);

/* -------------------------------------------------------
 * Team members
 * ----------------------------------------------------- */

check(
  Array.isArray(manifest.team_members) &&
  manifest.team_members.length === 2,
  "manifest contains both registered team members"
);

for (const member of manifest.team_members ?? []) {
  check(
    typeof member.registered_name === "string" &&
    member.registered_name.trim().length > 0,
    `team member has registered name`
  );

  check(
    typeof member.github_username === "string" &&
    member.github_username.trim().length > 0 &&
    !member.github_username.startsWith("@") &&
    !member.github_username.includes("<"),
    `${member.registered_name || "team member"} has plain GitHub username`
  );

  check(
    typeof member.major_contribution === "string" &&
    member.major_contribution.trim().length > 0,
    `${member.registered_name || "team member"} has contribution description`
  );

  check(
    Array.isArray(member.evidence_paths_or_commits) &&
    member.evidence_paths_or_commits.length > 0,
    `${member.registered_name || "team member"} has contribution evidence`
  );
}

/* -------------------------------------------------------
 * Decisions, limitations and AI disclosure
 * ----------------------------------------------------- */

check(
  Array.isArray(manifest.major_design_decisions) &&
  manifest.major_design_decisions.length > 0,
  "manifest contains major design decisions"
);

check(
  Array.isArray(manifest.known_limitations) &&
  manifest.known_limitations.length > 0,
  "manifest contains known limitations"
);

check(
  Array.isArray(manifest.ai_tools_used) &&
  manifest.ai_tools_used.length > 0,
  "manifest contains AI-use disclosure"
);

for (const item of manifest.ai_tools_used ?? []) {
  check(
    typeof item.tool === "string" &&
    item.tool.trim().length > 0 &&
    typeof item.used_for === "string" &&
    item.used_for.trim().length > 0 &&
    typeof item.how_output_was_verified === "string" &&
    item.how_output_was_verified.trim().length > 0,
    `AI tool "${item.tool || "unknown"}" includes use and verification details`
  );
}

/* -------------------------------------------------------
 * Licensing and declaration
 * ----------------------------------------------------- */

check(
  manifest.licenses_file === "LICENSES.md",
  "manifest points to LICENSES.md"
);

check(
  manifest.declaration ===
  "The information above is complete and truthful to the best of the team's knowledge.",
  "manifest contains organizer declaration"
);

/* -------------------------------------------------------
 * Cross-file consistency
 * ----------------------------------------------------- */

check(
  event.includes(TEAM_ID),
  "EVENT.md contains correct team ID"
);

check(
  event.includes(manifest.problem_id),
  "EVENT.md contains correct problem ID"
);

check(
  event.includes(EVENT_START_CODE),
  "EVENT.md contains correct event start code"
);

check(
  readme.includes(manifest.live_url),
  "README.md contains the manifest live URL"
);

check(
  licenses.includes("AI assistance"),
  "LICENSES.md contains AI assistance disclosure"
);

/* -------------------------------------------------------
 * Result
 * ----------------------------------------------------- */

if (failures > 0) {
  console.error(
    `\n${failures} preflight issue(s) found. Fix them before the team leader submits.`
  );
  process.exit(1);
}

console.log("\nPRE-FLIGHT PASSED");
console.log(
  `${manifest.problem_id} repository matches the organizer submission schema.`
);