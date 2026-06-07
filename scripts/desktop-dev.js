/**
 * Start the Electron desktop app with the Vite renderer dev server.
 */

import { spawn } from 'child_process';
import { once } from 'events';
import net from 'net';
import { setTimeout as delay } from 'timers/promises';

const DEFAULT_DEV_SERVER_URL = process.env.DEV_SERVER_URL || 'http://127.0.0.1:5173';

const children = new Set();
let shuttingDown = false;

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

async function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }

    await delay(250);
  }

  throw new Error(`Renderer dev server did not start at ${url}`);
}

function isPortAvailable(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function resolveDevServerUrl() {
  const url = new URL(DEFAULT_DEV_SERVER_URL);
  const host = url.hostname || '127.0.0.1';
  const requestedPort = Number(url.port || 5173);

  if (process.env.DEV_SERVER_URL) {
    return {
      url: url.toString(),
      host,
      port: String(requestedPort),
      strictPort: true
    };
  }

  for (let offset = 0; offset < 20; offset += 1) {
    const candidatePort = requestedPort + offset;
    if (await isPortAvailable(candidatePort, host)) {
      url.port = String(candidatePort);
      return {
        url: url.toString(),
        host,
        port: String(candidatePort),
        strictPort: true
      };
    }
  }

  throw new Error(`No available renderer dev server port found from ${requestedPort} to ${requestedPort + 19}`);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill();
  }

  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  const devServer = await resolveDevServerUrl();
  const vite = run('npx', [
    'vite',
    '--config',
    'desktop/vite.config.js',
    '--host',
    devServer.host,
    '--port',
    devServer.port,
    ...(devServer.strictPort ? ['--strictPort'] : []),
  ]);

  vite.once('exit', (code) => {
    if (!shuttingDown) shutdown(code || 1);
  });

  await waitForServer(devServer.url);

  const electron = run('npx', ['electron', 'desktop/main.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      DEV_SERVER_URL: devServer.url,
    },
  });

  const [code] = await once(electron, 'exit');
  shutdown(code || 0);
}

main().catch((error) => {
  console.error(error);
  shutdown(1);
});
