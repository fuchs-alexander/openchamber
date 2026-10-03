# nomobodev Implementation Plan

> **For agentic workers:** Use the `executing-plans` skill to implement this plan task-by-task. Do not start implementation before the user reviews the plan. Track progress with the checkboxes below.

**Goal:** Eine eigene macOS-App namens **nomobodev** für den OpenChamber-Server **Claudi**, mit Nomobo-Logo, eigenem Dock-Icon und Logos in der Server-Auswahl.

**Architecture:** Ein gemeinsamer Fork von `https://github.com/openchamber/openchamber` liefert alle zukünftigen Server-Apps. Server-spezifische Build-Profile bestimmen Name, Bundle-ID, Icon und Standardverbindung; getrennte Electron- und Einstellungsprofile ermöglichen parallelen Betrieb neben der unveränderten Original-App.

**Tech Stack:** Bestehende OpenChamber-Technik: Electron, React/TypeScript und die Build-/Testwerkzeuge der ausgewählten Upstream-Version.

**Spec:** Der Abschnitt „Vereinbarter Umfang“ in dieser Datei fasst die Anforderungen aus dem Gespräch zusammen. Dies ist ein Implementierungsentwurf, noch keine Zusage getesteter Machbarkeit.

## Vereinbarter Umfang

- Projektverzeichnis: `/Users/afuchs/www/nomobodev`.
- Ein gemeinsamer GitHub-Fork, keine eigenen Codezweige je Server.
- Erste App: Anzeigename `nomobodev`, Standardserver `Claudi`.
- Claudi-Adresse: `https://openchamber.c.nomobo.de/`.
- Nomobo-Logo für App/Dock und die Claudi-Verbindung im Auswahlmenü.
- Bestehenden Claudi-Zugang lokal übernehmen; keine Tokens oder privaten Einstellungen veröffentlichen.
- Andere Server-Apps können später über weitere Build-Profile ergänzt werden; sie sind nicht Bestandteil des ersten Builds.

## Globale Einschränkungen

- Original-App `/Applications/OpenChamber.app` und deren Konfiguration nicht verändern.
- Zugangstokens weder ins Repository noch in App-Builds, Test-Fixtures oder Logs aufnehmen.
- Logo aus einer verifizierten vorhandenen Nomobo-Quelle verwenden; kein Ersatzlogo erfinden.
- Persönliche Profile außerhalb des Git-Checkouts speichern.
- Eigenständige App-Identität und tatsächliche Dock-Zuordnung testen, nicht nur das Vorhandensein eines Starter-Icons.
- Originalen Auto-Updater für eigene Builds deaktivieren, bevor die App installiert wird.
- Keine Änderung der globalen macOS-Sicherheitseinstellungen.
- GitHub-Eigentümer, Fork-Sichtbarkeit und Veröffentlichung anhand bestehender Kontodaten prüfen; bei mehreren möglichen Zielen vor Erstellung fragen.

## Entscheidungen und Korrekturen nach Upstream-Prüfung (2026-10-03)

Geprüft gegen Upstream-Release `v2.1.0` (Commit `90726f9949da3408b2baf0f997e24bd71455946e`).

