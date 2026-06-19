import { spawnSync } from "node:child_process";
import process from "node:process";

process.env.VITE_BASE_PATH = process.env.VITE_BASE_PATH ?? "/Magic-Circle-System/";

const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run("npx", ["tsc", "-b"]);
run("npx", ["vite", "build"]);