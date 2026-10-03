# nomobodev: Builds, Profile und Updates

Dieser Fork baut aus einem Codestand mehrere gebrandete macOS-Apps. Jede App ist ein Build-Profil in `branding/profiles/<id>.json`. Es gibt keine Branches je Server; alle Profile liegen auf dem Branch `nomobo`.

## Stand

- Upstream-Basis: Release `v2.1.0`, Commit `90726f9949da3408b2baf0f997e24bd71455946e`.
- Fork: `github.com/fuchs-alexander/openchamber`, Branch `nomobo`. Remotes: `origin` ist der Fork, `upstream` ist `openchamber/openchamber`.
- Profile:

| Profil | App | Bundle-ID | Server | Icon |
|---|---|---|---|---|
| `claudi` | `nomobodev` | `de.nomobo.nomobodev.claudi` | `https://openchamber.c.nomobo.de/` | nomobo / DEV auf `#07090E` |
| `nomobogaming` | `nomobogaming` | `de.nomobo.nomobogaming` | `http://100.100.6.17:3000/` (Tailscale) | nomobo / GAMING auf `#1F1147` |

## Was ein Profil steuert

| Feld | Wirkung |
|---|---|
| `displayName` | App-Name, Name des Bundles, Electron-Profil `~/Library/Application Support/<displayName>`, Logs `~/Library/Logs/<displayName>`, Einstellungen `~/.config/<displayName>/` |
| `bundleId` | macOS-Bundle-ID. Muss je Profil eindeutig sein und darf nicht `dev.openchamber.desktop` sein. |
| `iconPath` | `.icns` für App und Dock |
| `trayIconsDir` | optional: eigene Menüleisten-Icons (`trayTemplate-idle`, `-unseen`, `-breath-00` bis `-15`, je 1x und @2x). Die Statussymbole in den Menüzeilen bleiben die von Upstream. |
| `updatesEnabled` | `false`: kein Update-Feed im Bundle, der Updater wird nicht eingerichtet, Update-Prüfung meldet immer "kein Update" |
| `localServer` | `false`: kein lokaler OpenChamber-Server und kein lokales `opencode`. Ist der Server nicht erreichbar, zeigt die App eine Wiederholen-Seite statt auf "Local" zu wechseln. "Local" fehlt in der Server-Auswahl. |
| `registerDeepLinkProtocol` | `false`: die App übernimmt `openchamber://` nicht von der Original-App |
| `defaultHost` | Server, der bei leeren Einstellungen eingetragen und als Standard gesetzt wird. `brandLogoId` wählt ein Logo aus `packages/ui/src/assets/brand-logos/`. Die URL muss `https` sein. `http` ist nur für private Netze und Tailscale erlaubt (10/8, 172.16/12, 192.168/16, 100.64/10, Loopback, `*.ts.net`). |

Profile enthalten nie Zugangsdaten. Der Parser lehnt Felder mit `token`, `secret`, `password` oder `authorization` im Namen ab.

Beim Packaging landet das Profil als `Contents/Resources/brand-profile.json` im Bundle. `entry.mjs` liest es vor allem anderen. Deshalb bekommt die App auch beim Start aus Dock oder Finder ihre eigene Identität. Ohne diese Datei verhält sich der Build wie Upstream.

## Voraussetzungen

- Bun `1.4.2` (siehe `packageManager` in `package.json`). Installiert unter `~/.bun/bin`, deshalb vor den Befehlen `export PATH="$HOME/.bun/bin:$PATH"`.
- Node 22 oder neuer (Homebrew `node`).
- Xcode Command Line Tools für `swift`, `sips`, `iconutil`, `codesign`. Ein volles Xcode ist nicht nötig, weil gebrandete Builds kein `Assets.car` brauchen.

## App bauen

