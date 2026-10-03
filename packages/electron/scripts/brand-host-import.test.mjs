import assert from 'node:assert/strict';
import test from 'node:test';

import { parseBrandProfile } from '../brand-profile.mjs';
import { importBrandHost } from './brand-host-import.mjs';

const profile = parseBrandProfile({
  profileId: 'claudi',
  displayName: 'nomobodev',
  bundleId: 'de.nomobo.nomobodev.claudi',
  iconPath: 'branding/assets/claudi/icon.icns',
  updatesEnabled: false,
  localServer: false,
  registerDeepLinkProtocol: false,
  defaultHost: { id: 'claudi', label: 'Claudi', url: 'https://openchamber.c.nomobo.de/', brandLogoId: 'nomobo' },
});

const source = () => ({
  desktopHosts: [
    { id: 'other', label: 'Other', url: 'https://other.example/', clientToken: 'other-token' },
    {
      id: 'host-19f',
      label: 'Claudi',
      url: 'https://openchamber.c.nomobo.de',
      apiUrl: 'https://openchamber.c.nomobo.de/',
      clientToken: 'claudi-token',
      requestHeaders: { 'CF-Access-Client-Id': 'abc' },
    },
  ],
  desktopDefaultHostId: 'local',
  relaySigningKey: 'must-not-be-copied',
  projects: [{ path: '/private' }],
});

test('copies only the connection fields of the matching host under the profile id', () => {
  const result = importBrandHost({ targetRoot: {}, sourceRoot: source(), profile });
  assert.deepEqual(result.root, {
    desktopHosts: [{
      id: 'claudi',
      label: 'Claudi',
      url: 'https://openchamber.c.nomobo.de/',
      apiUrl: 'https://openchamber.c.nomobo.de/',
      brandLogoId: 'nomobo',
      clientToken: 'claudi-token',
      requestHeaders: { 'CF-Access-Client-Id': 'abc' },
    }],
    desktopDefaultHostId: 'claudi',
    desktopInitialHostChoiceCompleted: true,
  });
  assert.deepEqual(result.summary, { matchedHostLabel: 'Claudi', tokenCopied: true, replacedExisting: false });
});

test('replaces only the profile host and keeps the rest of an existing target', () => {
  const targetRoot = {
    desktopHosts: [
      { id: 'claudi', label: 'My Claudi', url: 'https://openchamber.c.nomobo.de/', clientToken: 'old' },
      { id: 'extra', label: 'Extra', url: 'https://extra.example/' },
    ],
    desktopDefaultHostId: 'extra',
    desktopInitialHostChoiceCompleted: true,
    themeId: 'dark',
  };
  const result = importBrandHost({ targetRoot, sourceRoot: source(), profile });
  assert.equal(result.root.desktopHosts.length, 2);
  assert.equal(result.root.desktopHosts[0].clientToken, 'claudi-token');
  assert.equal(result.root.desktopHosts[0].label, 'My Claudi');
  assert.deepEqual(result.root.desktopHosts[1], { id: 'extra', label: 'Extra', url: 'https://extra.example/' });
  assert.equal(result.root.desktopDefaultHostId, 'extra');
  assert.equal(result.root.themeId, 'dark');
  assert.equal(result.summary.replacedExisting, true);
  assert.equal(targetRoot.desktopHosts[0].clientToken, 'old', 'input is not mutated');
});

test('fails clearly when the source has no host for the profile URL', () => {
  assert.throws(
    () => importBrandHost({ targetRoot: {}, sourceRoot: { desktopHosts: [] }, profile }),
    /No host for https:\/\/openchamber\.c\.nomobo\.de\/ in the source settings/,
  );
});

test('error messages never contain the token', () => {
  const sourceRoot = source();
  sourceRoot.desktopHosts[1].url = 'not a url claudi-token';
  sourceRoot.desktopHosts[1].apiUrl = 'not a url claudi-token';
  try {
    importBrandHost({ targetRoot: {}, sourceRoot, profile });
  } catch (error) {
    assert.doesNotMatch(String(error.message), /claudi-token/);
    return;
  }
  assert.fail('expected an error');
});
