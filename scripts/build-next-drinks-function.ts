/** Compile the checked server sources into one dashboard-compatible file; never read environment keys. */
import { build, type BuildOptions } from "esbuild";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
async function main() {
  const output = resolve(
    process.argv[2] ?? `${tmpdir()}/mogeum-next-drinks-deploy/index.ts`,
  );
  const root = resolve(process.cwd());
  if (output === root || output.startsWith(`${root}/`))
    throw new Error("Deployment output must be outside the repository");
  const options: BuildOptions = {
    entryPoints: ["supabase/functions/next-drinks/index.ts"],
    bundle: true,
    format: "esm",
    platform: "neutral",
    external: ["npm:*"],
    write: false,
    legalComments: "inline",
    charset: "utf8",
  };
  const source = await build(options);
  const buildId = `next-drinks-${createHash("sha256").update(source.outputFiles![0].contents).digest("hex").slice(0, 16)}`;
  const compiled = await build({
    ...options,
    define: { __MOGEUM_BUILD_ID__: JSON.stringify(buildId) },
    banner: {
      js: "// @ts-nocheck\n// Generated from typechecked TypeScript. Do not edit this deployment artifact.",
    },
  });
  const contents = compiled.outputFiles![0].contents;
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, contents, { mode: 0o600 });
  const manifest = {
    buildId,
    sha256: createHash("sha256").update(contents).digest("hex"),
    bytes: contents.byteLength,
    entry: "supabase/functions/next-drinks/index.ts",
  };
  writeFileSync(
    `${output}.manifest.json`,
    JSON.stringify(manifest, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ output, ...manifest }));
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Build failed");
  process.exitCode = 1;
});
