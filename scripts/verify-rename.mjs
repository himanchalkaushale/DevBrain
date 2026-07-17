import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "C:/Users/himan/Desktop/New";
const skip = new Set([join(ROOT, "scripts", "rename-to-devbrain.mjs"), join(ROOT, "scripts", "rename-test.mjs"), join(ROOT, "scripts", "verify-rename.mjs")]);

const walk = (dir, files) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (n === ".git" || n === "node_modules" || n === "dist" || n === "build") continue;
      walk(p, files);
    } else if (n.endsWith(".md") && !skip.has(p)) files.push(p);
  }
};

const files = [];
walk(ROOT, files);

// 1. Standalone "Brain" (capital) NOT preceded by "Dev". Reports each occurrence.
// 2. Stray lowercase CLI "brain" that should have become "devbrain":
//    a `brain` token used as a command (backtick-wrapped, or followed by a
//    subcommand), excluding the protected metaphor forms.
const METAPHOR = ["own brain", "own long-term brain", '"what should I', '?" brain', '" brain.', '" brain,'];

const CLI_SUBS = new Set(["index","search","status","rebuild","graph","context","doctor","repl","config","recall","remember","forget","tag","append","extract","build","version","server","command","cli"]);

let standalone = [];
let strayCli = [];

for (const f of files) {
  const lines = readFileSync(f, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    // standalone capital Brain (not part of DevBrain)
    let idx = 0;
    while ((idx = line.indexOf("Brain", idx)) !== -1) {
      const before = line.slice(Math.max(0, idx - 3), idx);
      if (!before.endsWith("Dev")) {
        standalone.push(`${f}:${i + 1}: ...${line.slice(Math.max(0, idx - 20), idx + 25)}...`);
      }
      idx += 5;
    }
    // stray lowercase brain CLI tokens
    const metaphor = METAPHOR.some((s) => line.includes(s));
    if (metaphor) return;
    let j = 0;
    while ((j = line.indexOf("brain", j)) !== -1) {
      const prev = line[j - 1] ?? " ";
      const next = line[j + 5] ?? " ";
      // already part of devbrain_ / devbrain. / devbrain (skip)
      if (line.slice(Math.max(0, j - 3), j).toLowerCase().endsWith("dev")) { j += 5; continue; }
      // part of devbrain.config / .devbrainrc (handled)
      const tok = line.slice(j, j + 6);
      if (tok === "brain_") { j += 6; continue; }
      if (line.slice(j, j + 11) === "brain.config") { j += 11; continue; }
      if (line.slice(j - 1, j + 5) === ".brainr") { j += 6; continue; }
      // Is it a CLI command? backtick-wrapped or followed by a subcommand word
      const afterWord = (line.slice(j + 5).match(/^[\s`]*([A-Za-z|]+)/) || [])[1] || "";
      const isBacktick = prev === "`" || next === "`";
      const isSub = afterWord && CLI_SUBS.has(afterWord.toLowerCase());
      if (isBacktick || isSub) {
        strayCli.push(`${f}:${i + 1}: ...${line.slice(Math.max(0, j - 15), j + 25)}...`);
      }
      j += 5;
    }
  });
}

console.log("=== STANDALONE capital Brain (not DevBrain) ===");
console.log(standalone.length ? standalone.join("\n") : "(none)");
console.log("\n=== STRAY lowercase CLI brain ===");
console.log(strayCli.length ? strayCli.join("\n") : "(none)");
