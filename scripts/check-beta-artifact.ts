import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { artifactSafetyProblems } from "../src/lib/artifact-safety";
const file = process.argv[2];
if (!file) throw Error("Provide an APK or an exported JS/Hermes bundle");
try {
  const path = resolve(file),
    apk = path.endsWith(".apk");
  const data = apk
    ? execFileSync("unzip", ["-p", path, "assets/index.android.bundle"], {
        maxBuffer: 100 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      })
    : readFileSync(path);
  if (!data.length) throw Error("Missing embedded bundle");
  // Hermes stores strings back-to-back; scanning raw bytes can concatenate the SDK's
  // "sb_secret_" prefix with an unrelated string. Disassemble to restore boundaries.
  let inspected: Uint8Array | string = data;
  if (data.subarray(0, 8).toString("hex") === "c61fbc03c103191f") {
    const dir = mkdtempSync(join(tmpdir(), "mogeum-artifact-"));
    try {
      const bundle = join(dir, "bundle.hbc");
      writeFileSync(bundle, data, { mode: 0o600 });
      const platform =
        process.platform === "darwin"
          ? "osx-bin"
          : process.platform === "linux"
            ? "linux64-bin"
            : "win64-bin";
      const compiler = resolve(
        "node_modules/hermes-compiler/hermesc",
        platform,
        process.platform === "win32" ? "hermesc.exe" : "hermesc",
      );
      inspected = execFileSync(compiler, ["-b", "-dump-bytecode", bundle], {
        maxBuffer: 200 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const issues = artifactSafetyProblems(inspected);
  console.log(
    JSON.stringify({ embeddedBundle: true, issues, safe: issues.length === 0 }),
  );
  if (issues.length) process.exitCode = 1;
} catch {
  console.error("Artifact could not be inspected; no matched content logged.");
  process.exitCode = 1;
}