- **Fork-Ziel:** persönliches Konto `fuchs-alexander` (vom Nutzer bestätigt; Orgs `colibo`, `ecommerce-utilities` nicht verwendet). Forks öffentlicher Repos sind auf GitHub immer öffentlich.
- **Gemeinsamer Branch:** Alle Profile leben auf einem Branch `nomobo` im Fork; keine Branches je Server.
- **Logo-Quelle:** Wortmarke von `https://nomobo.de/media/img_6a4f79ac9cabe8.65603421_1783593388.png` (318×61 PNG, Header-Logo von nomobo.de), vom Nutzer gewählt. Für das quadratische App-Icon wird die Wortmarke unverändert mittig auf eine dunkle Fläche gesetzt („nomo“ ist weiß); Hochskalierung macht sie leicht unscharf.
- **Kein lokaler Server (Nutzerentscheidung):** Upstream startet immer einen lokalen Server (In-Process-Web-Server + eigenes `opencode serve`) und fällt bei unerreichbarem Remote-Host still auf diesen zurück. Das Claudi-Profil schaltet den lokalen Server fest ab (`localServer: false`, im Bundle, nicht per Umgebungsvariable), blendet „Local“ in der Server-Auswahl aus und zeigt bei unerreichbarem Claudi eine verständliche Meldung. Kein isolierter lokaler Server als Ersatz; fehlende Funktionen werden als Blocker gemeldet.
- **App-Name/Profil fest kodiert:** `entry.mjs` setzt `app.setName('OpenChamber')`; daraus folgen Electron-`userData` (inkl. Single-Instance-Lock) und Log-Verzeichnis. Ohne Änderung kollidiert nomobodev mit der Original-App. Lösung: ins Bundle eingebettete Profildatei, die `entry.mjs` vor allem anderen liest und daraus Name, `userData` und `OPENCHAMBER_DATA_DIR` setzt. Umgebungsvariablen allein reichen nicht, da Dock-/Finder-Starts sie nicht setzen.
- **Einstellungen:** `early-startup.mjs` liest `~/.config/openchamber/settings.json`, außer `OPENCHAMBER_DATA_DIR` ist gesetzt → nomobodev nutzt `~/.config/nomobodev-claudi/`.
- **Protokoll-Handler:** `main.mjs` registriert beim Start `setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL)`; im Profil abgeschaltet, damit die Original-App ihre Links behält.
- **Updater:** `package.json` → `build.publish` zeigt auf `openchamber/openchamber`, `appId` ist `dev.openchamber.desktop`. Beides wird beim Packaging aus dem Profil überschrieben; der Updater wird für `updatesEnabled = false` nicht eingerichtet.

## Review Focus

1. Original-App und nomobodev laufen gleichzeitig, ohne Single-Instance-Konflikt oder Profilüberschreibung.
2. Fehlender oder unerreichbarer Claudi-Server führt zu einer verständlichen Anzeige, nicht unbemerkt zu einem anderen Server.
3. Fehlendes oder ungültiges Logo führt zu einem lesbaren Ersatzsymbol statt einer defekten Auswahlzeile.
4. Neustart und späterer App-Austausch erhalten den lokal gespeicherten Zugang und die Serverauswahl.
5. Updater, Protokollregistrierung und lokale Dienste greifen nicht versehentlich in die Original-Installation ein.

## Aufgaben

### 1. Upstream-Basis und Fork vorbereiten

**Dateien:** Bestehende `PLAN.md` erhalten; Upstream-Dateien in dieses Projekt übernehmen. Root-`package.json`, `packages/electron/package.json` und vorhandene Build-Konfiguration zuerst lesen.

- [x] GitHub-Anmeldung und mögliche Fork-Zielkonten rein lesend prüfen.
- [x] Aktuellen Upstream-Release und zugehörigen Commit auswählen und hier dokumentieren; nicht ungeprüft auf wechselndem `main` bauen.
- [x] Prüfen, ob bereits ein Fork existiert; vorhandenen Fork verwenden, andernfalls einen Fork im bestätigten Konto erstellen.
- [x] Repository übernehmen, ohne die vorhandene `PLAN.md` zu überschreiben; `origin` auf den Fork und `upstream` auf das Original setzen.
- [x] Repository-Anweisungen und verfügbare Build-/Testskripte lesen; tatsächliche Befehle und Packaging-Dateien im Plan ergänzen, bevor Code geändert wird.
- [x] Unveränderte Basis bauen und vorhandene relevante Tests ausführen. Fehler der Basis getrennt von eigenen Änderungen dokumentieren. *(Basistests grün: Electron 29/29, UI 652/652. Die unveränderte App wurde nicht separat gebaut; der erste Profil-Build lief fehlerfrei)*
- [x] Ausgangsbasis und Plan in einem nachvollziehbaren Commit sichern, ohne private Daten.

**Prüfung:** `git remote -v` zeigt die korrekten Ziele; Basis-Build ist reproduzierbar oder vorhandene Blocker sind ausdrücklich dokumentiert.

### 2. Gemeinsames Build-Profil und eigenständige macOS-App

**Bestehende Bezugspunkte:** `packages/electron/entry.mjs`, `packages/electron/early-startup.mjs`, `packages/electron/main.mjs`, `packages/electron/package.json` und die in Aufgabe 1 identifizierte Packaging-Konfiguration.

