# nomobodev: Builds, Profile und Updates

Dieser Fork baut aus einem Codestand mehrere gebrandete macOS-Apps. Jede App ist ein Build-Profil in `branding/profiles/<id>.json`. Es gibt keine Branches je Server; alle Profile liegen auf dem Branch `nomobo`.

## Stand

- Upstream basis: release `v2.4.0`, commit `6a10ee19a12a1542cad01eee5add14e030ba4ac4`. Package tests, workspace checks and all six profile builds passed; nomobolocal still needs a separate installation handoff.
- Fork: `github.com/fuchs-alexander/openchamber`, Branch `nomobo`. Remotes: `origin` ist der Fork, `upstream` ist `openchamber/openchamber`.
- Profile:

| Profil | App | Bundle-ID | Server | Icon |
|---|---|---|---|---|
| `claudi` | `nomobodev` | `de.nomobo.nomobodev.claudi` | `https://openchamber.c.nomobo.de/` | nomobo / DEV auf `#07090E` |
| `nomobogaming` | `nomobogaming` | `de.nomobo.nomobogaming` | `http://100.100.6.17:3000/` (Tailscale) | nomobo / GAMING auf `#1F1147` |
| `nomobohosting` | `nomobohosting` | `de.nomobo.nomobohosting` | `https://oc.nomobo.de/` | nomobo / HOSTING auf `#142B49` |
| `posylka` | `posylka` | `de.nomobo.posylka` | `https://openchamber.colibo.io/` | nomobo / POSYLKA auf dem Orange des posylka.de-Favicons |
| `sofasx` | `sofasx` | `de.nomobo.sofasx` | `https://af.oc.nomobo.de/` | nomobo / OKES auf dem Rot des OKES-Logos |
| `nomobolocal` | `nomobolocal` | `de.nomobo.nomobolocal` | lokaler Server, Daten von OpenChamber | nomobo / LOCAL auf `#0E3B36` |

Menüleiste: jede App hat ihren Buchstaben in einer Kachel (D, G, H, P, S, L). Ein Test stellt sicher, dass keine zwei Profile dasselbe Menüleisten-Icon haben und dass Icon, Menüleisten-Icons und Auswahl-Logo jedes Profils existieren.

## Was ein Profil steuert

| Feld | Wirkung |
|---|---|
| `displayName` | App-Name, Name des Bundles, Electron-Profil `~/Library/Application Support/<displayName>`, Logs `~/Library/Logs/<displayName>`, Einstellungen `~/.config/<displayName>/` |
| `bundleId` | macOS-Bundle-ID. Muss je Profil eindeutig sein und darf nicht `dev.openchamber.desktop` sein. |
| `iconPath` | `.icns` für App und Dock |
| `trayIconsDir` | optional: eigene Menüleisten-Icons (`trayTemplate-idle`, `-unseen`, `-breath-00` bis `-15`, je 1x und @2x). Die Statussymbole in den Menüzeilen bleiben die von Upstream. |
| `updatesEnabled` | `false`: kein Update-Feed im Bundle, der Updater wird nicht eingerichtet, Update-Prüfung meldet immer "kein Update" |
| `localServer` | `false`: kein lokaler OpenChamber-Server und kein lokales `opencode`. Ist der Server nicht erreichbar, zeigt die App eine Wiederholen-Seite statt auf "Local" zu wechseln. "Local" fehlt in der Server-Auswahl. |
| `shareUpstreamData` | optional, nur mit `localServer: true`: die App nutzt OpenChamber's Einstellungsverzeichnis `~/.config/openchamber` (Projekte, Server, Warteschlangen). Das Electron-Profil bleibt eigenes. Die App startet nicht, solange OpenChamber läuft (Prüfung über OpenChamber's Single-Instance-Lock), und zeigt dann einen Hinweis. Die Gegenrichtung lässt sich nicht absichern: OpenChamber nicht starten, während nomobolocal läuft. Im Dev-Modus nutzt sie nie die echten Daten. |
| `registerDeepLinkProtocol` | `false`: die App übernimmt `openchamber://` nicht von der Original-App |
| `defaultHost` | Pflicht ohne lokalen Server. Server, der bei leeren Einstellungen eingetragen und als Standard gesetzt wird. `brandLogoId` wählt ein Logo aus `packages/ui/src/assets/brand-logos/`. Die URL muss `https` sein. `http` ist nur für private Netze und Tailscale erlaubt (10/8, 172.16/12, 192.168/16, 100.64/10, Loopback, `*.ts.net`). |

