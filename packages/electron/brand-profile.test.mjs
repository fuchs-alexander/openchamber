import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  BRAND_PROFILE_RESOURCE_NAME,
  brandDevEnvironment,
  brandRuntimePaths,
  parseBrandProfile,
  readActiveBrandProfile,
  resolveBrandProfile,
  sanitizeBrandLogoId,
  seedBrandDefaultHost,
} from './brand-profile.mjs';

const repoProfilesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'branding', 'profiles');

const validProfile = () => ({
  profileId: 'claudi',
  displayName: 'nomobodev',
  bundleId: 'de.nomobo.nomobodev.claudi',
  iconPath: 'branding/assets/claudi/icon.icns',
  updatesEnabled: false,
  localServer: false,
  registerDeepLinkProtocol: false,
  defaultHost: {
    id: 'claudi',
    label: 'Claudi',
    url: 'https://openchamber.c.nomobo.de/',
    brandLogoId: 'nomobo',
  },
});

const withTempDir = (run) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-profile-test-'));
  try {
    return run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test('resolves the checked-in claudi profile', () => {
  const profile = resolveBrandProfile('claudi', { profilesDir: repoProfilesDir });
  assert.equal(profile.profileId, 'claudi');
  assert.equal(profile.displayName, 'nomobodev');
  assert.equal(profile.bundleId, 'de.nomobo.nomobodev.claudi');
  assert.notEqual(profile.bundleId, 'dev.openchamber.desktop');
  assert.equal(profile.defaultHost.url, 'https://openchamber.c.nomobo.de/');
  assert.equal(profile.defaultHost.brandLogoId, 'nomobo');
  assert.equal(profile.updatesEnabled, false);
  assert.equal(profile.localServer, false);
  assert.equal(profile.registerDeepLinkProtocol, false);
});

test('every checked-in profile is valid, credential-free and has its own identity', () => {
  const files = fs.readdirSync(repoProfilesDir).filter((name) => name.endsWith('.json'));
  assert.ok(files.length > 0);
  const seen = { bundleId: new Set(), displayName: new Set() };
  for (const file of files) {
    const profile = resolveBrandProfile(path.basename(file, '.json'), { profilesDir: repoProfilesDir });
    for (const key of ['bundleId', 'displayName']) {
      assert.equal(seen[key].has(profile[key]), false, `${key} ${profile[key]} is used twice`);
      seen[key].add(profile[key]);
    }
    const text = fs.readFileSync(path.join(repoProfilesDir, file), 'utf8');
    assert.doesNotMatch(text, /token|secret|password|authorization/i);
  }
});

test('every checked-in profile has its icon, menu bar icons and switcher logo', () => {
  const repoRoot = path.resolve(repoProfilesDir, '..', '..');
  const trayLetters = new Map();
  for (const file of fs.readdirSync(repoProfilesDir).filter((name) => name.endsWith('.json'))) {
    const profile = resolveBrandProfile(path.basename(file, '.json'), { profilesDir: repoProfilesDir });
    assert.ok(fs.existsSync(path.join(repoRoot, profile.iconPath)), `${profile.profileId}: ${profile.iconPath}`);
    if (profile.trayIconsDir) {
      for (const name of ['trayTemplate-idle', 'trayTemplate-unseen', 'trayTemplate-breath-15']) {
        for (const suffix of ['.png', '@2x.png']) {
          const icon = path.join(repoRoot, profile.trayIconsDir, `${name}${suffix}`);
          assert.ok(fs.existsSync(icon), `${profile.profileId}: ${icon}`);
        }
      }
      const idle = fs.readFileSync(path.join(repoRoot, profile.trayIconsDir, 'trayTemplate-idle@2x.png')).toString('base64');
      assert.equal(trayLetters.has(idle), false, `${profile.profileId} shares its menu bar icon with ${trayLetters.get(idle)}`);
      trayLetters.set(idle, profile.profileId);
    }
    if (profile.defaultHost.brandLogoId) {
      const logo = path.join(repoRoot, 'packages', 'ui', 'src', 'assets', 'brand-logos', `${profile.defaultHost.brandLogoId}.png`);
      assert.ok(fs.existsSync(logo), `${profile.profileId}: ${logo}`);
    }
  }
});

test('an unknown profile is an explicit error', () => {
  assert.throws(
    () => resolveBrandProfile('does-not-exist', { profilesDir: repoProfilesDir }),
    /Unknown brand profile "does-not-exist"/,
  );
});

test('a profile id cannot escape the profiles directory', () => {
  assert.throws(
    () => resolveBrandProfile('../claudi', { profilesDir: repoProfilesDir }),
    /Invalid brand profile id/,
  );
});

test('missing required fields are rejected by name', () => {
  for (const field of ['profileId', 'displayName', 'bundleId', 'iconPath', 'updatesEnabled', 'localServer', 'registerDeepLinkProtocol', 'defaultHost']) {
    const raw = validProfile();
    delete raw[field];
    assert.throws(() => parseBrandProfile(raw), new RegExp(`"${field}"`), field);
  }
  const raw = validProfile();
  delete raw.defaultHost.url;
  assert.throws(() => parseBrandProfile(raw), /"defaultHost.url"/);
});

test('rejects a default host that is not plain https or that carries credentials', () => {
  for (const url of ['http://example.com/', 'https://user:pass@example.com/', 'http://user:pass@10.0.0.1/', 'ftp://example.com/']) {
    const raw = validProfile();
    raw.defaultHost.url = url;
    assert.throws(() => parseBrandProfile(raw), /"defaultHost.url"/, url);
  }
});

test('allows plain http only for private and Tailscale addresses', () => {
  for (const url of ['http://100.100.6.17:3000/', 'http://10.0.0.5/', 'http://192.168.1.2:3000/', 'http://172.20.0.1/', 'http://127.0.0.1:3000/', 'http://box.tail1234.ts.net/']) {
    const raw = validProfile();
    raw.defaultHost.url = url;
    assert.equal(parseBrandProfile(raw).defaultHost.url, url, url);
  }
  for (const url of ['http://8.8.8.8/', 'http://100.128.0.1/', 'http://172.32.0.1/', 'http://example.com/', 'http://ts.net.example.com/']) {
    const raw = validProfile();
    raw.defaultHost.url = url;
    assert.throws(() => parseBrandProfile(raw), /"defaultHost.url"/, url);
  }
});

test('an optional tray icon directory is kept as given', () => {
  const raw = validProfile();
  assert.equal(parseBrandProfile(raw).trayIconsDir, undefined);
  raw.trayIconsDir = 'branding/assets/tray-nomobo';
  assert.equal(parseBrandProfile(raw).trayIconsDir, 'branding/assets/tray-nomobo');
});

test('rejects credential fields anywhere in a profile', () => {
  const raw = validProfile();
  raw.defaultHost.clientToken = 'abc';
  assert.throws(() => parseBrandProfile(raw), /must not contain credentials/);
});

test('rejects a reserved local host id and the upstream bundle id', () => {
  const local = validProfile();
  local.defaultHost.id = 'local';
  assert.throws(() => parseBrandProfile(local), /"defaultHost.id"/);
  const upstream = validProfile();
  upstream.bundleId = 'dev.openchamber.desktop';
  assert.throws(() => parseBrandProfile(upstream), /"bundleId"/);
});

test('an unbranded packaged app has no active profile', () => {
  withTempDir((resourcesPath) => {
    assert.equal(readActiveBrandProfile({ packaged: true, resourcesPath, env: {} }), null);
  });
});

test('a packaged app reads the profile staged into its resources', () => {
  withTempDir((resourcesPath) => {
    fs.writeFileSync(path.join(resourcesPath, BRAND_PROFILE_RESOURCE_NAME), JSON.stringify(validProfile()));
    const profile = readActiveBrandProfile({ packaged: true, resourcesPath, env: {} });
    assert.equal(profile?.displayName, 'nomobodev');
  });
});

test('a malformed staged profile fails instead of falling back to the upstream identity', () => {
  withTempDir((resourcesPath) => {
    fs.writeFileSync(path.join(resourcesPath, BRAND_PROFILE_RESOURCE_NAME), '{"profileId":');
    assert.throws(() => readActiveBrandProfile({ packaged: true, resourcesPath, env: {} }), /brand profile/i);
  });
});

test('development selects a profile only through OPENCHAMBER_BRAND_PROFILE', () => {
  assert.equal(readActiveBrandProfile({ packaged: false, profilesDir: repoProfilesDir, env: {} }), null);
  const profile = readActiveBrandProfile({
    packaged: false,
    profilesDir: repoProfilesDir,
    env: { OPENCHAMBER_BRAND_PROFILE: 'claudi' },
  });
  assert.equal(profile?.profileId, 'claudi');
});

test('runtime paths are separate from the upstream OpenChamber locations', () => {
  const profile = parseBrandProfile(validProfile());
  const paths = brandRuntimePaths(profile, { appDataDir: '/Users/x/Library/Application Support', homeDir: '/Users/x' });
  assert.equal(paths.userDataDir, '/Users/x/Library/Application Support/nomobodev');
  assert.equal(paths.dataDir, '/Users/x/.config/nomobodev');
  assert.notEqual(paths.dataDir, '/Users/x/.config/openchamber');
});

test('development runs keep their state apart from the installed branded app', () => {
  const profile = parseBrandProfile(validProfile());
  const paths = brandRuntimePaths(profile, { appDataDir: '/A', homeDir: '/H', development: true });
  assert.equal(paths.userDataDir, '/A/nomobodev Dev');
  assert.equal(paths.dataDir, '/H/.config/nomobodev-dev');
});

test('a branded dev run points every dev process at the profile dev data directory', () => {
  const extra = brandDevEnvironment({
    env: { OPENCHAMBER_BRAND_PROFILE: 'claudi' },
    profilesDir: repoProfilesDir,
    homeDir: '/H',
  });
  assert.equal(extra.OPENCHAMBER_DATA_DIR, '/H/.config/nomobodev-dev');
});

test('a dev run of a profile without a local server uses bundled UI, so no dev server or local OpenCode starts', () => {
  const extra = brandDevEnvironment({
    env: { OPENCHAMBER_BRAND_PROFILE: 'claudi' },
    profilesDir: repoProfilesDir,
    homeDir: '/H',
  });
  assert.equal(extra.OPENCHAMBER_ELECTRON_USE_BUNDLED_UI, '1');
});

test('an unbranded dev run is left alone and an explicit data directory is kept', () => {
  assert.deepEqual(brandDevEnvironment({ env: {}, profilesDir: repoProfilesDir, homeDir: '/H' }), {});
  const extra = brandDevEnvironment({
    env: { OPENCHAMBER_BRAND_PROFILE: 'claudi', OPENCHAMBER_DATA_DIR: '/custom' },
    profilesDir: repoProfilesDir,
    homeDir: '/H',
  });
  assert.equal('OPENCHAMBER_DATA_DIR' in extra, false);
});

test('a branded dev run with an unknown profile fails before anything starts', () => {
  assert.throws(
    () => brandDevEnvironment({ env: { OPENCHAMBER_BRAND_PROFILE: 'nope' }, profilesDir: repoProfilesDir, homeDir: '/H' }),
    /Unknown brand profile "nope"/,
  );
});

test('brand logo ids are short identifiers, never paths or URLs', () => {
  assert.equal(sanitizeBrandLogoId('nomobo'), 'nomobo');
  assert.equal(sanitizeBrandLogoId('  nomobo  '), 'nomobo');
  for (const value of ['', '../x', 'https://example.com/logo.png', 'a/b', 'A'.repeat(40), 42, null, undefined]) {
    assert.equal(sanitizeBrandLogoId(value), null, String(value));
  }
});

test('seeds the default host into a fresh settings root', () => {
  const profile = parseBrandProfile(validProfile());
  const root = {};
  assert.equal(seedBrandDefaultHost(root, profile), true);
  assert.deepEqual(root.desktopHosts, [{
    id: 'claudi',
    label: 'Claudi',
    url: 'https://openchamber.c.nomobo.de/',
    apiUrl: 'https://openchamber.c.nomobo.de/',
    brandLogoId: 'nomobo',
  }]);
  assert.equal(root.desktopDefaultHostId, 'claudi');
  assert.equal(root.desktopInitialHostChoiceCompleted, true);
});

test('never overwrites hosts or a default the user already has', () => {
  const profile = parseBrandProfile(validProfile());
  const existing = {
    desktopHosts: [{ id: 'claudi', label: 'Renamed', url: 'https://openchamber.c.nomobo.de/', clientToken: 'kept' }],
    desktopDefaultHostId: 'claudi',
    desktopInitialHostChoiceCompleted: true,
  };
  const before = structuredClone(existing);
  assert.equal(seedBrandDefaultHost(existing, profile), false);
  assert.deepEqual(existing, before);

  const removedAll = { desktopHosts: [], desktopDefaultHostId: null, desktopInitialHostChoiceCompleted: true };
  assert.equal(seedBrandDefaultHost(removedAll, profile), false);
});
