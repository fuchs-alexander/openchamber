import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND_PROFILE_RESOURCE_NAME, resolveBrandProfile } from '../brand-profile.mjs';
import { buildBrandBuilderConfig } from './brand-builder-config.mjs';
import { resolveTargetArchitecture } from './target-architecture.mjs';

const env = { ...process.env };
const builderArgs = process.argv.slice(2);
const targetArchitecture = resolveTargetArchitecture({ environment: env, builderArgs });

if (process.platform === 'win32' && !env.CSC_LINK && !env.WINDOWS_CSC_LINK) {
  env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
  console.log('[electron] Windows code signing disabled; building unsigned installer.');
}

const bunBinaryCandidates = [
  process.env.npm_execpath,
  process.env.BUN_INSTALL ? path.join(process.env.BUN_INSTALL, 'bin', process.platform === 'win32' ? 'bun.exe' : 'bun') : null,
  process.platform === 'win32' ? 'bun.exe' : 'bun',
].filter(Boolean);

const bunBinary = bunBinaryCandidates.find((candidate) => {
  if (path.basename(candidate).toLowerCase().startsWith('bun')) {
    return candidate === 'bun' || candidate === 'bun.exe' || fs.existsSync(candidate);
  }
  return false;
}) || (process.platform === 'win32' ? 'bun.exe' : 'bun');

// OPENCHAMBER_BRAND_PROFILE=<id> packages a branded app from branding/profiles/<id>.json.
const brandProfileId = String(env.OPENCHAMBER_BRAND_PROFILE || '').trim();
if (brandProfileId) {
  const electronDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const repoRoot = path.resolve(electronDir, '..', '..');
  const profile = resolveBrandProfile(brandProfileId, { profilesDir: path.join(repoRoot, 'branding', 'profiles') });
  const stagingDir = path.join(electronDir, 'dist-brand', profile.profileId);
  fs.mkdirSync(stagingDir, { recursive: true });
  const stagedProfilePath = path.join(stagingDir, BRAND_PROFILE_RESOURCE_NAME);
  fs.writeFileSync(stagedProfilePath, `${JSON.stringify(profile, null, 2)}\n`);
  const baseBuild = JSON.parse(fs.readFileSync(path.join(electronDir, 'package.json'), 'utf8')).build;
  const configPath = path.join(stagingDir, 'electron-builder.json');
  fs.writeFileSync(configPath, `${JSON.stringify(buildBrandBuilderConfig(baseBuild, profile, { repoRoot, stagedProfilePath }), null, 2)}\n`);
  builderArgs.push('--config', configPath);
  console.log(`[electron] packaging brand profile "${profile.profileId}" as ${profile.displayName} (${profile.bundleId})`);
}

if (process.platform === 'linux' && !builderArgs.some((argument) => (
  argument === '--x64' || argument === '--arm64' || argument === '--arch' || argument.startsWith('--arch=')
))) {
  builderArgs.push(`--${targetArchitecture.electronBuilder}`);
}

const child = spawn(bunBinary, ['x', 'electron-builder', ...builderArgs], {
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('[electron] failed to start electron-builder:', error);
  process.exit(1);
});