Profile enthalten nie Zugangsdaten. Der Parser lehnt Felder mit `token`, `secret`, `password` oder `authorization` im Namen ab.

Beim Packaging landet das Profil als `Contents/Resources/brand-profile.json` im Bundle. `entry.mjs` liest es vor allem anderen. Deshalb bekommt die App auch beim Start aus Dock oder Finder ihre eigene Identität. Ohne diese Datei verhält sich der Build wie Upstream.

## Voraussetzungen

- The release declares Bun `1.4.3` in `packageManager`. The 2026-10-15 update used the existing Bun `1.4.2` for the frozen install, checks and all builds; the installed Bun was left unchanged. Add `~/.bun/bin` to `PATH` before the commands.
- Node `24.14` or newer, as required by the web package. The installed Homebrew Node is used for builds.
- Xcode Command Line Tools für `swift`, `sips`, `iconutil`, `codesign`. Ein volles Xcode ist nicht nötig, weil gebrandete Builds kein `Assets.car` brauchen.

## App bauen

```sh
export PATH="$HOME/.bun/bin:$PATH"
bun install
OPENCHAMBER_BRAND_PROFILE=claudi bun run electron:build
OPENCHAMBER_BRAND_PROFILE=nomobogaming bun run electron:build
OPENCHAMBER_BRAND_PROFILE=nomobohosting bun run electron:build
OPENCHAMBER_BRAND_PROFILE=posylka bun run electron:build
OPENCHAMBER_BRAND_PROFILE=sofasx bun run electron:build
OPENCHAMBER_BRAND_PROFILE=nomobolocal bun run electron:build
```

Ergebnis: `packages/electron/dist/brand-<profil>/mac-arm64/<App>.app`, z. B. `brand-claudi/mac-arm64/nomobodev.app`. Der Build ist ad-hoc signiert und nicht notarisiert. Lokal gebaute Apps tragen kein Quarantäne-Attribut, deshalb startet macOS sie trotzdem. `spctl -a` meldet `rejected`. Das ist erwartet. Eine App, die heruntergeladen oder per AirDrop weitergegeben wird, blockiert Gatekeeper. Für Weitergabe braucht es eine Developer-ID-Signatur und Notarisierung.

Bundle prüfen:

```sh
A=packages/electron/dist/brand-claudi/mac-arm64/nomobodev.app
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' -c 'Print :CFBundleName' "$A/Contents/Info.plist"
cat "$A/Contents/Resources/brand-profile.json"
ls "$A/Contents/Resources" | grep -E 'app-update|Assets.car'   # muss leer bleiben
codesign --verify --deep --strict "$A"
```

## Installieren und manuell aktualisieren

1. Quit the app with Cmd+Q. Confirm its main process and helpers have exited. Do not quit nomobolocal while it hosts the agent doing the update; finish the repository work first, then replace that app from a separate terminal.
2. Preserve the old bundle outside `/Applications` for rollback. Stage the new app next to its destination, verify its signature, then replace the complete bundle. Copying over an existing bundle can leave obsolete files behind. Leave `/Applications/OpenChamber.app` unchanged.
3. Start the new app. Its connection, selected server and window settings live outside the bundle in `~/.config/<displayName>/` and `~/Library/Application Support/<displayName>/`. Do not reimport credentials during an ordinary update.

Damit das Icon dauerhaft im Dock bleibt: Rechtsklick auf das laufende Icon, "Optionen", "Im Dock behalten".

## Zugang übernehmen

Das Skript kopiert für ein Profil genau einen Eintrag aus den OpenChamber-Einstellungen: URL, Token und Request-Header des Servers mit der Profil-URL. Sonst nichts. Hat die App für diesen Server schon einen Eintrag, bleiben dessen Token, Header und übrige Einstellungen erhalten, denn ein dort gespeicherter Token kann aus einer neueren Anmeldung stammen. Den Token überschreibt nur `--replace-token`. Fehlt in der Quelle ein Token, wird keiner gelöscht. Die Ausgabe sagt jeweils, was mit dem Token passiert ist. Die Quelldatei wird nur gelesen. Eine vorhandene Zieldatei wird vorher daneben als `settings.json.backup-<Zeit>` gesichert. Ziel und Verzeichnis bekommen die Rechte `0600` und `0700`. Das Skript gibt den Token nie aus.

```sh
# die App vorher beenden
node packages/electron/scripts/import-brand-host.mjs claudi
node packages/electron/scripts/import-brand-host.mjs nomobogaming
node packages/electron/scripts/import-brand-host.mjs nomobohosting
node packages/electron/scripts/import-brand-host.mjs posylka
node packages/electron/scripts/import-brand-host.mjs sofasx
```

