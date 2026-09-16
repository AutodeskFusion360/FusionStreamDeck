# Fusion Stream Deck

Control Fusion 360 from an Elgato Stream Deck: run any Fusion command from a
key (showing that command's *real* Fusion toolbar icon), or send a raw
keyboard shortcut to the frontmost application.

## How it fits together

Two independent pieces, talking over localhost HTTP:

```
Stream Deck app  <--WebSocket-->  streamdeck_plugin (Node)  <--HTTP-->  fusion_addin (Python, runs inside Fusion)
```

- **`fusion_addin/FusionStreamDeck`** - a Fusion 360 add-in. On load it starts
  a localhost-only HTTP server and writes the port it picked to a small
  discovery file, since the port isn't fixed (it falls back to a random free
  port if its preferred one is taken):
  - Windows: `%LOCALAPPDATA%\FusionStreamDeck\endpoint.json`
  - macOS: `~/Library/Application Support/FusionStreamDeck/endpoint.json`

  The server exposes: `GET /health`, `GET /commands` (every command currently
  loaded in Fusion's UI), `GET /icon?commandId=...` (reads the command's real
  icon straight off disk via `CommandDefinition.resourceFolder`), and
  `POST /command` (runs a command by id). All Fusion API calls are marshalled
  onto Fusion's main thread via a custom event (`lib/dispatch.py`) - the API
  isn't thread-safe and the HTTP server runs on a background thread.

- **`streamdeck_plugin/com.ryanfriedman.fusionstreamdeck.sdPlugin`** - a
  Stream Deck plugin with two actions, **Run Command** and **Send Keystroke**.
  It's plain JavaScript with zero npm dependencies: Stream Deck's built-in
  Node.js runtime (declared in `manifest.json` as `Nodejs.Version: "22"`)
  ships Node 22+, which has `WebSocket` and `fetch` as globals - enough to
  speak Stream Deck's plugin protocol and call the Fusion add-in directly.

Because it's plain HTTP/WebSocket, either side can start before the other -
the plugin just shows an alert (red flash) on a key press if it can't reach
Fusion, and Fusion's own UI is unaffected if Stream Deck isn't running.

## Setting up the Fusion add-in

1. In Fusion 360: **Utilities → Add-Ins → Scripts and Add-Ins** (or `Shift+S`).
2. On the **Add-Ins** tab, click the green **+** and browse to
   `fusion_addin/FusionStreamDeck` in this repo (no need to copy it anywhere).
3. Select it and click **Run**. Check "Run on Startup" if you want it to load
   automatically with Fusion.

If it fails to start, Fusion will show a message box with the traceback.

## Setting up the Stream Deck plugin

This repo ships the plugin unpacked (no `.streamDeckPlugin` installer), which
is the normal way to iterate on one:

1. Enable developer mode once: open a browser and go to
   `streamdeck://developer/enable`, or use the toggle in the Stream Deck
   app's settings if your version exposes it there.
2. Copy (or symlink, for live-editing) the
   `com.ryanfriedman.fusionstreamdeck.sdPlugin` folder into Stream Deck's
   plugins directory:
   - Windows: `%APPDATA%\Elgato\StreamDeck\Plugins\`
   - macOS: `~/Library/Application Support/com.elgato.StreamDeck/Plugins/`
3. Restart the Stream Deck app. "Fusion 360" should appear as a category in
   the action list with **Run Command** and **Send Keystroke**.

To pick up code changes during development, restart the Stream Deck app (or
use its "Restart plugin" option in developer mode) after editing files.

## Using it

**Run Command**: drag it onto a key, then use the property inspector's search
box to find a Fusion command by name or id (e.g. "extrude", "save", "undo").
Only commands currently loaded for Fusion's active workspace show up - switch
to Sheet Metal, Manufacture, etc. first if the command you want lives there.
Once selected, the key's icon updates to the command's actual Fusion toolbar
glyph.

**Send Keystroke**: type a combo like `ctrl+shift+d` into the property
inspector. Doesn't need the Fusion add-in at all - it sends the keystroke to
whatever's frontmost via `SendKeys` (Windows) or `System Events` (macOS, built
but not tested here - this was developed on Windows). Supported modifiers:
`ctrl`, `alt`, `shift`, `win`/`cmd` (Windows key isn't supported on Windows -
`SendKeys` has no equivalent for it). Supported named keys: `enter`, `tab`,
`esc`, `space`, `backspace`, `delete`, arrow keys, `home`, `end`, `pageup`,
`pagedown`, `insert`, `f1`-`f12`, or any single character.

## Known limitations

- `ui.commandDefinitions` only contains commands Fusion has currently loaded,
  so the searchable list changes with the active workspace/product.
- The plugin's icons (`imgs/`) are plain generated placeholders (see
  `streamdeck_plugin/tools/make-icons.mjs`), not Autodesk's Fusion 360 logo -
  the real per-command glyphs come from your own installed Fusion at runtime.
- macOS keystroke support is implemented but unverified (dev machine is
  Windows).
