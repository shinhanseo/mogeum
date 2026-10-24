/** Start only a development Metro against isolated local Supabase. Never export the service key. */
import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";
const status = JSON.parse(
  execFileSync(
    resolve("node_modules/.bin/supabase"),
    ["status", "-o", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ),
);
if (
  status.API_URL !== "http://127.0.0.1:54321" ||
  typeof status.ANON_KEY !== "string"
)
  throw new Error("Isolated local project required");
const child = spawn(
  process.execPath,
  [
    resolve("node_modules/expo/bin/cli"),
    "start",
    "--dev-client",
    "--port",
    "8081",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PUBLIC_SUPABASE_URL: status.API_URL,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
