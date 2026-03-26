const net = require("net");
const { spawn } = require("child_process");

const TAURI_COMMAND = "npx";
const DEFAULT_PORT = 5199;
const MAX_PORT = 5299;

function findOpenPort(start, end) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > end) {
        reject(new Error(`No open port found between ${start} and ${end}.`));
        return;
      }

      const server = net.createServer();
      server.unref();

      server.on("error", () => {
        tryPort(port + 1);
      });

      server.listen(port, "127.0.0.1", () => {
        const { port: openPort } = server.address();
        server.close(() => resolve(openPort));
      });
    };

    tryPort(start);
  });
}

function spawnCommand(args, options = {}) {
  return spawn(TAURI_COMMAND, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
    ...options,
  });
}

async function runTauriDev(args) {
  const port = await findOpenPort(DEFAULT_PORT, MAX_PORT);
  const devUrl = `http://localhost:${port}`;
  const configOverride = JSON.stringify({
    identifier: "com.forge.terminal.dev",
    build: {
      beforeDevCommand: "",
      devUrl,
    },
  });

  console.log(`[forge] starting Vite on ${devUrl}`);

  const vite = spawnCommand(["vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"]);
  let shuttingDown = false;

  const stopVite = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (!vite.killed) {
      vite.kill("SIGTERM");
    }
  };

  vite.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      process.exit(code ?? 1);
    }
  });

  const tauri = spawnCommand(["tauri", "dev", "--config", configOverride, ...args]);

  const shutdown = (signal) => {
    if (!tauri.killed) {
      tauri.kill(signal);
    }
    stopVite();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  tauri.on("exit", (code) => {
    stopVite();
    process.exit(code ?? 0);
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "dev" && !args.includes("--help") && !args.includes("-h")) {
    await runTauriDev(args.slice(1));
    return;
  }

  const child = spawnCommand(["tauri", ...args]);
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
