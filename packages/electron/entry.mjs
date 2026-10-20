/**
 * Desktop entry module. Electron holds the `ready` event until this module's
 * whole import graph has evaluated, so it stays small on purpose: the
 * configuration that must precede `ready`, the single-instance lock, and the
 * first window. The rest of the main process (`main.mjs`, the server, the
 * updater, IPC) is imported only after `ready`, so the window is on screen
 * while that loads. Starting the import earlier would delay `ready` itself:
 * module evaluation runs on the thread Chromium needs to finish initialising.
 */

import { app, dialog, protocol } from 'electron';
import os from 'node:os';
import path from 'node:path';
import { enableMainProcessCompileCache } from './compile-cache.mjs';
import { shouldIgnoreLoopbackConnectionLimit } from './startup-url-selection.mjs';
import { brandRuntimePaths, isUpstreamAppRunning } from './brand-profile.mjs';
import {
  APP_USER_MODEL_ID,
  UI_PROTOCOL,
  activeBrandProfile,
  createEarlyWindow,
  deferAppEventsUntilMainLoads,
  isDev,
  recordEarlyStartupMark,
  shellEnvironmentProbeBlocksMainThread,
  shouldStartInBackground,
  startShellEnvironmentProbe,
} from './early-startup.mjs';

recordEarlyStartupMark('electron.entry');

// Set the product name early so electron-log derives its log directory as
// ~/Library/Logs/OpenChamber/ (not ~/Library/Logs/@openchamber/electron/).
const versionBeforeRename = app.getVersion();
app.setName(activeBrandProfile?.displayName || 'OpenChamber');
// An unpackaged run on Linux reports version "0.0" after the rename, and
// electron-updater refuses a version that is not semver, so the dev app quit
// before its first window. Restoring the version from before the rename gives
// it Electron's own version, as on macOS. `setVersion` is undocumented;
// Electron's default app uses it to apply a package.json version.
if (app.getVersion() !== versionBeforeRename) {
  app.setVersion(versionBeforeRename);
}
if (process.platform === 'linux' && !activeBrandProfile) {
  app.setDesktopName('openchamber.desktop');
}
if (activeBrandProfile) {
  // A branded app gets its own Electron profile (and with it its own
  // single-instance lock) and its own settings directory, so it runs next to
  // an installed OpenChamber without sharing state. These must be set before
  // the lock below and before anything reads settings.
  const brandPaths = brandRuntimePaths(activeBrandProfile, {
    appDataDir: app.getPath('appData'),
    homeDir: os.homedir(),
    development: isDev,
  });
  app.setPath('userData', brandPaths.userDataDir);
  if (!String(process.env.OPENCHAMBER_DATA_DIR || '').trim()) {
    process.env.OPENCHAMBER_DATA_DIR = brandPaths.dataDir;
  }
  if (!activeBrandProfile.localServer) {
    process.env.OPENCHAMBER_SKIP_LOCAL_SERVER = '1';
  }
} else if (isDev) {
  app.setPath('userData', path.join(app.getPath('appData'), 'OpenChamber Dev'));
}
// Test hook for scripts/profile-startup.mjs: a packaged launch that must not
// share the single-instance lock or the Chromium profile with the installed
// app. macOS resolves the home directory from the user record, not $HOME, so
// an environment-only isolation cannot move these.
const userDataOverride = String(process.env.OPENCHAMBER_DESKTOP_USER_DATA_DIR || '').trim();
if (userDataOverride) {
  app.setPath('userData', userDataOverride);
}
// After the userData path is final, before main.mjs and the server load.
enableMainProcessCompileCache({ packaged: app.isPackaged, userDataDir: app.getPath('userData') });
app.setAppUserModelId(APP_USER_MODEL_ID);
// Resolve preview names in Chromium, not through the configured proxy.
app.commandLine.appendSwitch('proxy-bypass-list', '<-loopback>;openchamber-preview.localhost');
// Lift Chromium's per-host cap only for bundled UI. Applying this to Vite HMR
// lets the renderer request most of the module graph at once, overwhelming the
// dev server's transform pipeline and leaving the HTML splash visible for up
// to a minute before React mounts.
// Keep localhost out: Electron also matches its subdomains, including the
// browser panel's forwarded previews.
if (shouldIgnoreLoopbackConnectionLimit({
  development: isDev,
  packagedUi: process.env.OPENCHAMBER_ELECTRON_USE_BUNDLED_UI === '1',
})) {
  app.commandLine.appendSwitch('ignore-connections-limit', '127.0.0.1');
}
// Development only: lets a debugger or an agent attach to the dev window over
// CDP. Chromium binds the port to loopback.
const devRemoteDebuggingPort = String(process.env.OPENCHAMBER_ELECTRON_REMOTE_DEBUGGING_PORT || '').trim();
if (isDev && /^\d+$/.test(devRemoteDebuggingPort)) {
  app.commandLine.appendSwitch('remote-debugging-port', devRemoteDebuggingPort);
}
protocol.registerSchemesAsPrivileged([
  {
    scheme: UI_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      // Keep V8 bytecode for the packaged renderer bundle between launches.
      codeCache: true,
    },
  },
]);

if (!app.requestSingleInstanceLock()) {
  app.exit(0);
  process.exit(0);
}

// Deep links and second launches can arrive before main.mjs has its handlers.
deferAppEventsUntilMainLoads();

app.whenReady().then(async () => {
  recordEarlyStartupMark('electron.app.ready');
  // A branded app that serves OpenChamber's own settings directory must not
  // run next to OpenChamber: both local servers would work the same message
  // queues and settings.
  if (activeBrandProfile?.shareUpstreamData && !isDev && isUpstreamAppRunning({ appDataDir: app.getPath('appData') })) {
    dialog.showMessageBoxSync({
      type: 'warning',
      message: `OpenChamber is running`,
      detail: `${activeBrandProfile.displayName} uses the same local projects and settings as OpenChamber. Quit OpenChamber, then open ${activeBrandProfile.displayName} again.`,
      buttons: ['OK'],
    });
    app.exit(0);
    return;
  }
  // The login shell runs in its own process; only its spawn touches this thread.
  if (!shellEnvironmentProbeBlocksMainThread) void startShellEnvironmentProbe().catch(() => {});
  // A login-item or --background launch has no window to show. Otherwise the
  // splash gets the main thread to itself until it is on screen: loading the
  // main module and the server behind it would starve its first paint.
  if (!shouldStartInBackground()) {
    await createEarlyWindow().whenShown;
  }
  if (shellEnvironmentProbeBlocksMainThread) void startShellEnvironmentProbe().catch(() => {});
  return import('./main.mjs');
}).catch((error) => {
  console.error('[electron] startup failed before the main module loaded:', error);
  app.exit(1);
});