```sh
export PATH="$HOME/.bun/bin:$PATH"
bun install
OPENCHAMBER_BRAND_PROFILE=claudi bun run electron:build
OPENCHAMBER_BRAND_PROFILE=nomobogaming bun run electron:build
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

1. nomobodev beenden (Cmd+Q).
2. Neue App kopieren: `ditto packages/electron/dist/brand-claudi/mac-arm64/nomobodev.app /Applications/nomobodev.app`. Bei einem Update vorher die alte `/Applications/nomobodev.app` löschen oder überschreiben. `/Applications/OpenChamber.app` nie anfassen.
3. Starten. Zugang, Serverauswahl und Fenster bleiben erhalten, weil sie außerhalb des Bundles liegen (`~/.config/nomobodev/`, `~/Library/Application Support/nomobodev/`).

Damit das Icon dauerhaft im Dock bleibt: Rechtsklick auf das laufende Icon, "Optionen", "Im Dock behalten".

## Zugang übernehmen

Das Skript kopiert für ein Profil genau einen Eintrag aus den OpenChamber-Einstellungen: URL, Token und Request-Header des Servers mit der Profil-URL. Sonst nichts. Die Quelldatei wird nur gelesen. Eine vorhandene Zieldatei wird vorher daneben als `settings.json.backup-<Zeit>` gesichert. Ziel und Verzeichnis bekommen die Rechte `0600` und `0700`. Das Skript gibt den Token nie aus.

```sh
# die App vorher beenden
node packages/electron/scripts/import-brand-host.mjs claudi
node packages/electron/scripts/import-brand-host.mjs nomobogaming
```

Optionen: `--from <settings.json>` (Standard `~/.config/openchamber/settings.json`), `--to <settings.json>` (Standard `~/.config/<displayName>/settings.json`).

## Upstream-Release übernehmen

Upstream-Änderungen werden einmal im Fork übernommen und gelten dann für alle Profile.

```sh
git fetch upstream --tags
git checkout nomobo
git merge vX.Y.Z            # Release-Tag, nicht ungeprüft upstream/main
```

Konflikte entstehen am ehesten in diesen Dateien:

- `packages/electron/entry.mjs`: Name, `userData`, Datenverzeichnis, lokaler Server
- `packages/electron/early-startup.mjs`: `activeBrandProfile`, App-User-Model-ID
- `packages/electron/main.mjs`: `updatesEnabled`, Protokoll-Registrierung, Erstbelegung, `brandLogoId` in `buildStoredHostEntry`, `localAvailable` in `desktop_hosts_get`
- `packages/electron/scripts/package.mjs`, `scripts/after-pack.cjs`
- `packages/ui/src/lib/desktopHosts.ts`, `components/desktop/DesktopHostSwitcher.tsx`, `components/layout/Header.tsx`

Nach dem Merge:

```sh
bun install
bun run --cwd packages/electron test
bun run --cwd packages/ui test
bun run type-check
OPENCHAMBER_BRAND_PROFILE=claudi bun run electron:build
OPENCHAMBER_BRAND_PROFILE=nomobogaming bun run electron:build
```

Danach jede App wie oben installieren und kurz prüfen: verbindet sie sich, zeigt die Server-Auswahl das Logo, laufen Original-App und gebrandete App nebeneinander.

## Weiteres Profil anlegen

1. `branding/profiles/<id>.json` nach dem Muster von `claudi.json` anlegen. Eigener `displayName`, eigene `bundleId`. Der Test `every checked-in profile is valid, credential-free and has its own identity` prüft das.
2. Icon erzeugen: in `branding/scripts/build-brand-assets.sh` eine Zeile `build_icon <id> '<Hintergrund>' '<zweite Zeile>' "$tmp/unused-logo.png"` ergänzen und das Skript laufen lassen. Für die Menüleiste `"trayIconsDir": "branding/assets/tray-nomobo"` setzen.
3. Logo für die Server-Auswahl als PNG unter `packages/ui/src/assets/brand-logos/<logoId>.png` ablegen und im Profil als `defaultHost.brandLogoId` eintragen.
4. Tests laufen lassen, bauen, Zugang mit `import-brand-host.mjs <id>` übernehmen.

## Logo-Herkunft

`branding/assets/nomobo-wordmark.png` ist das Header-Logo von nomobo.de, unverändert heruntergeladen von `https://nomobo.de/media/img_6a4f79ac9cabe8.65603421_1783593388.png` (318×61, SHA-256 `258a56e7d0cc41f34c4c062adcd8c934e43fed1b01abff8f4f68ea3756d54d41`). Die Hintergrundfarbe `#07090E` stammt aus `--header-bg-rgb` im CSS von nomobo.de. `branding/scripts/build-brand-assets.sh` erzeugt daraus `branding/assets/claudi/icon.icns` und `packages/ui/src/assets/brand-logos/nomobo.png`. Die Wortmarke wird nur skaliert und platziert, nicht nachgezeichnet. Das App-Icon trägt unter der Wortmarke die zweite Zeile "DEV", damit es sich von anderen nomobo-Apps unterscheidet. Gesetzt ist sie in Poppins SemiBold, der Schrift von nomobo.de (`branding/assets/fonts/`, SIL Open Font License, Quelle `github.com/google/fonts/ofl/poppins`), in `#F5F2EF` (`--header-text-color` von nomobo.de). NomoboGaming hat "GAMING" auf `#1F1147`. Ist eine zweite Zeile breiter als die Wortmarke, wird sie verkleinert. Das Logo in der Server-Auswahl bleibt die reine Wortmarke auf `#07090E`.

Die Menüleisten-Icons (`branding/assets/tray-nomobo/`) nutzen das "nb"-Zeichen von nomobo.de (`branding/assets/nomobo-mark.png`, Favicon, 96×96, von `https://nomobo.de/media/img_6a7c47d5ca02a7.85878698_1786529749.png`, SHA-256 `7f4cb487805eb89cfb5e8d6665dd2bfb43c7fe0c11bec020fb169cc417a107c3`). `render-tray-icons.swift` übernimmt die Buchstaben als Maske in eine Umriss-Kachel. Die Füllstufen für Ruhe, Ungelesen und Beschäftigt-Animation stammen aus den Upstream-Icons. Alle nomobo-Apps haben dasselbe Menüleisten-Icon; welche App gemeint ist, zeigt der Tooltip. Auf App-Icon-Größe hochskaliert wirkt sie leicht weich. Eine Vektor- oder hochaufgelöste Fassung würde das beheben.

## Bekannte Grenzen

- Kein Auto-Update. Updates laufen manuell wie oben beschrieben.
- Ad-hoc-Signatur, keine Notarisierung (siehe "App bauen").
- Einige feste Texte nennen noch "OpenChamber": Fenstertitel (z. B. "motolio | Claudi | OpenChamber"), "About OpenChamber" im App-Menü, Tray-Menü. Funktional hat das keine Folgen.
- Die Meldung "Remote instance update" in der Server-Auswahl bezieht sich auf die Server-Version auf Claudi, nicht auf die App.
