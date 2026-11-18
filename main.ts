// main.ts — entrypoint for the gta6-01 "Make GTA 6" bounty.
//
// What it does: copies game/ and screenshots/ from this repository into
// the output directory, then writes /output/dossier.json with
// buildDossier from vendor/makefun-game.ts.
//
// How it is run: the grader runs `node main.ts` as user 65534 on a
// read-only filesystem with /output mounted writable. Outside the
// grader, MAKEFUN_OUTPUT_DIR stands in for /output.
//
// The one rule that matters most here: this program NEVER removes the
// output directory itself. It only empties the directory's CONTENTS
// (one child at a time) and creates the directory only if it does not
// exist yet. Deleting /output and recreating it would need write access
// to its parent, which is read-only under the grader, and fails EPERM.
//
// Everything is deterministic: the same repository always produces the
// same bytes in the output directory, and the whole run finishes in
// well under the grader's 10 second wall limit. Node 22+, stdlib only,
// no network.

import { buildDossier } from "./vendor/makefun-game.ts";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");

// Give a path (and everything under it) normal owner-writable modes:
// files 0644, directories 0755. A copy of a read-only repository
// otherwise leaves read-only files behind that the next run could
// not remove.
function makeWritableRecursive(p: string): void {
  const st = statSync(p);
  if (st.isDirectory()) {
    chmodSync(p, 0o755);
    for (const entry of readdirSync(p)) makeWritableRecursive(join(p, entry));
  } else {
    chmodSync(p, 0o644);
  }
}

function removeEntry(p: string): void {
  try {
    rmSync(p, { recursive: true, force: true });
  } catch (err) {
    // A previous run (or a stale file) may have left read-only entries
    // behind; make the entry writable and try once more.
    makeWritableRecursive(p);
    rmSync(p, { recursive: true, force: true });
  }
}

function emptyDirectoryContents(dir: string): void {
  // Remove every child of dir, but never dir itself.
  for (const entry of readdirSync(dir)) {
    removeEntry(join(dir, entry));
  }
}

function main(): void {
  const gameDir = join(repoRoot, "game");
  const shotsDir = join(repoRoot, "screenshots");
  if (!existsSync(gameDir)) {
    throw new Error(`missing game/ directory: ${gameDir}`);
  }
  if (!existsSync(shotsDir)) {
    throw new Error(`missing screenshots/ directory: ${shotsDir}`);
  }

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  emptyDirectoryContents(outputDir);

  cpSync(gameDir, join(outputDir, "game"), { recursive: true });
  cpSync(shotsDir, join(outputDir, "screenshots"), { recursive: true });
  // Leave the copied tree in normal writable modes so a later run
  // can clean it up again.
  makeWritableRecursive(join(outputDir, "game"));
  makeWritableRecursive(join(outputDir, "screenshots"));

  const dossier = buildDossier(repoRoot, { text_max_bytes: 163840 });
  // buildDossier returns the dossier.json bytes themselves (a
  // Uint8Array): write them out unchanged.
  writeFileSync(join(outputDir, "dossier.json"), dossier);
}

main();
