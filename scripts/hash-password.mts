#!/usr/bin/env node
// Generates the AUTH_PASSWORD_HASH env value from a password of your choice.
// Usage: `pnpm auth:hash` (interactive prompt — preferred, keeps the password
// out of shell history) or `pnpm auth:hash -- "my password"`.
import { createInterface } from "node:readline/promises";

import { hashPassword } from "../lib/auth/password.ts";

async function readPassword(): Promise<string> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const fromArgv = args[0];
  if (fromArgv !== undefined) {
    console.warn(
      "⚠ Password passed as an argument — consider clearing your shell history."
    );
    return fromArgv;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("Password to hash: ");
  rl.close();
  return answer;
}

const password = await readPassword();

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const hash = await hashPassword(password);

console.log("\nAdd this to your environment (.env locally, Vercel in prod):\n");
console.log(`AUTH_PASSWORD_HASH="${hash}"`);
console.log(
  "\nRotating the password? Re-run this, update the env var, redeploy — " +
    "existing sessions survive (they're tied to SESSION_SECRET). See docs/auth.md."
);
