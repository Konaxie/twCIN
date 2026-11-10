import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function startNodeCli(name, cwd, cliScript, args) {
  const child = spawn(process.execPath, [cliScript, ...args], {
    cwd,
    stdio: ["ignore", "inherit", "inherit"]
  });
  child.on("error", (err) => {
    console.error(`[${name}] erro ao iniciar:`, err);
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] encerrou com código ${code}`);
    }
  });
  return child;
}

const backend = startNodeCli(
  "backend",
  path.join(rootDir, "backend"),
  path.join(rootDir, "backend", "node_modules", "tsx", "dist", "cli.mjs"),
  ["watch", "src/server.ts"]
);

const frontend = startNodeCli(
  "frontend",
  path.join(rootDir, "frontend"),
  path.join(rootDir, "frontend", "node_modules", "vite", "bin", "vite.js"),
  []
);

function shutdown() {
  backend.kill("SIGINT");
  frontend.kill("SIGINT");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