Akzeptiert der Server den übernommenen Token nicht mehr (z. B. NomoboHosting am 2026-10-03: auch in OpenChamber abgelaufen), fragt die App beim Start nach dem Passwort. Einmal anmelden und "Trust this device" anhaken.

Optionen: `--from <settings.json>` (Standard `~/.config/openchamber/settings.json`), `--to <settings.json>` (Standard `~/.config/<displayName>/settings.json`), `--replace-token`.

## Upstream-Release übernehmen

Upstream changes are merged once into `nomobo` and apply to every profile. Use a published stable release tag, not an unchecked `upstream/main`.

### Prepare and merge

1. Read this guide and the current repository instructions. Check `git status --short --branch`; preserve uncommitted work separately before merging. Keep a copy of this guide if it already has local changes.
2. Confirm the stable release at `https://github.com/openchamber/openchamber/releases/latest`. Read its release notes, especially security fixes and bundled OpenCode changes. Record the selected tag and commit.
3. Create a backup branch at the current fork HEAD. Choose a unique name for each update, for example `backup/nomobo-before-v2.1.1-20261005`.

```sh
git branch backup/nomobo-before-vX.Y.Z-YYYYMMDD
git fetch upstream --tags
git rev-parse 'vX.Y.Z^{commit}'
# Continue only on nomobo, with unrelated changes preserved.
git merge --no-commit --no-ff vX.Y.Z
```

Inspect both conflicted and automatically merged fork files. Keep the branding behavior and the new upstream protections together; do not resolve whole files by choosing only one side. Likely overlap:

- `packages/electron/entry.mjs`: Name, `userData`, Datenverzeichnis, lokaler Server
- `packages/electron/early-startup.mjs`: `activeBrandProfile`, App-User-Model-ID
- `packages/electron/main.mjs`: `updatesEnabled`, Protokoll-Registrierung, Erstbelegung, `brandLogoId` in `buildStoredHostEntry`, `localAvailable` in `desktop_hosts_get`
- `packages/electron/scripts/package.mjs`, `scripts/after-pack.cjs`
- `packages/ui/src/lib/desktopHosts.ts`, `components/desktop/DesktopHostSwitcher.tsx`, `components/layout/Header.tsx`

The fork-specific invariants are separate app identities and data directories, no local server for remote-only profiles, no upstream updater or deep-link registration, safe default-host seeding, and host logos. Preserve nomobolocal's shared-data startup lock. The removed continuous preferences sync must stay absent.

### Validate and build

Run from the repository root. Test processes must not inherit the running desktop app's `OPENCHAMBER_DATA_DIR`: the SSH fixture changes HOME but otherwise still reads the live app's Git identity store.

```sh
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
env -u OPENCHAMBER_DATA_DIR bun run --cwd packages/electron test
env -u OPENCHAMBER_DATA_DIR bun run --cwd packages/ui test
env -u OPENCHAMBER_DATA_DIR bun run --cwd packages/web test
# Use the backup branch created for this update as the comparison base.
bun run check:changed -- --base backup/nomobo-before-vX.Y.Z-YYYYMMDD
OPENCHAMBER_BRAND_PROFILE=claudi bun run electron:build
OPENCHAMBER_BRAND_PROFILE=nomobogaming bun run electron:build
OPENCHAMBER_BRAND_PROFILE=nomobohosting bun run electron:build
OPENCHAMBER_BRAND_PROFILE=posylka bun run electron:build
OPENCHAMBER_BRAND_PROFILE=sofasx bun run electron:build
OPENCHAMBER_BRAND_PROFILE=nomobolocal bun run electron:build
```

For a single unchanged source tree, the first full `electron:build` prepares the shared UI, bundled CLI, main bundle and native modules. Remaining profiles can reuse those assets with `OPENCHAMBER_BRAND_PROFILE=<id> node scripts/package.mjs` from `packages/electron`. Run packaging sequentially because it shares staging files. Do not run that script from the repository root: it resolves Electron Builder and the after-pack hook relative to its working directory. If source or dependencies change, repeat the full build first.

Before installation, check each bundle's version, bundle ID, embedded profile, icons and `codesign --verify --deep --strict`. No branded bundle may contain `app-update.yml`. Confirm the bundled OpenCode version matches `packages/electron/package.json`. The pre-commit gate runs type-check, lint, dead-code analysis and the anti-slop comparison. Inspect any failure before committing; dead-code findings now fail the gate.

