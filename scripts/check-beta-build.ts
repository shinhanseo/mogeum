import { execFileSync } from "node:child_process";
import {
  betaBuildProblems,
  externalBetaProblems,
} from "../src/lib/beta-readiness";
async function main() {
  if (process.env.MOGEUM_APP_VARIANT !== "beta") {
    console.log("Beta build gate skipped for development configuration.");
    return;
  }
  try {
    try {
      process.loadEnvFile(".env");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const config = JSON.parse(
      execFileSync("npx", ["expo", "config", "--type", "public", "--json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
    const technical = betaBuildProblems(config, process.env);
    let authProvidersChecked = false;
    if (!technical.length) {
      try {
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
          {
            headers: {
              apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            },
            signal: AbortSignal.timeout(15000),
          },
        );
        const data = await response.json();
        if (!response.ok) technical.push("AUTH_CONFIGURATION_UNAVAILABLE");
        else if (!data.external?.apple || !data.external?.kakao)
          technical.push("AUTH_PROVIDERS_NOT_READY");
        else authProvidersChecked = true;
      } catch {
        technical.push("AUTH_CONFIGURATION_UNAVAILABLE");
      }
    }
    const external = process.argv.includes("--external");
    const issues = [
      ...technical,
      ...(external ? externalBetaProblems(process.env) : []),
    ];
    console.log(
      JSON.stringify({
        variant: "beta",
        technicalBuildReady: technical.length === 0,
        authProvidersChecked,
        externalDistributionReady: external ? issues.length === 0 : null,
        checks: issues,
      }),
    );
    if (issues.length) process.exitCode = 1;
  } catch {
    console.error(
      "Beta configuration check failed; no resolved values logged.",
    );
    process.exitCode = 1;
  }
}
void main();