**Neue Dateien:** `branding/profiles/claudi.json`, `branding/assets/nomobo-source.*`, `packages/electron/brand-profile.mjs`, `packages/electron/brand-profile.test.mjs`.

**Schnittstelle:** `resolveBrandProfile(profileId: string)` liefert ein validiertes Profil mit `profileId`, `displayName`, `bundleId`, `defaultHostUrl`, `iconPath` und `updatesEnabled`. Unbekannte Profile sind ein expliziter Fehler. Keine Zugangsdaten im Profil.

- [x] Nomobo-Logo lokal und anhand vorhandener offizieller Quellen suchen, Herkunft dokumentieren und geeignetes Originalbild auswählen. Wenn die Quelle nicht eindeutig ist, Nutzer um Auswahl bitten.
- [x] Profil `claudi` definieren: `displayName = nomobodev`, eigenständige Bundle-ID, `defaultHostUrl = https://openchamber.c.nomobo.de/`, `updatesEnabled = false`.
- [x] Zunächst fehlschlagende Tests für gültiges Profil, unbekanntes Profil und fehlende Pflichtfelder schreiben und ausführen.
- [x] Minimale Profilauflösung implementieren und die Tests erneut ausführen.
- [x] App-Name, Bundle-ID und Icon beim Packaging aus dem Profil ableiten. Nomobo-Logo in erforderliche macOS-Iconformate konvertieren.
- [x] Electron-Profil und OpenChamber-Datenprofil vor deren erster Verwendung getrennt festlegen. Bestehende Mechanismen `OPENCHAMBER_DESKTOP_USER_DATA_DIR` und `OPENCHAMBER_DATA_DIR` prüfen; keine Annahme, dass ein Launcher allein die App-Identität ändert.
- [x] Claudi auf einem frischen Profil als Standard einrichten, aber bestehende Nutzereinstellungen bei Neustarts nicht zurücksetzen.
- [x] Original-Updater deaktivieren; Protokollregistrierung prüfen und eine Übernahme des Original-Protokollhandlers verhindern.
- [x] Prüfen, ob `OPENCHAMBER_SKIP_LOCAL_SERVER=1` alle benötigten Funktionen erhält. Nur verwenden, wenn Remote-Start und Profilzugriff damit funktionieren; andernfalls einen isolierten lokalen Dienst nutzen und die Entscheidung dokumentieren. *(Entscheidung: kein lokaler Server, fest im Profil. Chats, Projekte und Server-Auswahl laufen damit; Terminal, Dateien und Git auf Claudi wurden nicht einzeln geprüft)*
- [x] Relevante Tests und App-Build ausführen; eigenständige Identität des erzeugten Bundles überprüfen und Änderung committen.

**Prüfung:** App-Bundle zeigt `nomobodev` und das Nomobo-Icon, hat eine andere Bundle-ID als OpenChamber und enthält keine privaten Zugangsdaten.

### 3. Logos in der Server-Auswahl

**Dateien:** `packages/ui/src/components/desktop/DesktopHostSwitcher.tsx`, `packages/ui/src/lib/desktopHosts.ts`, `packages/ui/src/lib/desktopHosts.test.ts`; weitere Host-Schema-/Persistenzstellen beim Lesen des ausgewählten Releases identifizieren.

**Schnittstelle:** Optionales Feld `brandLogoId?: string` in der Verbindungskonfiguration; Logo-ID verweist auf lokal mitgelieferte, erlaubte Bilddateien. Für Claudi: `brandLogoId = nomobo`. Keine beliebigen HTML-Inhalte oder entfernten Bild-URLs rendern.

- [x] Zunächst fehlschlagende Tests schreiben: bestehende Hosts ohne Logo bleiben gültig; Logo-ID überlebt Laden/Speichern; unbekannte ID zeigt Ersatzsymbol.
- [x] Tests ausführen und erwartetes Fehlschlagen bestätigen.
- [x] Logo-Feld durch relevante Normalisierungs- und Speicherstellen führen; Logo vor Servername und bei der aktiven Auswahl anzeigen.
- [x] Bildgröße begrenzen, Seitenverhältnis erhalten und Servername als verständliche Beschriftung behalten.
- [x] Tests erneut ausführen und Darstellung bei heller/dunkler Oberfläche sowie langen Servernamen prüfen. *(dunkel geprüft per Screenshot; hell nicht visuell geprüft, das Logo bringt seinen dunklen Hintergrund selbst mit)*
- [x] Änderung committen.