Finish the merge only after resolving conflicts and recording validation. Update this guide's basis and add an update record with the tag, conflict decisions, test results, installed profiles, backup location and any remaining manual checks. Keep unrelated local documentation edits unstaged. A push is a separate action.

### Install and rollback

Back up each installed bundle before replacement, for example under `~/Library/Application Support/nomobodev-update-backups/<date>/`. Keep backups outside `/Applications` so macOS does not register duplicate apps there. Stage and verify all new bundles before stopping working apps. Replace one complete app at a time. If replacement fails, put its old bundle back before continuing with another profile.

When an agent running inside a desktop app launches another branded app, set its data directory explicitly with `open --env`. The child can otherwise inherit the parent app's `OPENCHAMBER_DATA_DIR`, which takes precedence over its brand profile. For example, `open -a /Applications/posylka.app --env "OPENCHAMBER_DATA_DIR=$HOME/.config/posylka"`. Use the target profile's directory from `brandRuntimePaths`, not the directory of the agent's own app. Verify the new process's selected data directory before calling the launch isolated.

Check each restarted app connects to its intended server, retains its login, shows the right host logo and has no unexpected Local option. Remote-only apps may run beside the original OpenChamber. Test nomobolocal separately with the original closed; never run both on their shared data. Its version should match the installed original before shared-data use. Updating the original or remote servers requires its own approval.

For rollback, quit the affected app, move its new bundle aside, restore the old complete bundle and verify its signature before launch. Leave settings and credentials alone. An old bundle does not reverse data migrations; nomobolocal shares OpenChamber data, so assess release compatibility before downgrading it.

### Update record: 2026-10-17, v2.3.3 to v2.4.0

- Stable release `v2.4.0` was published on 2026-10-17 at `6a10ee19a12a1542cad01eee5add14e030ba4ac4`. GitHub reports neither draft nor prerelease. Bundled OpenCode is pinned to `2.0.32`; desktop packaging now also stages ripgrep.
- Source rollback point: `backup/nomobo-before-v2.4.0-20261017-integration`, commit `ab41ca4021aace6e636e4db4c1690ec6367e4ad9`. The working tree was clean before `git merge --no-commit --no-ff v2.4.0`. The maintainer approved committing the integration on 2026-10-20. No push is authorized.
- The only conflict was `packages/electron/entry.mjs`. The resolution keeps the branded app name and unbranded-only Linux desktop identity together with upstream's version preservation around `app.setName()`.
- The other changed fork files merged automatically: Electron `.gitignore`, `README.md`, `early-startup.mjs`, `main.mjs`, and UI `DesktopHostSwitcher.tsx`. Their integration was inspected. The six profiles, branding assets, default-host metadata, identity/data-directory isolation, remote-only startup, disabled upstream updater and deep-link registration, and shared-data startup lock remain. Continuous preferences sync remains absent.
- Focused checks passed: 48 tests in `brand-profile.test.mjs`, `brand-builder-config.test.mjs`, and `brand-host-import.test.mjs`; `node --check packages/electron/entry.mjs`; and the focused whitespace check for that file. An isolated VM probe passed 42 rename/version combinations for all six profiles and unbranded startup across Linux, macOS and Windows platform flags. This probe did not launch Electron or test native platform behavior.
- Frozen dependency installation passed with Bun `1.4.2`. Full suites passed under Node `24.21.0` with `OPENCHAMBER_DATA_DIR` removed: Electron 54 test files, UI 894 test files, and Web 401 files with 7,385 tests. Web skipped nine files and 137 tests. Logs are in the approved temporary directory under `nomobo-v240-validation/`.
- Independent read-only review found no concrete fork-integration defects. `check:changed -- --base backup/nomobo-before-v2.4.0-20261017-integration` passed type-check, lint, dead-code checks and the anti-slop comparison across 604 changed source files. Lint reported an upstream React Hook dependency warning in `HtmlRenderFrame.tsx`; Knip reported one unmatched mobile configuration pattern, with no dead-code findings.
- All six macOS arm64 profiles built sequentially. The full claudi build prepared shared assets, bundled OpenCode `2.0.32`, ripgrep and Electron `43.7.0` native modules; remaining profiles reused those outputs. Every bundle passed version, bundle ID, embedded profile, byte-matched icons and tray assets, `codesign --verify --deep --strict`, no upstream updater manifest or `Assets.car`, and bundled OpenCode version checks. Build logs and `bundles.json` are under `nomobo-v240-validation/` in the approved temporary directory.
- Installed `2.4.0` for nomobodev, nomobogaming, nomobohosting, posylka and sofasx. The first four were running and were gracefully quit and relaunched with their explicit data directories, then checked for the intended process environment. Sofasx was closed and remains closed. Whole old bundles, Electron profiles and private settings snapshots are preserved under `~/Library/Application Support/nomobodev-update-backups/2026-10-17-v2.4.0-remote-apps-184045/`. Credentials were not reimported.
- The installed nomobolocal remains `2.3.3` because it hosts this session. Its `2.4.0` bundle is built and staged. Automatic shutdown stays disabled after review exposed an ownership race. The helper at `~/Library/Application Support/nomobodev-update-backups/2026-10-17-v2.4.0-184021-handoff/local-handoff/update_nomobolocal.py` passed 50 tests and supports only `--install-after-manual-quit` for installation. Quit all nomobolocal instances and local OpenCode runtimes first, keep original OpenChamber closed, then invoke it from an independent Terminal. It refuses detected apps, runtimes, ambiguous processes and database handles, backs up stopped state and checks content against that stopped baseline. The preparation snapshot is not the installation baseline. Only `run/result.json` with `phase: complete` proves installation, health and content retention. No installation or scheduling has occurred. Real rendered UI, HMR, shared-data migration, Windows, Linux desktop, VS Code and mobile runtime behavior remain untested.

