# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

FocusLog is a Tauri v2 desktop app (Vue 3 + Rust). Single product, not a monorepo. See `README.md` for feature descriptions.

### Development Commands

Standard commands are in `package.json` and `README.md`:
- `npm run dev` — Vite dev server only (port 1420)
- `npm run build` — Vite production build
- `npm run tauri dev` — Full Tauri dev mode (starts both Vite and Rust backend)
- `npm run tauri build` — Full production build

### Lint / Check

No ESLint or test frameworks are configured. Available checks:
- `npm run build` — frontend build verification
- `cargo check` — Rust compile check (run from `src-tauri/`)
- `cargo clippy` — Rust linter (run from `src-tauri/`)

### Running on headless Linux (Cloud VM)

- A virtual display is required: `Xvfb :99 -screen 0 1280x800x24 -ac +extension GLX +render -noreset &`
- Set `DISPLAY=:99` before launching the Tauri app.
- DRI3/EGL warnings are expected and harmless in the Xvfb environment.
- The Tauri WebView (WebKitGTK) does **not** receive synthetic keyboard events from `xdotool type` or `xte`. To test task creation programmatically, insert rows directly into the SQLite database at `~/.config/com.focuslog.desktop/focus_log.db` and restart the app.
- Screenshot capture: `DISPLAY=:99 ffmpeg -y -f x11grab -video_size 1280x800 -i :99.0 -frames:v 1 output.png`

### System Dependencies (Linux)

Tauri v2 requires these packages (already installed in the VM snapshot):
`libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev build-essential xvfb`

### Data Storage

All data is local SQLite at `~/.config/com.focuslog.desktop/focus_log.db`. Tables: `todos`, `tags`, `todo_tags`, `archives`, `settings`.
