import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const cargoBin = join(homedir(), '.cargo', 'bin');
const env = { ...process.env };
const require = createRequire(import.meta.url);
const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
const tauriCli = require.resolve('@tauri-apps/cli/tauri.js');

if (existsSync(cargoBin)) {
  env[pathKey] = [cargoBin, env[pathKey]].filter(Boolean).join(delimiter);
}

const child = spawn(process.execPath, [tauriCli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