### Update record: 2026-10-15, v2.1.1 to v2.3.3

- Release commit: `7521e712e9dbe12cce3c05debaa6d356fedea19b`, published as stable on 2026-10-14. Bundled OpenCode is `2.0.29`.
- Source rollback point: `backup/nomobo-before-v2.3.3-20261015-agent`. The working tree was clean before the merge. No push is authorized.
- Conflicts: `Header.tsx`, `DesktopHostSwitcher.tsx`, `desktopHosts.ts` and its tests. Upstream moved the instance menu out of the header; the host-logo state and rendering now live in `DesktopInstanceMenu.tsx`. The switcher keeps the remote-only availability flag together with upstream's local-origin check. Both logo metadata and SSH-forwarding metadata survive parsing, and both test groups remain.
- The Electron identity, data-directory isolation, default-host seeding, disabled updater and deep-link registration, and nomobolocal's shared-data startup lock remain. Branding profiles and asset files are unchanged. The removed continuous preferences sync stays absent.
- Frozen dependency installation passed with Bun `1.4.2`. Electron passed 53 test files; UI passed 869. The final host-metadata fixture passed separately with 20 tests. Focused oxlint passed on the four manually integrated TypeScript files.
- On system Node `26.12.0`, Web passed 394 files and failed one proxy test, with nine files skipped. The test expects a CONNECT tunnel for HTTP. An isolated loopback probe showed that Node 26 routes HTTP through an ordinary proxy request; Electron's Node `24.21.0` uses CONNECT. The unchanged proxy test passed under Electron's Node 24. No proxy code was changed and no system program was installed or updated.
- The final full Web run passed under standalone Node `24.21.0`: 395 files and 7,235 tests passed; nine files and 137 tests skipped. The official arm64 runtime was extracted only in the approved temporary directory after SHA-256 verification. An earlier full attempt using Electron as the Node host had six fixture failures in five files and is not acceptance evidence.
- `check:changed -- --base backup/nomobo-before-v2.3.3-20261015-agent` passed workspace type-check, lint, dead-code analysis with no code findings and the anti-slop comparison across 1,973 changed source files. Knip printed one configuration hint for an unmatched mobile pattern. Five upstream files have a trailing blank-line whitespace finding; the manually integrated files and this guide pass the focused whitespace check.
- All six macOS arm64 profiles were built sequentially. The full `claudi` build prepared the shared UI, CLI, main bundles and Electron 43.7.0 native modules; the other profiles reused those outputs through `node scripts/package.mjs` in `packages/electron`. Each bundle passed version `2.3.3`, its bundle ID and embedded profile, byte-matched profile icon and 36 tray assets, `codesign --verify --deep --strict`, no `app-update.yml` or upstream `Assets.car`, no `nomobo-shared` reference in the archive, and bundled OpenCode `2.0.29`. Outputs are under `packages/electron/dist/brand-<profile>/mac-arm64/<displayName>.app`.
- No HMR, rendered UI, real server connection, installed-app startup or shared-data migration was exercised. No Windows, Linux, VS Code or mobile runtime test was run. No internal reviewer tool was available; the fork integration received a local read-only review. Logs and the bundle verification manifest are retained in the approved temporary directory with the `v233-` prefix.
- Installation is separate from this source/build task. No running app was stopped and `/Applications/OpenChamber.app` remains untouched. Check the original app's version before alternating it with the new nomobolocal on shared data. Release `2.2.0` moves relay keys out of `settings.json`; preserve a complete data backup before a real launch or rollback.

