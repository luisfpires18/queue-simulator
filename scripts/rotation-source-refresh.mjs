// Dump the raw text behind a rule pack's sources, for re-authoring the pack
// after a patch. NOT part of the app - nothing on the request path ever fetches
// a guide, which is the whole reason the rules are checked into the repo (see
// src/game/rotations/types.ts).
//
//   npm run rotation:sources -- deathknight:unholy
//   npm run rotation:sources -- --list
//
// Runs through tsx because it imports the TypeScript rule packs directly, which
// keeps the source list in exactly one place instead of duplicating URLs here.
//
// Writes docs/rotation-sources/<specId>.md, then you (or Claude) diff that
// against the current pack and update the rules + each source's readAt.
//
// Known limitation, deliberately not worked around: wowhead.com renders its
// guides client-side, so a plain fetch returns the page shell and comments with
// no rotation in it. The script says so rather than writing an empty section.
// SimulationCraft's APL, Method.gg and Icy Veins all return real content, and
// the APL is machine-readable, so it is the source to trust when they disagree.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "docs", "rotation-sources");

/** Packs are TS, so read them through tsx rather than importing them directly. */
async function loadPacks() {
  const mod = await import(pathToFileURL(path.join(ROOT, "src", "game", "rotations", "index.ts")).href);
  return mod;
}

/** Crude tag strip - enough to eyeball a rotation, not a real HTML parser. */
function toText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * SimulationCraft's APL is C++ source on GitHub. Fetch the raw file and keep only
 * the spec's own function, which is the entire priority list in ~70 lines.
 */
function simcSection(source, specId) {
  const spec = specId.split(":")[1];
  const lines = source.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^\\s*void\\s+${spec}\\s*\\(`).test(l));
  if (start === -1) return null;
  const out = [];
  for (let i = start; i < lines.length; i++) {
    out.push(lines[i]);
    // the function's closing brace at column 0
    if (i > start && /^\}/.test(lines[i])) break;
  }
  return out.join("\n");
}

/** github.com/<o>/<r>/blob/<ref>/<p> -> raw.githubusercontent.com/<o>/<r>/<ref>/<p> */
function rawGithub(url) {
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}` : url;
}

async function fetchSource(source, specId) {
  const url = rawGithub(source.url);
  const res = await fetch(url, {
    headers: { "user-agent": "queue-simulator rotation-source-refresh (offline authoring tool)" },
  });
  if (!res.ok) return { ...source, url, error: `HTTP ${res.status} ${res.statusText}` };

  const body = await res.text();
  if (url.endsWith(".cpp")) {
    const section = simcSection(body, specId);
    return {
      ...source,
      url,
      text: section ?? `Could not find a void ${specId.split(":")[1]}(...) function in this file.`,
      fenced: "cpp",
    };
  }

  const text = toText(body);
  // A guide page that renders client-side comes back as navigation and footer
  // only. Better to say so than to write a section that looks like a source.
  const looksEmpty = text.length < 2000;
  return {
    ...source,
    url,
    text,
    warning: looksEmpty
      ? "This page returned very little text - it most likely renders client-side (wowhead does). Treat as unusable and read it in a browser instead."
      : null,
  };
}

async function main() {
  const arg = process.argv[2];
  const { rotationSpecFor, packedSpecIds } = await loadPacks();

  if (!arg || arg === "--list") {
    console.log("Packs with sources to refresh:");
    for (const id of packedSpecIds()) console.log(`  ${id}`);
    console.log("\nUsage: node scripts/rotation-source-refresh.mjs <specId>");
    process.exit(arg ? 0 : 1);
  }

  const spec = rotationSpecFor(arg);
  if (!spec) {
    console.error(`No rule pack for "${arg}". Known: ${packedSpecIds().join(", ")}`);
    process.exit(1);
  }

  console.log(`Refreshing ${spec.sources.length} sources for ${spec.specLabel} (pack patch ${spec.patch})`);
  const results = [];
  for (const source of spec.sources) {
    process.stdout.write(`  ${source.label} ... `);
    try {
      const r = await fetchSource(source, spec.specId);
      console.log(r.error ? `FAILED (${r.error})` : `${r.text.length} chars${r.warning ? " (suspect)" : ""}`);
      results.push(r);
    } catch (err) {
      console.log(`FAILED (${err.message})`);
      results.push({ ...source, error: err.message });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const doc = [
    `# ${spec.specLabel} - rotation sources`,
    "",
    `Fetched ${today}. Pack currently claims patch **${spec.patch}**.`,
    "",
    "This file is a generated scratch copy of the sources behind",
    `\`src/game/rotations/${spec.specId.replace(":", "-")}.ts\`. Re-author the rules from it, then bump`,
    "each source's `readAt` in the pack. Nothing reads this file at runtime.",
    "",
    "Before adding or changing an ability or aura name, confirm the exact string",
    "appears in a real log - a name that does not match measures nothing and fails",
    "silently. The Pit of Saron fixture is a convenient check:",
    "`fixtures/comparison-10658-plus0.json`.",
    "",
    ...results.flatMap((r) => [
      `## ${r.label}`,
      "",
      `<${r.url}>`,
      "",
      ...(r.error ? [`**Fetch failed:** ${r.error}`, ""] : []),
      ...(r.warning ? [`**Warning:** ${r.warning}`, ""] : []),
      ...(r.text ? ["```" + (r.fenced ?? "text"), r.text, "```", ""] : []),
    ]),
  ].join("\n");

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${spec.specId.replace(":", "-")}.md`);
  await writeFile(outPath, doc, "utf8");
  console.log(`\nWrote ${path.relative(ROOT, outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