**Prüfung:** Claudi zeigt das Nomobo-Logo; andere und alte Verbindungen funktionieren unverändert, auch ohne Logo.

### 4. Zugang übernehmen und erste App lokal prüfen

**Dateien:** Nur externes privates nomobodev-Profil; keine Zugangsdaten im Repository. Installationsziel vor Ersetzen einer vorhandenen App prüfen.

- [x] Aktuelle lokale Claudi-Verbindung einlesen, ohne den Token auszugeben. Nur erforderliche Verbindungsfelder in das private Profil übernehmen.
- [x] Existierendes Zielprofil vor Änderungen sichern; Profil- und Token-Dateien mit restriktiven Zugriffsrechten speichern.
- [x] App in einem Testziel starten und Anmeldung, Chats sowie benötigte Remote-Funktionen prüfen. *(Verbindung, Projekte, Sessions lesend geprüft; keine Nachricht gesendet)*
- [x] Original-OpenChamber gleichzeitig starten und zwei unabhängige Dock-Einträge mit korrekten Icons und Fensterzuordnung verifizieren. *(per macOS-API: zwei reguläre Dock-Apps, eigene Fenster und Icons; Dock-Leiste selbst nicht fotografiert, da der Shell die Bildschirmaufnahme fehlt)*
- [x] App beenden und erneut starten: Claudi bleibt ausgewählt, Zugang bleibt erhalten.
- [x] Unerreichbarkeit von Claudi ohne Änderung des echten Servers prüfen, beispielsweise mit einem isolierten Testprofil; keine produktiven Serverkonfigurationen manipulieren.
- [x] Signierung/Gatekeeper-Verhalten prüfen. Falls Developer-ID/Notarisierung nicht verfügbar ist, die lokale Installationsmethode und verbleibende Einschränkung offen dokumentieren.
- [x] Erst nach erfolgreichen Prüfungen die App am vereinbarten lokalen Ziel installieren. Keine Original-App ersetzen.

**Prüfung:** Benutzer kann nomobodev über sein eigenes Dock-Icon öffnen und arbeitet direkt auf Claudi; Original-App funktioniert unverändert.

### 5. Reproduzierbare Builds und Update-Verfahren dokumentieren

**Neue Dateien:** `docs/nomobodev-maintenance.md`; eigene Build-Automation erst nach erfolgreichem lokalem Build.

- [x] Tatsächliche Build-/Testbefehle, gewählten Upstream-Stand, Profilpfade und Logoquelle dokumentieren.
- [x] Update-Ablauf festhalten: Upstream-Release übernehmen, Konflikte lösen, Tests ausführen, alle gewünschten Profile bauen.
- [x] Zunächst manuelle App-Aktualisierung verwenden; private Profile liegen außerhalb der Bundles und bleiben erhalten.
- [x] Keine öffentliche Release-Pipeline oder eigenen Auto-Updater ohne gesonderte Freigabe einrichten. Dafür später pro App das passende Artefakt, Signierung und Update-Ziel definieren.
- [x] Quellcode und erzeugtes Bundle auf versehentlich enthaltene Tokens prüfen, ohne Suchtreffer mit Geheimnissen auszugeben.
- [x] Abschließenden Testbericht mit geprüften Funktionen, offenen Einschränkungen und Speicherort der App erstellen.

## Abnahmekriterien

- [ ] Ein Fork und ein gemeinsamer Codebestand, erweiterbar um weitere Build-Profile. *(Code fertig auf Branch `nomobo`; Push in den Fork wartet auf Freigabe)*
- [x] App heißt `nomobodev`, zeigt das verifizierte Nomobo-Logo und öffnet Claudi.
- [x] Tatsächlich eigenständiges Dock-Icon im Parallelbetrieb.
- [x] Nomobo-Logo in der Server-Auswahl, robuste Ersatzanzeige ohne Logo.
- [ ] Tokens bleiben ausschließlich lokal; Original-App und deren Daten bleiben unverändert. *(Tokens: erfüllt. Original-Daten: nicht vollständig, siehe Status, Vorfall vom 2026-10-03)*
- [x] Kein Updatepfad kann die eigene App versehentlich durch die Standard-App ersetzen.

