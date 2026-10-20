# Fusion Stream Deck

Control Fusion 360 from an Elgato Stream Deck: run any Fusion command from a
key (showing that command's *real* Fusion toolbar icon), or send a raw
keyboard shortcut to the frontmost application.

There are two pieces, and you need to install both:

| Piece | Folder | Installs into |
| --- | --- | --- |
| Fusion add-in | `FusionStreamDeck` | Fusion 360 |
| Stream Deck plugin | `com.ryanfriedman.fusionstreamdeck.sdPlugin` | Elgato Stream Deck app |

## Requirements

- Windows 10 or later, or macOS 13 (Ventura) or later
- Autodesk Fusion 360, signed in
- An Elgato Stream Deck device and the Elgato **Stream Deck app 6.4 or later**
  (Stream Deck app → **Preferences** → **General** shows the version; update
  from [elgato.com/downloads](https://www.elgato.com/downloads) if needed)

Nothing else needs installing - no Python, Node.js, or npm. Fusion runs the
add-in with its own built-in Python, and the Stream Deck app runs the plugin
with its own built-in Node.js.

## Step 1: Install the Fusion add-in

1. Close Fusion 360 if it's open.
2. Copy the whole `FusionStreamDeck` folder (keep that exact folder name)
   into Fusion's add-ins folder:
   - **Windows:** `%APPDATA%\Autodesk\Autodesk Fusion 360\API\AddIns\`
     (paste that path into File Explorer's address bar)
   - **macOS:** `~/Library/Application Support/Autodesk/Autodesk Fusion 360/API/AddIns/`
     (in Finder, **Go → Go to Folder…** and paste the path)

   The result should be `...\API\AddIns\FusionStreamDeck\FusionStreamDeck.py`,
   not a doubly nested folder.
3. Start Fusion 360 and open **Utilities → Add-Ins → Scripts and Add-Ins**
   (or press `Shift+S`).
4. On the **Add-Ins** tab, select **FusionStreamDeck**. If it isn't listed,
   click the green **+** next to "My Add-Ins" and browse to the folder you
   just copied.
5. Click **Run**.
6. Tick **Run on Startup** so it loads automatically every time Fusion
   starts. Otherwise you'll need to repeat step 5 after each Fusion restart.

Nothing visible appears in Fusion when the add-in is running - that's
expected. If it fails to start, Fusion shows a message box with an error;
see [Troubleshooting](#troubleshooting).

## Step 2: Install the Stream Deck plugin

This preview plugin is installed as a plain folder, which requires Stream
Deck's developer mode.

1. Turn on developer mode (one time only): with the Stream Deck app running,
   open `streamdeck://developer/enable` in a web browser and allow it to
   open the Stream Deck app.
2. Fully quit the Stream Deck app: right-click its icon in the Windows system
   tray (or the macOS menu bar) and choose **Quit Stream Deck**. Closing
   the window isn't enough.
3. Copy the whole `com.ryanfriedman.fusionstreamdeck.sdPlugin` folder (keep
   that exact folder name, including `.sdPlugin`) into Stream Deck's plugins
   folder:
   - **Windows:** `%APPDATA%\Elgato\StreamDeck\Plugins\`
   - **macOS:** `~/Library/Application Support/com.elgato.StreamDeck/Plugins/`
4. Start the Stream Deck app again.
5. In the action list on the right, look for a **Fusion 360** category
   containing **Run Command** and **Send Keystroke**.

### macOS only: allow keystrokes

**Send Keystroke** uses macOS System Events, which needs permission. The
first time you use it, macOS may ask to let Stream Deck control "System
Events" - click **OK**. Also go to **System Settings → Privacy & Security →
Accessibility** and switch **Stream Deck** on. Without these, keystroke keys
silently do nothing. (**Run Command** doesn't need this.)

## Step 3: Check that it works

1. With Fusion open and a design loaded, drag **Run Command** from the
   **Fusion 360** category onto an empty key.
2. In the settings panel below, type `extrude` in the search box and pick
   **Extrude**.
3. The key should change to Fusion's real Extrude icon within a second or
   two. Press it - Fusion's Extrude dialog should open.

If the key shows a dim gray icon or a gray "no signal" circle instead, the
plugin can't reach Fusion - see [Troubleshooting](#troubleshooting).

## Using it

**Run Command**: drag it onto a key, then use the search box to find a Fusion
command by name or id (e.g. "extrude", "save", "undo"). Only commands loaded
for Fusion's current workspace show up - switch to Sheet Metal, Manufacture,
etc. first if the command you want lives there. Once selected, the key shows
the command's actual Fusion toolbar icon.

While Fusion is closed or the add-in isn't running, Run Command keys go dim
and gray (or show a gray "no signal" circle if they've never connected). They
come back automatically within about 5 seconds of Fusion and the add-in
starting - no need to restart anything. Pressing a key while it's gray
briefly shows a warning on the key and does nothing.

**Send Keystroke**: type a combo like `ctrl+shift+d` into the settings panel.
It sends the keystroke to whatever window is in front, and works even
without Fusion or the add-in. Supported modifiers: `ctrl`, `alt`, `shift`,
`win`/`cmd` (the Windows key can't be sent on Windows). Supported named
keys: `enter`, `tab`, `esc`, `space`, `backspace`, `delete`, arrow keys,
`home`, `end`, `pageup`, `pagedown`, `insert`, `f1`-`f12`, or any single
character.

## Troubleshooting

**Keys are gray / pressing a Run Command key shows a warning**
- Make sure Fusion is open and the add-in is running: `Shift+S` → **Add-Ins**
  tab → **FusionStreamDeck** should show as running. If not, select it and
  click **Run**.
- Check the add-in has published its address. This file should exist and
  contain a `port` number:
  - Windows: `%LOCALAPPDATA%\FusionStreamDeck\endpoint.json`
  - macOS: `~/Library/Application Support/FusionStreamDeck/endpoint.json`
- With that port number, open `http://127.0.0.1:<port>/health` in a browser.
  A JSON response means the add-in is working; the problem is on the Stream
  Deck side - quit and restart the Stream Deck app.

**Fusion shows an error when running the add-in**
- Check the folder is named exactly `FusionStreamDeck` and contains
  `FusionStreamDeck.py` and `FusionStreamDeck.manifest` directly inside it.
- Stop the add-in, restart Fusion, and run it again. If the error persists,
  send a screenshot of the error message with your feedback.

**The "Fusion 360" category is missing in Stream Deck**
- Check the folder name ends in `.sdPlugin` and sits directly in the
  `Plugins` folder, with `manifest.json` directly inside it.
- Make sure you fully quit Stream Deck (from the tray/menu bar) before
  restarting it.
- Check your Stream Deck app is version 6.4 or later.
- Make sure developer mode is on (Step 2, item 1), then quit and restart
  Stream Deck.

**The command I want isn't in the search list**
- Switch Fusion to the workspace where that command lives, then search
  again.

**Send Keystroke does nothing**
- Make sure the window you want to receive the keystroke is in front.
- On macOS, check the Accessibility and Automation permissions above.

All network traffic stays on your computer (`127.0.0.1`), so no firewall
changes are needed.

## Updating to a new version

1. In Fusion: `Shift+S` → **Add-Ins** → select **FusionStreamDeck** →
   **Stop**. Replace the `FusionStreamDeck` folder with the new one, then
   click **Run**.
2. Quit the Stream Deck app (from the tray/menu bar), replace the
   `.sdPlugin` folder with the new one, and start Stream Deck again. Your
   keys and their settings are kept.

## Uninstalling

1. In Fusion: `Shift+S` → **Add-Ins** → select **FusionStreamDeck** →
   **Stop**, untick **Run on Startup**, then delete the `FusionStreamDeck`
   folder from Fusion's `AddIns` folder.
2. In Stream Deck, remove any Fusion 360 keys. Quit the Stream Deck app and
   delete the `com.ryanfriedman.fusionstreamdeck.sdPlugin` folder from its
   `Plugins` folder.
3. Optionally delete the `FusionStreamDeck` folder under
   `%LOCALAPPDATA%` (Windows) or `~/Library/Application Support` (macOS).

## Known limitations

- Fusion only exposes commands that are loaded for its current workspace, so
  the searchable list changes as you switch workspaces.
- The plugin's own icons (category and action list) are plain placeholders,
  not the Fusion 360 logo. Per-command key icons come from your installed
  Fusion.
- macOS support, especially Send Keystroke, hasn't been tested yet
  (developed on Windows). Feedback from Mac users is especially welcome.

## For developers

### How it fits together

Two independent pieces, talking over localhost HTTP:

```
Stream Deck app  <--WebSocket-->  streamdeck_plugin (Node)  <--HTTP-->  fusion_addin (Python, runs inside Fusion)
```

- **`fusion_addin/FusionStreamDeck`** - a Fusion 360 add-in. On load it starts
  a localhost-only HTTP server (preferred port 59237, falling back to a
  random free port if that's taken) and writes the port it picked to the
  `endpoint.json` discovery file listed under Troubleshooting.

  The server exposes: `GET /health`, `GET /commands` (every command currently
  loaded in Fusion's UI), `GET /icon?commandId=...` (reads the command's real
  icon straight off disk via `CommandDefinition.resourceFolder`), and
  `POST /command` (runs a command by id). All Fusion API calls are marshalled
  onto Fusion's main thread via a custom event (`lib/dispatch.py`) - the API
  isn't thread-safe and the HTTP server runs on a background thread.

- **`streamdeck_plugin/com.ryanfriedman.fusionstreamdeck.sdPlugin`** - a
  Stream Deck plugin with two actions, **Run Command** and **Send Keystroke**.
  It's plain JavaScript with zero npm dependencies: Stream Deck's built-in
  Node.js runtime (declared in `manifest.json` as `Nodejs.Version: "24"`)
  has `WebSocket` and `fetch` as globals - enough to speak Stream Deck's
  plugin protocol and call the Fusion add-in directly.

Because it's plain HTTP/WebSocket, either side can start before the other.
Run Command keys whose icon fetch fails show a dimmed copy of the last good
icon (or an offline glyph) and are retried every 5 seconds until Fusion is
reachable again.

### Development workflow

- **Fusion add-in:** add `fusion_addin/FusionStreamDeck` from the repo directly
  via the green **+** in Scripts and Add-Ins (no need to copy it). Stop and
  re-run the add-in to pick up changes.
- **Stream Deck plugin:** copy the `.sdPlugin` folder into the Plugins folder
  and re-copy the whole folder after every edit, then fully restart the
  Stream Deck app (developer mode's **Restart plugin** doesn't reliably
  restart the plugin's Node process).
- **Placeholder icons:** regenerate with
  `node streamdeck_plugin/tools/make-icons.mjs`.
- **Packaging:** zip the `FusionStreamDeck` and `.sdPlugin` folders (each
  includes a copy of `LICENSE`) along with this README.

## License

Copyright (c) 2026 Autodesk, Inc.

Released under the MIT License. See [LICENSE](LICENSE). A copy of the license
ships inside both the add-in and the plugin folders.
