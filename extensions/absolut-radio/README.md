# Absolut Radio

An unofficial macOS Raycast extension for [Absolut Radio](https://absolutradio.de/sender-entdecken). Browse all 6 broadcast stations and 8 online streams, listen to live radio, and see the current track. No account, API key, third-party player, or extra binary download is required.

## Commands

- **Browse Stations** — Searchable three-column station grid with local logos and a broadcast/online-stream filter. Press Return to play a station. Playback continues when you close Raycast.
- **Play** — Reconnect to your last successfully played station. Defaults to Absolut Hot on first use. Running it again while that station is playing does not create another player.
- **Pause** — Stop this extension’s audio player without forgetting your last station. It does not affect other music apps. Live radio cannot be paused as a recording: Play reconnects to the live broadcast, not where you stopped.
- **Current Track** — Show the last station’s current live track in a HUD, without changing your clipboard. Defaults to Hot if you have never played a station. This also works while playback is paused; it reports what is on air now. Run the command again to refresh.

Browse Stations shortcuts:

- **⌘⇧P:** Pause playback.
- **⌘T:** Show the current track of the **last played** station, not the highlighted station.
- The action panel also offers the station website and stream URL.

Metadata can take up to 25 seconds to arrive. Ads and announcements may not provide a song title; retry afterward. Advertising metadata is not presented as a song; audio advertising is not bypassed. The broadcaster supplies a single free-form title, normally `Artist - Title`; its first ` - ` separator is displayed as ` ‧ ` in the HUD. Other titles are shown unchanged.

## Development Setup

Requires **macOS**, **Raycast**, and **Node.js 22 or later** for development. Windows and Linux playback are not supported.

1. Clone or copy this directory to your Mac.
2. Run `npm ci` in this directory.
3. Run `npm run dev`. Raycast’s development tooling imports the extension and watches for changes.
4. Open **Browse Stations**, **Play**, **Pause**, or **Current Track** in Raycast.

Stop playback with **Pause** before uninstalling the extension or replacing its helper files. Stopping the development watcher alone does not stop the detached audio player.

## How Playback Works

`src/lib/player.ts` launches the readable `assets/player.js` helper using macOS’s built-in `/usr/bin/osascript`. The helper uses JavaScript for Automation to access **AVFoundation’s AVPlayer**, not AppleScript application automation. It does not launch or control QuickTime, Music, a browser, or VLC. No Xcode/Command Line Tools or Automation permission is required.

The helper runs independently of Raycast so playback survives closing a command. Play waits for AVPlayer to report actual playback, with a startup timeout. If playback fails later, Browse Stations reports the failure while open or the next time it is opened; the detached helper cannot show a Raycast toast on its own. The extension serializes playback changes and verifies the helper’s command line before terminating its PID, avoiding arbitrary process termination from stale PID files. Pause terminates the helper and releases its audio connection. If the player state is invalid or unreadable, commands report an error rather than assuming playback stopped.

The last station ID is stored using Raycast LocalStorage. Private process/status files are stored in Raycast’s extension support directory. Current Track uses a short-lived HTTPS connection with `Icy-MetaData: 1`, reads the interleaved ICY metadata, and closes the connection after reading, cancellation, or timeout. It does not record or save audio.

## Station Catalog and Artwork

The bundled catalog in `src/lib/stations.ts` was checked against the official station discovery page and web-player URLs. It works without a catalog fetch; changes to the broadcaster’s lineup or URLs require updating the catalog. The broadcaster currently uses some legacy IDs (for example `oldies` for Absolut Classics).

The station logo tiles in `assets/stations/` were derived from the broadcaster’s white logo images exposed by `https://absolutradio.de/api/metadata`, on each station’s own brand color. The extension icon is adapted from [the broadcaster’s website favicon](https://absolutradio.de/favicon/favicon.svg). Logos and names remain the property of their respective owners and are not relicensed by this extension’s MIT license. This project is not affiliated with or endorsed by Absolut Radio or Antenne Deutschland.

Playback and metadata requests contact Absolut Radio’s streaming infrastructure, which may redirect to its streaming edge servers and receive your IP address and ordinary request data. The extension adds no external analytics, credentials, or tracking SDKs. See the broadcaster’s [privacy policy](https://absolutradio.de/datenschutz) and [legal notice](https://absolutradio.de/impressum).

## Development and Validation

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

`npm run build` runs a **distribution** build (`ray build -e dist`). Source tests cover station coverage, artwork presence, ICY chunk boundaries, extra fields, advertising metadata, encoding, HTTP failures, cancellation, and stream cleanup. On macOS, they also exercise the playback helper with a local audio file.

The ESLint toolchain has a targeted `minimatch` override for GHSA-g3hv-75wg-m249; `npm audit` reports no known vulnerabilities with the checked-in lockfile.

### macOS Smoke Tests

1. Run Browse Stations in light and dark themes. Check all 14 tiles, text search, filters, and empty states.
2. Play a station; confirm audio starts and the playing indicator updates. Close Raycast; confirm audio continues.
3. Switch stations while playing; confirm the old station stops and only one stream remains audible.
4. Run Pause twice; confirm both calls are safe and unrelated audio apps are unaffected.
5. Run Play; confirm the last station resumes at the live edge. Restart Raycast and repeat.
6. Run Current Track; confirm the HUD displays the current track without changing the clipboard. Run it again and test while paused.
7. Disconnect the network; verify playback startup and track requests time out cleanly.
8. Run `npm run build`, then reopen all four commands in Raycast to test the distribution build.
