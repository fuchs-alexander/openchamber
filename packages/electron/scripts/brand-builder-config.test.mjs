import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { resolveBrandProfile } from '../brand-profile.mjs';
import { buildBrandBuilderConfig } from './brand-builder-config.mjs';

const electronDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(electronDir, '..', '..');
const baseBuild = JSON.parse(fs.readFileSync(path.join(electronDir, 'package.json'), 'utf8')).build;
const profile = resolveBrandProfile('claudi', { profilesDir: path.join(repoRoot, 'branding', 'profiles') });
const stagedProfilePath = '/tmp/staged/brand-profile.json';

const build = () => buildBrandBuilderConfig(baseBuild, profile, { repoRoot, stagedProfilePath });

test('takes the app identity from the profile', () => {
  const config = build();
  assert.equal(config.appId, 'de.nomobo.nomobodev.claudi');
  assert.equal(config.productName, 'nomobodev');
  assert.equal(config.mac.icon, path.join(repoRoot, 'branding/assets/claudi/icon.icns'));
});

test('drops the upstream asset-catalog icon so the profile icon is the one macOS shows', () => {
  assert.equal('CFBundleIconName' in build().mac.extendInfo, false);
  assert.match(build().mac.extendInfo.NSLocalNetworkUsageDescription, /^nomobodev /);
});

test('has no update feed when updates are disabled', () => {
  assert.equal(build().publish, null);
});

test('stages the profile into the app resources', () => {
  const staged = build().extraResources.find((entry) => entry.to === 'brand-profile.json');
  assert.deepEqual(staged, { from: stagedProfilePath, to: 'brand-profile.json' });
  for (const entry of baseBuild.extraResources) {
    assert.ok(build().extraResources.some((candidate) => candidate.to === entry.to), entry.to);
  }
});

test('builds a local app bundle per profile without notarization', () => {
  const config = build();
  assert.deepEqual(config.mac.target, ['dir']);
  assert.equal(config.mac.notarize, false);
  assert.equal(config.directories.output, 'dist/brand-claudi');
});

test('replaces the menu bar icons when the profile has its own, keeping the upstream status icons', () => {
  const trayProfile = { ...profile, trayIconsDir: 'branding/assets/tray-nomobo' };
  const config = buildBrandBuilderConfig(baseBuild, trayProfile, { repoRoot, stagedProfilePath });
  const trayEntries = config.extraResources.filter((entry) => entry.to.startsWith('icons/tray'));
  assert.deepEqual(trayEntries, [
    { from: path.join(repoRoot, 'branding/assets/tray-nomobo'), to: 'icons/tray' },
    { from: 'resources/icons/tray/status', to: 'icons/tray/status' },
  ]);
});

test('keeps the upstream menu bar icons when the profile has none', () => {
  const plain = { ...profile };
  delete plain.trayIconsDir;
  const config = buildBrandBuilderConfig(baseBuild, plain, { repoRoot, stagedProfilePath });
  assert.deepEqual(config.extraResources.filter((entry) => entry.to.startsWith('icons/tray')), [
    { from: 'resources/icons/tray', to: 'icons/tray' },
  ]);
});

test('leaves the upstream build configuration untouched', () => {
  const before = JSON.stringify(baseBuild);
  build();
  assert.equal(JSON.stringify(baseBuild), before);
  assert.equal(baseBuild.appId, 'dev.openchamber.desktop');
});
