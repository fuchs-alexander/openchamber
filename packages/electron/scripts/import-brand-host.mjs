#!/usr/bin/env node
/**
 * Copies the existing connection for a brand profile's instance from the
 * OpenChamber settings into the branded app's own settings file.
 *
 *   node packages/electron/scripts/import-brand-host.mjs <profileId> [--from <settings.json>] [--to <settings.json>]
 *
 * The source file is only read. An existing target is backed up next to itself
 * first. Quit the branded app before running this; it rewrites its settings.
 * Tokens are never printed.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { brandRuntimePaths, resolveBrandProfile } from '../brand-profile.mjs';
import { importBrandHost } from './brand-host-import.mjs';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { from: { type: 'string' }, to: { type: 'string' } },
});
const [profileId] = positionals;
if (!profileId) {
  console.error('usage: import-brand-host.mjs <profileId> [--from <settings.json>] [--to <settings.json>]');
  process.exit(2);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const profile = resolveBrandProfile(profileId, { profilesDir: path.join(repoRoot, 'branding', 'profiles') });
const homeDir = os.homedir();
const fromPath = path.resolve(values.from || path.join(homeDir, '.config', 'openchamber', 'settings.json'));
const toPath = path.resolve(values.to || path.join(
  brandRuntimePaths(profile, { appDataDir: '', homeDir }).dataDir,
  'settings.json',
));
if (fromPath === toPath) {
  console.error('Source and target settings are the same file; refusing to write.');
  process.exit(1);
}

const readJson = (filePath, { optional }) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (optional && error?.code === 'ENOENT') return {};
    throw new Error(`Cannot read ${filePath}: ${error.code || 'invalid JSON'}`);
  }
};

const sourceRoot = readJson(fromPath, { optional: false });
const targetRoot = readJson(toPath, { optional: true });
const { root, summary } = importBrandHost({ targetRoot, sourceRoot, profile });

fs.mkdirSync(path.dirname(toPath), { recursive: true, mode: 0o700 });
fs.chmodSync(path.dirname(toPath), 0o700);
if (fs.existsSync(toPath)) {
  const backupPath = `${toPath}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(toPath, backupPath, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(backupPath, 0o600);
  console.log(`Backed up existing settings to ${backupPath}`);
}
const tmpPath = `${toPath}.tmp-${process.pid}`;
fs.writeFileSync(tmpPath, JSON.stringify(root, null, 2), { encoding: 'utf8', mode: 0o600 });
fs.renameSync(tmpPath, toPath);
fs.chmodSync(toPath, 0o600);

console.log(`Imported "${summary.matchedHostLabel || profile.defaultHost.label}" as "${profile.defaultHost.id}" into ${toPath}`);
console.log(`Token copied: ${summary.tokenCopied ? 'yes' : 'no'}; replaced existing entry: ${summary.replacedExisting ? 'yes' : 'no'}`);