### Update record: 2026-10-05, v2.1.0 to v2.1.1

- Release commit: `e302062e3be0686986594fddabdafd8a97c129e5`. The release includes desktop security fixes and bundled OpenCode `2.0.22`.
- Source rollback point: `backup/nomobo-before-v2.1.1-20261005`.
- Merge commit: `a3526b594`. The guide's pre-existing local edits and this update record were kept out of the merge commit and are committed separately. No push was performed.
- Conflicts: imports in `early-startup.mjs` and `main.mjs`. Kept branding imports together with upstream `remote-page-policy.mjs` and `packaged-ui-routing.mjs` imports. Other fork changes merged automatically.
- Electron: 36/36 test files passed. UI: 729/729 test files passed. Workspace type-check passed. Lint passed with five upstream React Hook warnings.
- The first Web run inherited the live app's data directory and hit a timeout. The SSH fixture passed after removing `OPENCHAMBER_DATA_DIR` from its environment. The next full run had one transfer-cap fixture failure; that test passed alone. The final full isolated run passed: 356 test files, 6,333 tests; nine files and 127 tests skipped.
- Dead-code analysis ran. It reported upstream unused files, exports and types; no branding-related finding was reported. No unrelated cleanup was performed. The upstream merge also contains whitespace findings from `git diff --check`; the edited conflict files and this guide passed their focused whitespace check.
- All six macOS arm64 apps were built and checked for version `2.1.1`, correct bundle ID and embedded profile, tray assets, no `app-update.yml`, valid ad-hoc signature and bundled OpenCode `2.0.22`. The main bundle contains no `nomobo-shared` preferences-sync reference.
- Installed and restarted: `nomobodev`, `nomobogaming`, `nomobohosting`, `posylka`, `sofasx`. Each new main process was verified running from `/Applications`. Login, server connection, host-logo rendering and HMR development behavior still need a visual check; process checks do not prove these.
- Backups of all six old apps: `~/Library/Application Support/nomobodev-update-backups/2026-10-05-v2.1.0/`. The five replaced original bundles are also retained there as `<displayName>.replaced.app`. No credentials were reimported and the original OpenChamber bundle was left unchanged.
- nomobolocal is built but not installed: the running `2.1.0` app hosts this update session. Its new bundle is `packages/electron/dist/brand-nomobolocal/mac-arm64/nomobolocal.app`. The `2.1.1` bundle was started with an isolated HOME, data directory and Electron profile: its loopback `/health` returned `status: ok`, it exited cleanly, and its test port closed. This does not test the real shared-data profile or rendered UI. Desktop chooses its own dynamic backend port, so discover the test process's actual listener rather than assuming `OPENCHAMBER_PORT` selects it.
- Scoped read-only review found no critical or important fork integration issue. The full upstream release was not independently audited. No Windows, Linux, VS Code or mobile runtime tests were run.

Before replacing nomobolocal, end this session and quit the app from a separate terminal or through Cmd+Q. Confirm its main process and helpers have exited. The original OpenChamber is also still `2.1.0`; settle its separate update before using nomobolocal `2.1.1` on their shared data. Then stage the new nomobolocal bundle, verify its signature, move the old installed bundle to a uniquely named backup outside `/Applications`, and move the staged app into `/Applications/nomobolocal.app`. Never delete the shared settings to make an update start.

### Follow-up: local sessions appeared missing

The local database still held 84 sessions and 2,703 messages. Of these, 76 unarchived sessions belonged to `/Users/afuchs/Openchamber`; the selected project was `/Users/afuchs/www/nomobodev`, which had six sessions. The running local backend's official session-list API also returned 76 sessions for `/Users/afuchs/Openchamber`. No session restore was performed.

The update launcher had started Posylka and Sofasx with the local agent's `OPENCHAMBER_DATA_DIR=/Users/afuchs/.config/openchamber`. Both were stopped and relaunched with their own explicit directories, verified on the new processes. A private local-settings snapshot was saved under `~/Library/Application Support/nomobodev-update-backups/2026-10-05-session-diagnosis/`; its contents must not be committed or logged. Two nomobolocal processes were also observed on different loopback ports. Neither was stopped during diagnosis because the current session runs on the first one. Database presence and an API list do not establish that the user has selected the matching project and Local instance in the UI.

### Completing nomobolocal from its own agent session

