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
  assert.deepEqual(result.summary, { matchedHostLabel: 'Claudi', token: 'copied', replacedExisting: false });
});

const existingTarget = () => ({
  desktopHosts: [
    {
      id: 'claudi',
      label: 'My Claudi',
      url: 'https://old.example/',
      clientToken: 'fresh-login-token',
      requestHeaders: { 'X-Own': 'kept' },
      relay: { relayUrl: 'wss://relay.example', serverId: 's1', hostEncPubJwk: { kty: 'EC' } },
    },
    { id: 'extra', label: 'Extra', url: 'https://extra.example/' },
  ],
  desktopDefaultHostId: 'extra',
  desktopInitialHostChoiceCompleted: true,
  themeId: 'dark',
});

test('updates only the profile host and keeps the rest of an existing target', () => {
  const targetRoot = existingTarget();
  const result = importBrandHost({ targetRoot, sourceRoot: source(), profile });
  assert.equal(result.root.desktopHosts.length, 2);
  const [claudi, extra] = result.root.desktopHosts;
  assert.equal(claudi.label, 'My Claudi');
  assert.equal(claudi.url, 'https://openchamber.c.nomobo.de/');
  assert.equal(claudi.apiUrl, 'https://openchamber.c.nomobo.de/');
  assert.equal(claudi.brandLogoId, 'nomobo');
  assert.deepEqual(extra, { id: 'extra', label: 'Extra', url: 'https://extra.example/' });
  assert.equal(result.root.desktopDefaultHostId, 'extra');
  assert.equal(result.root.themeId, 'dark');
  assert.equal(result.summary.replacedExisting, true);
  assert.equal(targetRoot.desktopHosts[0].url, 'https://old.example/', 'input is not mutated');
});

test('keeps an existing token instead of overwriting it with the source token', () => {
  const result = importBrandHost({ targetRoot: existingTarget(), sourceRoot: source(), profile });
  assert.equal(result.root.desktopHosts[0].clientToken, 'fresh-login-token');
  assert.equal(result.summary.token, 'kept-existing');
});

test('never removes an existing token when the source has none', () => {
  const sourceRoot = source();
  delete sourceRoot.desktopHosts[1].clientToken;
  const result = importBrandHost({ targetRoot: existingTarget(), sourceRoot, profile });
  assert.equal(result.root.desktopHosts[0].clientToken, 'fresh-login-token');
  assert.equal(result.summary.token, 'kept-existing');
});

test('replaces an existing token only when asked to', () => {
  const result = importBrandHost({ targetRoot: existingTarget(), sourceRoot: source(), profile, replaceToken: true });
  assert.equal(result.root.desktopHosts[0].clientToken, 'claudi-token');
  assert.equal(result.summary.token, 'replaced');
});

test('keeps request headers and relay settings of the existing entry', () => {
  const result = importBrandHost({ targetRoot: existingTarget(), sourceRoot: source(), profile });
  const [claudi] = result.root.desktopHosts;
  assert.deepEqual(claudi.requestHeaders, { 'X-Own': 'kept' });
  assert.equal(claudi.relay.serverId, 's1');
});

test('fills in a missing token and headers on an existing entry', () => {
  const targetRoot = existingTarget();
  delete targetRoot.desktopHosts[0].clientToken;
  delete targetRoot.desktopHosts[0].requestHeaders;
  const result = importBrandHost({ targetRoot, sourceRoot: source(), profile });
  assert.equal(result.root.desktopHosts[0].clientToken, 'claudi-token');
  assert.deepEqual(result.root.desktopHosts[0].requestHeaders, { 'CF-Access-Client-Id': 'abc' });
  assert.equal(result.summary.token, 'copied');
});

test('reports when neither side has a token', () => {
  const sourceRoot = source();
  delete sourceRoot.desktopHosts[1].clientToken;
  const result = importBrandHost({ targetRoot: {}, sourceRoot, profile });
  assert.equal('clientToken' in result.root.desktopHosts[0], false);
  assert.equal(result.summary.token, 'none');
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

test('a profile without a default host has nothing to import', () => {
  const local = parseBrandProfile({
    profileId: 'nomobolocal',
    displayName: 'nomobolocal',
    bundleId: 'de.nomobo.nomobolocal',
    iconPath: 'branding/assets/nomobolocal/icon.icns',
    updatesEnabled: false,
    localServer: true,
    shareUpstreamData: true,
    registerDeepLinkProtocol: false,
  });
  assert.throws(() => importBrandHost({ targetRoot: {}, sourceRoot: source(), profile: local }), /has no default host/);
});
