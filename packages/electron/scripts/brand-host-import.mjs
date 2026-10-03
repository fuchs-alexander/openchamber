/**
 * Copies one existing connection (URL, token, request headers) from an
 * OpenChamber settings file into a branded app's settings, under the profile's
 * host id. Nothing else is read from the source; it is never written.
 */

import { z } from 'zod';

import { sanitizeBrandLogoId } from '../brand-profile.mjs';

const sourceHostSchema = z.looseObject({
  label: z.string().optional().catch(undefined),
  url: z.string().catch(''),
  apiUrl: z.string().optional().catch(undefined),
  clientToken: z.string().trim().min(1).optional().catch(undefined),
  requestHeaders: z.record(z.string(), z.string()).optional().catch(undefined),
});

const settingsHostsSchema = z.looseObject({
  desktopHosts: z.array(z.unknown()).catch([]),
});

const hostKey = (value) => {
  const url = URL.parse(value);
  if (!url) return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
};

export const importBrandHost = ({ targetRoot, sourceRoot, profile }) => {
  const wanted = hostKey(profile.defaultHost.url);
  const sourceHosts = settingsHostsSchema.parse(sourceRoot ?? {}).desktopHosts
    .map((entry) => sourceHostSchema.safeParse(entry))
    .filter((result) => result.success)
    .map((result) => result.data);
  const match = sourceHosts.find((host) => hostKey(host.apiUrl || host.url) === wanted || hostKey(host.url) === wanted);
  if (!match) {
    throw new Error(`No host for ${profile.defaultHost.url} in the source settings`);
  }

  const root = structuredClone(targetRoot ?? {});
  const existingHosts = settingsHostsSchema.parse(root).desktopHosts;
  const existingIndex = existingHosts.findIndex((host) => sourceHostSchema.safeParse(host).success && host.id === profile.defaultHost.id);
  const existing = existingIndex >= 0 ? existingHosts[existingIndex] : null;

  const { id, label, url, brandLogoId } = profile.defaultHost;
  const host = { id, label: existing?.label || label, url, apiUrl: url };
  const logoId = sanitizeBrandLogoId(brandLogoId);
  if (logoId) host.brandLogoId = logoId;
  if (match.clientToken) host.clientToken = match.clientToken;
  if (match.requestHeaders && Object.keys(match.requestHeaders).length > 0) host.requestHeaders = match.requestHeaders;

  const hosts = [...existingHosts];
  if (existingIndex >= 0) {
    hosts[existingIndex] = host;
  } else {
    hosts.unshift(host);
  }
  root.desktopHosts = hosts;
  if (!root.desktopDefaultHostId) root.desktopDefaultHostId = id;
  root.desktopInitialHostChoiceCompleted = true;

  return {
    root,
    summary: {
      matchedHostLabel: match.label || '',
      tokenCopied: Boolean(match.clientToken),
      replacedExisting: existingIndex >= 0,
    },
  };
};
