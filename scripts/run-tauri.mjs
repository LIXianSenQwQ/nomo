import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawn } from 'node:child_process';

const cargoBin = join(homedir(), '.cargo', 'bin');
const env = { ...process.env };

if (existsSync(cargoBin)) {
  env.PATH = [cargoBin, env.PATH].filter(Boolean).join(delimiter);
}

const child = spawn('tauri', process.argv.slice(2), {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
