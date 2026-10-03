/**
 * Derives the electron-builder configuration for a branded build from the
 * upstream `build` block in package.json. Only identity, icon, update feed and
 * output location change; everything else follows upstream so a merged
 * upstream release packages the same way.
 */

import path from 'node:path';

import { BRAND_PROFILE_RESOURCE_NAME } from '../brand-profile.mjs';

export const buildBrandBuilderConfig = (baseBuild, profile, { repoRoot, stagedProfilePath }) => {
  const config = structuredClone(baseBuild);
  config.appId = profile.bundleId;
  config.productName = profile.displayName;
  config.extraResources = [
    ...config.extraResources.flatMap((entry) => (
      entry.to === 'icons/tray' && profile.trayIconsDir
        // Menu bar icons from the profile; the per-session status glyphs stay upstream.
        ? [
            { from: path.join(repoRoot, profile.trayIconsDir), to: 'icons/tray' },
            { from: 'resources/icons/tray/status', to: 'icons/tray/status' },
          ]
        : [entry]
    )),
    { from: stagedProfilePath, to: BRAND_PROFILE_RESOURCE_NAME },
  ];
  config.directories = { ...config.directories, output: `dist/brand-${profile.profileId}` };

  // The upstream Assets.car carries the OpenChamber icon and wins over the
  // .icns on current macOS; branded builds ship only the profile icon.
  const { CFBundleIconName: _upstreamIconName, ...extendInfo } = config.mac.extendInfo;
  config.mac = {
    ...config.mac,
    icon: path.join(repoRoot, profile.iconPath),
    extendInfo: {
      ...extendInfo,
      NSLocalNetworkUsageDescription: `${profile.displayName} needs access to devices and services on your local network.`,
    },
    // Local, manually installed builds: an app bundle, ad-hoc signed, not
    // notarized. Distributable artifacts need their own signing decision.
    target: ['dir'],
    identity: '-',
    notarize: false,
  };

  if (!profile.updatesEnabled) {
    config.publish = null;
  }
  return config;
};