The user approved completing the local update after the data backup. A one-shot helper is prepared under `~/Library/Application Support/nomobodev-update-backups/local-v2.1.1-20261005b/`. Its `opencode.before-shutdown.db` is a consistent SQLite backup with a passing integrity check, containing 84 sessions and 2,759 messages at preparation time. The complete `2.1.1` app is staged and its signature checked before shutdown.

Run the helper through the user's launchd, not as a child of the OpenCode process it must stop. It waits 25 seconds so the current answer can finish, refuses to run alongside original OpenChamber, signals the running nomobolocal main processes, and waits for their helpers and database writers to exit. It then creates `opencode.stopped.db`, copies OpenChamber/OpenCode settings and the Electron profile into the private backup directory, preserves the old complete bundle, and installs the staged app. It launches the updated app with the explicit shared data directory.

The helper's `result.json` is the completion evidence. `phase: complete` requires the installed version and loopback health to report `2.1.1`, OpenCode to be ready, a passing database integrity check, and every backed-up session and message ID to remain present. A scheduled or installed phase is not completion. On failure, inspect the recorded phase and preserved bundles/backups before retrying; do not automatically restore an older database over a live one. The original OpenChamber app remains `2.1.0` and must stay closed during this handoff. A separate original-app update is still needed before alternating versions on their shared data.

For future backups, use SQLite's backup API instead of copying a live `.db` file without its WAL. Verify completed standalone snapshots with `mode=ro&immutable=1`; this avoids macOS read-only WAL bookkeeping failures when the snapshot has no sidecar files. Use immutable mode only for completed static snapshots, never for the changing live database.

## Weiteres Profil anlegen

1. `branding/profiles/<id>.json` nach dem Muster von `claudi.json` anlegen. Eigener `displayName`, eigene `bundleId`. Der Test `every checked-in profile is valid, credential-free and has its own identity` prüft das.
2. Icons erzeugen: in `branding/scripts/build-brand-assets.sh` ergänzen und das Skript laufen lassen. Für eine nomobo-App `nomobo_icon <id> '<Hintergrund>' '<zweite Zeile>' '<Buchstabe>'`. Für ein fremdes Logo wie Posylka oder Sofasx das Quell-Logo unter `branding/assets/` ablegen, mit `render-brand-assets.swift icon` (Wortmarke auf Farbe) oder `icon-logo` (Logo ist schon eine Kachel) rendern und `finish_profile <id> '<Buchstabe>'` aufrufen. Im Profil `"trayIconsDir": "branding/assets/<id>/tray"` setzen. Buchstabe und Farbe dürfen sich mit keiner anderen App überschneiden.
3. Logo für die Server-Auswahl als PNG unter `packages/ui/src/assets/brand-logos/<logoId>.png` erzeugen (im Build-Skript, etwa 61 px hoch bzw. 105 px quadratisch) und im Profil als `defaultHost.brandLogoId` eintragen.
4. Tests laufen lassen, bauen, Zugang mit `import-brand-host.mjs <id>` übernehmen.

## Logo-Herkunft

`branding/assets/nomobo-wordmark.png` ist das Header-Logo von nomobo.de, unverändert heruntergeladen von `https://nomobo.de/media/img_6a4f79ac9cabe8.65603421_1783593388.png` (318×61, SHA-256 `258a56e7d0cc41f34c4c062adcd8c934e43fed1b01abff8f4f68ea3756d54d41`). Die Hintergrundfarbe `#07090E` stammt aus `--header-bg-rgb` im CSS von nomobo.de. `branding/scripts/build-brand-assets.sh` erzeugt daraus `branding/assets/claudi/icon.icns` und `packages/ui/src/assets/brand-logos/nomobo.png`. Die Wortmarke wird nur skaliert und platziert, nicht nachgezeichnet. Das App-Icon trägt unter der Wortmarke die zweite Zeile "DEV", damit es sich von anderen nomobo-Apps unterscheidet. Gesetzt ist sie in Poppins SemiBold, der Schrift von nomobo.de (`branding/assets/fonts/`, SIL Open Font License, Quelle `github.com/google/fonts/ofl/poppins`), in `#F5F2EF` (`--header-text-color` von nomobo.de). NomoboGaming hat "GAMING" auf `#1F1147`, NomoboHosting "HOSTING" auf `#142B49`, dem Navy des Hosting-Ordnericons aus `nomobo-hosting/assets/folder-icon.svg`. Ist eine zweite Zeile breiter als die Wortmarke, wird sie verkleinert. Das Logo in der Server-Auswahl bleibt die reine Wortmarke auf `#07090E`.

