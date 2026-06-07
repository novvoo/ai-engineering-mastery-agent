/**
 * Start the Electron desktop app with the Vite renderer dev server.
 */

import { spawn } from 'child_process';
import { once } from 'events';
import net from 'net';
import { resolve } from 'path';
import { setTimeout as delay } from 'timers/promises';
import { fileURLToPath } from 'url';

export const DESKTOP_RENDERER_HOST = '127.0.0.1';
export const DESKTOP_RENDERER_PORT_START = 5173;
export const DESKTOP_RENDERER_PORT_END = 5199;
export const DEFAULT_DEV_SERVER_URL = `http://${DESKTOP_RENDERER_HOST}:${DESKTOP_RENDERER_PORT_START}/`;

const children = new Set();
let shuttingDown = false;

export function run(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

export async function waitForServer(url, timeoutMs = 30000) {
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

export function isPortAvailable(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

export async function resolveDevServerUrl({
  defaultUrl = process.env.DEV_SERVER_URL || DEFAULT_DEV_SERVER_URL,
  env = process.env,
  isPortAvailableFn = isPortAvailable
} = {}) {
  const url = new URL(defaultUrl);
  const host = url.hostname || '127.0.0.1';
  const requestedPort = Number(url.port || DESKTOP_RENDERER_PORT_START);

  if (env.DEV_SERVER_URL) {
    return {
      url: url.toString(),
      host,
      port: String(requestedPort),
      strictPort: true
    };
  }

  const lastPort = Math.max(requestedPort, DESKTOP_RENDERER_PORT_END);
  for (let candidatePort = requestedPort; candidatePort <= lastPort; candidatePort += 1) {
    if (await isPortAvailableFn(candidatePort, host)) {
      url.port = String(candidatePort);
      return {
        url: url.toString(),
        host,
        port: String(candidatePort),
        strictPort: true
      };
    }
  }

  throw new Error(`No available Electron renderer dev server port found from ${requestedPort} to ${lastPort}`);
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

export async function main() {
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

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    shutdown(1);
  });
}
