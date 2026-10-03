/**
 * Build profiles for branded desktop apps built from this checkout.
 *
 * A profile gives a build its own name, bundle id, icon and default instance.
 * Packaging stages the resolved profile into the app's resources as
 * `brand-profile.json`; at runtime `entry.mjs` reads it before anything else so
 * the Electron profile, single-instance lock, logs and settings directory are
 * separate from an installed upstream OpenChamber. Without a staged profile the
 * app behaves exactly like upstream.
 *
 * Profiles never contain credentials; those stay in the user's settings file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const BRAND_PROFILE_RESOURCE_NAME = 'brand-profile.json';
const UPSTREAM_BUNDLE_ID = 'dev.openchamber.desktop';
const RESERVED_HOST_ID = 'local';
const PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const CREDENTIAL_KEY_PATTERN = /token|secret|password|authorization/i;

const BRAND_LOGO_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

const brandLogoIdSchema = z.string().trim().regex(BRAND_LOGO_ID_PATTERN, 'must be a short lowercase identifier');

/** Logo ids name images bundled with the UI; anything else is dropped. */
export const sanitizeBrandLogoId = (value) => {
  const result = brandLogoIdSchema.safeParse(value);
  return result.success ? result.data : null;
};

const requiredString = z.string('must be a non-empty string').trim().min(1, 'must be a non-empty string');
const requiredBoolean = z.boolean('must be true or false');

const httpsUrlWithoutCredentials = requiredString.transform((value, context) => {
  const url = URL.parse(value);
  if (!url || url.protocol !== 'https:' || url.username || url.password) {
    context.addIssue({ code: 'custom', message: 'must be an https URL without credentials' });
    return z.NEVER;
  }
  return url.toString();
});

const defaultHostSchema = z.strictObject({
  id: requiredString.refine((id) => id !== RESERVED_HOST_ID, `must not be the reserved id "${RESERVED_HOST_ID}"`),
  label: requiredString,
  url: httpsUrlWithoutCredentials,
  brandLogoId: brandLogoIdSchema.optional(),
}, 'must be an object');

const brandProfileSchema = z.strictObject({
  profileId: requiredString.regex(PROFILE_ID_PATTERN, 'must use lowercase letters, digits and dashes'),
  displayName: requiredString,
  bundleId: requiredString.refine((id) => id !== UPSTREAM_BUNDLE_ID, 'must differ from the upstream OpenChamber bundle id'),
  iconPath: requiredString,
  updatesEnabled: requiredBoolean,
  localServer: requiredBoolean,
  registerDeepLinkProtocol: requiredBoolean,
  defaultHost: defaultHostSchema,
}, 'expected a JSON object');

// Credentials belong in the user's settings, never in a profile that is
// committed and copied into every app bundle.
const assertNoCredentials = (raw) => {
  JSON.stringify(raw, (key, value) => {
    if (CREDENTIAL_KEY_PATTERN.test(key)) {
      throw new Error(`Invalid brand profile: must not contain credentials ("${key}")`);
    }
    return value;
  });
};

export const parseBrandProfile = (raw) => {
  assertNoCredentials(raw);
  const result = brandProfileSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.length > 0 ? `"${issue.path.join('.')}" ` : '';
    throw new Error(`Invalid brand profile: ${field}${issue.message}`);
  }
  return result.data;
};

const readProfileFile = (filePath) => {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw new Error(`Cannot read brand profile at ${filePath}: ${error.message}`);
  }
  try {
    return parseBrandProfile(JSON.parse(text));
  } catch (error) {
    throw new Error(`Cannot use brand profile at ${filePath}: ${error.message}`);
  }
};

export const resolveBrandProfile = (profileId, { profilesDir }) => {
  if (!PROFILE_ID_PATTERN.test(String(profileId))) {
    throw new Error(`Invalid brand profile id "${profileId}"`);
  }
  const profile = readProfileFile(path.join(profilesDir, `${profileId}.json`));
  if (!profile) throw new Error(`Unknown brand profile "${profileId}"`);
  if (profile.profileId !== profileId) {
    throw new Error(`Brand profile file ${profileId}.json declares profileId "${profile.profileId}"`);
  }
  return profile;
};

/**
 * Packaged apps use only the profile staged into their resources, so a Dock
 * or Finder launch (which carries no custom environment) still gets its own
 * identity. Development selects a checked-in profile by name.
 */
export const readActiveBrandProfile = ({ packaged, resourcesPath, profilesDir, env = process.env }) => {
  if (packaged) {
    return readProfileFile(path.join(resourcesPath, BRAND_PROFILE_RESOURCE_NAME));
  }
  const profileId = String(env.OPENCHAMBER_BRAND_PROFILE || '').trim();
  return profileId ? resolveBrandProfile(profileId, { profilesDir }) : null;
};

export const brandRuntimePaths = (profile, { appDataDir, homeDir, development = false }) => ({
  userDataDir: path.join(appDataDir, development ? `${profile.displayName} Dev` : profile.displayName),
  dataDir: path.join(homeDir, '.config', development ? `${profile.displayName}-dev` : profile.displayName),
});

/**
 * Variables `electron:dev` adds to every dev process for a branded run. Only
 * Electron reads the profile itself, so without them the HMR dev server would
 * use the upstream `~/.config/openchamber` data (settings, message queues) of
 * an installed OpenChamber. A profile without a local server also runs on
 * bundled UI: the HMR dev server always starts a local OpenCode, and with a
 * remote default the window would load the remote page without desktop IPC.
 */
export const brandDevEnvironment = ({ env, profilesDir, homeDir }) => {
  const profile = readActiveBrandProfile({ packaged: false, profilesDir, env });
  if (!profile) return {};
  const extra = {};
  if (!String(env.OPENCHAMBER_DATA_DIR || '').trim()) {
    extra.OPENCHAMBER_DATA_DIR = brandRuntimePaths(profile, { appDataDir: '', homeDir, development: true }).dataDir;
  }
  if (!profile.localServer) {
    extra.OPENCHAMBER_ELECTRON_USE_BUNDLED_UI = '1';
  }
  return extra;
};

/**
 * First-launch default: the profile's instance, already chosen. Settings that
 * have ever held a host list or a completed instance choice are the user's and
 * stay untouched.
 */
export const seedBrandDefaultHost = (root, profile) => {
  if (Object.prototype.hasOwnProperty.call(root, 'desktopHosts') || root.desktopInitialHostChoiceCompleted === true) {
    return false;
  }
  const { id, label, url, brandLogoId } = profile.defaultHost;
  const host = { id, label, url, apiUrl: url };
  if (brandLogoId) host.brandLogoId = brandLogoId;
  root.desktopHosts = [host];
  root.desktopDefaultHostId = id;
  root.desktopInitialHostChoiceCompleted = true;
  return true;
};