## Status (2026-10-03)

nomobodev ist gebaut, lokal unter `/Applications/nomobodev.app` installiert und mit Claudi verbunden. Commits liegen lokal auf Branch `nomobo` (Basis `v2.1.0`). Build, Installation und Updates: `docs/nomobodev-maintenance.md`.

**Nachträgliche Entscheidungen**
- App-Icon: Wortmarke plus zweite Zeile „DEV“ (Poppins SemiBold, Schrift von nomobo.de), damit es sich von späteren nomobo-Apps unterscheidet. Die Server-Auswahl zeigt weiter die reine Wortmarke.
- Versionen: App und Original-App sind 2.1.0 (aktuelles Release). Der Claudi-Server läuft auf 2.0.4. Ein Server-Update ist ein separater Schritt und wurde nicht durchgeführt.

**Zweites Profil NomoboGaming (2026-10-03)**
`nomobogaming` (`de.nomobo.nomobogaming`) verbindet sich mit `http://100.100.6.17:3000/` (Tailscale). Profile erlauben dafür `http` nur noch für private Netze und Tailscale. App-Icon „nomobo / GAMING“ auf `#1F1147`. Menüleisten-Icon zunächst das „nb“-Zeichen von nomobo.de (später ersetzt, siehe unten). Installiert unter `/Applications/nomobogaming.app`, Zugang übernommen, Verbindung und Neustart geprüft. Die Menüleiste selbst konnte nicht fotografiert werden; geprüft sind die Icon-Dateien im Bundle.

**Drittes Profil und Menüleisten-Buchstaben (2026-10-03)**
Das gemeinsame „nb“ in der Menüleiste unterschied die Apps nicht; ersetzt durch je einen Buchstaben (D, G, H). `nomobohosting` (`de.nomobo.nomobohosting`, `https://oc.nomobo.de/`, Icon „nomobo / HOSTING“ auf `#142B49`) ist gebaut und installiert. Der übernommene Token wird vom Server abgelehnt (401, ebenso in OpenChamber), daher einmalige Anmeldung mit Passwort nötig.

**Vorfall beim Dev-Modus-Test**
Upstream-`electron:dev` startet einen HMR-Hilfsserver, der zunächst das Profil nicht kannte und die Original-Daten unter `~/.config/openchamber` nutzte. Bei zwei Testläufen (21:58 und 22:01) hat er je eine wartende Nachricht aus der Warteschlange der laufenden Agent-Session an seinen eigenen, kurz danach beendeten OpenCode gesendet. Die Nachricht von 22:01 hat der Nutzer möglicherweise nicht zugestellt bekommen. Behoben in `a41953c`: Bei einem Profil bekommt jeder Dev-Prozess das Profil-Datenverzeichnis, und ein Profil ohne lokalen Server startet gebündelte UI ohne Hilfsserver und ohne lokales OpenCode. Mit leerem Temp-`HOME` geprüft.

**Offen**
- Push von `nomobo` in den Fork `fuchs-alexander/openchamber` (öffentlich): wartet auf Freigabe.
- Automatische Updates und Verteilung auf andere Rechner (später): eigene Pipeline im Fork (Upstream-Release erkennen, mergen, testen, bauen), eigener Feed (GitHub Releases oder R2). Auf macOS braucht das In-App-Update eine feste Signatur, idealerweise eine Apple Developer ID.
- Windows (später): Windows-Teil der Builder-Konfiguration und `.ico` ergänzen; bauen nur auf Windows oder per Windows-Runner; ohne Zertifikat erscheint eine SmartScreen-Warnung.
- Kleinigkeiten: Fenstertitel, „About OpenChamber“ und das Tray-Menü nennen noch OpenChamber. `HostBrandLogo` setzt seinen Fehlerzustand nicht zurück, wenn sich die Logo-ID ändert. Helle Oberfläche nicht visuell geprüft.