Die Menüleisten-Icons (`branding/assets/<id>/tray/`) zeigen je einen Buchstaben in Poppins SemiBold in einer Umriss-Kachel, erzeugt von `render-tray-icons.swift`. Die Füllstufen für Ruhe, Ungelesen und Beschäftigt-Animation stammen aus den Upstream-Icons.

Posylka, Sofasx und nomobolocal tragen wie die anderen nomobo-Apps die nomobo-Wortmarke mit zweiter Zeile. Posylka liegt auf dem Orange-Verlauf des posylka.de-Favicons (`#ED8420` → `#E56226`, gemessen an `favicon-192x192.png`), Sofasx auf dem Rot des OKES-Logos von mebleokes.com (`#FD0136`). Auf diesen Farben verschwände das orange „bo“, daher ersetzt `render-brand-assets.swift icon … <accent>` es dort durch das nomobo-Dunkel `#07090E`. nomobolocal liegt auf `#0E3B36`.

In der Server-Auswahl zeigen Posylka und Sofasx weiter die Logos ihrer Firmen: `branding/assets/posylka-logo.svg` (von `https://posylka.de/images/logo-2021.svg`, SHA-256 `29b81f8f…`) auf Weiß und `branding/assets/okes-logo.webp` (Header-Logo von mebleokes.com, 189×189, SHA-256 `485ad05d…`).

## Lehren aus der Einrichtung

### 2026-10-03 `electron:dev` griff auf die Original-Daten zu
**Problem:** Der HMR-Hilfsserver von `electron:dev` kannte das Profil nicht und nutzte `~/.config/openchamber`. Er hat wartende Nachrichten der laufenden OpenChamber-Session an seinen eigenen OpenCode geschickt.
**Lösung:** `brandDevEnvironment` gibt jedem Dev-Prozess das Profil-Datenverzeichnis; ein Profil ohne lokalen Server läuft im Dev-Modus mit gebündelter UI, ohne Hilfsserver und ohne lokales OpenCode.
**Dateien:** `packages/electron/brand-profile.mjs`, `packages/electron/scripts/electron-dev.mjs`

### 2026-10-04 `osascript … quit` startet nicht laufende Apps
**Problem:** `tell application id "…" to quit` an eine nicht laufende App kann sie starten. So lief nomobolocal plötzlich auf den OpenChamber-Daten (OpenChamber lief gerade nicht, die Startsperre griff daher nicht).
**Lösung:** Laufende Apps über ihre Prozess-ID (`kill <pid>`) beenden, nie per AppleScript an nicht laufende Apps senden. Beim Austausch eines Bundles vorher prüfen, dass kein alter Prozess mehr läuft; sonst aktiviert `open -a` den alten Prozess.

### 2026-10-04 Dauer-Abgleich der Einstellungen hat Werte verschleppt
**Problem:** Ein laufender Abgleich zwischen allen Servern nahm Felder, die nur ein Server gesetzt hatte, in die gemeinsame Datei auf und verteilte sie auf alle anderen, auch auf die Referenz Gaming. Gewünscht war nur eine einmalige Kopie von Gaming.
**Lösung:** Dauer-Abgleich aus dem Code entfernt; das Skript für eine einmalige Kopie wurde auf Wunsch ebenfalls verworfen. Die installierten Apps enthalten den Abgleich noch, bis sie neu gebaut sind; `~/.config/nomobo-shared/preferences.json` ist bis dahin absichtlich ungültig und darf nicht gelöscht werden. Sicherungen: `~/.config/nomobo-shared/backups/`.

Update on 2026-10-05: the five remote apps were replaced with builds without the sync. The running nomobolocal `2.1.0` has not yet been replaced, so keep the deliberately invalid shared preferences file until its update is complete.

## Bekannte Grenzen

- Kein Auto-Update. Updates laufen manuell wie oben beschrieben.
- Ad-hoc-Signatur, keine Notarisierung (siehe "App bauen").
- nomobolocal hat keinen Auto-Updater, die Original-OpenChamber aktualisiert sich aber selbst. Beide teilen sich die Daten; nomobolocal daher auf demselben Upstream-Stand bauen wie die installierte OpenChamber.
- Einige feste Texte nennen noch "OpenChamber": Fenstertitel (z. B. "motolio | Claudi | OpenChamber"), "About OpenChamber" im App-Menü, Tray-Menü. Funktional hat das keine Folgen.
- Die Meldung "Remote instance update" in der Server-Auswahl bezieht sich auf die Server-Version, nicht auf die App.
- Der Anmeldebildschirm zeigt den Upstream-Hinweis "Use Local if remote is unreachable", obwohl die Apps kein Local haben.
