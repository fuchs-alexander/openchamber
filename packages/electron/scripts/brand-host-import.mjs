/**
 * Copies one existing connection (URL, token, request headers) from an
 * OpenChamber settings file into a branded app's settings, under the profile's
 * host id. Nothing else is read from the source; it is never written.
 *
 * An entry the branded app already has keeps its own token, headers and other
 * fields: a token there may come from a newer login than the source's, so it
 * is replaced only with `replaceToken`. A missing source token never removes one.
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

export const importBrandHost = ({ targetRoot, sourceRoot, profile, replaceToken = false }) => {
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
  const existing = existingIndex >= 0 ? existingHosts[existingIndex] : {};
  const existingConnection = sourceHostSchema.parse(existing);

  const { id, label, url, brandLogoId } = profile.defaultHost;
  const host = { ...existing, id, label: existingConnection.label || label, url, apiUrl: url };
  const logoId = sanitizeBrandLogoId(brandLogoId);
  if (logoId) host.brandLogoId = logoId;

  let token = 'none';
  if (existingConnection.clientToken && !(replaceToken && match.clientToken)) {
    token = 'kept-existing';
  } else if (match.clientToken) {
    host.clientToken = match.clientToken;
    token = existingConnection.clientToken ? 'replaced' : 'copied';
  }
  const hasOwnHeaders = existingConnection.requestHeaders && Object.keys(existingConnection.requestHeaders).length > 0;
  if (!hasOwnHeaders && match.requestHeaders && Object.keys(match.requestHeaders).length > 0) {
    host.requestHeaders = match.requestHeaders;
  }

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
      token,
      replacedExisting: existingIndex >= 0,
    },
  };
};
