# lapwork

A beautiful, keyboard-driven desktop productivity tracker with a smart stopwatch, distraction monitoring, a floating always-on-top mini window, rich analytics, and a powerful archive system. Built for deep workers who want to understand exactly where their time goes.

---

## 🎥 Demo

https://github.com/user-attachments/assets/000d84bf-777a-4ce0-93ed-20dda07cc915

---

## ✨ Features

### ⏱ Smart Stopwatch
- Start/Stop with **Spacebar** (works even when minimized or in the mini window)
- **Laps** with `L` and **flagged laps** with `F`
- Inline lap notes and flag toggling
- Session name + session notes for context
- **Distraction tracker** — mark interruptions (`D`) without stopping the main timer
- Productive time automatically calculated (total time minus distractions)
- `Ctrl+S` to save, `Ctrl+R` to reset
- Minimum 30-second guard before saving

### 🪟 Mini Window (Always-on-Top)
- Minimizing the main window spawns a tiny floating timer that stays on top of everything
- Fully draggable, resizable, collapsible to a slim strip (`↓` / `↑`)
- Translucent when unfocused, live distraction badge, inline distraction-name input
- Complete keyboard control (see shortcuts below)
- Restore the main window at any time

### 📋 History
- **Today's sessions** displayed chronologically (newest first)
- Expand any session to see notes, laps with split times, and distraction details
- Delete sessions with confirmation
- **Contribution graph** — GitHub-style heatmap of the past 52 weeks with horizontal wheel scrolling
- **Day streak 🔥**, **Max streak 🏆**, **Active days**, and **Total hours tracked** stats

### 📦 Archive
- Drill down: **Year → Month → Day → Sessions**
- Current year shows months expanded (Dec → Jan, newest first)
- Past years as clickable buttons (Jan → Dec chronological)
- Days sorted intuitively (current month: today → 1st, other months: 1st → 31st)
- Only periods with activity appear — no empty clutter
- Full session details, notes, laps, and distractions preserved

### 📈 Stats & Analytics
- **Stats cards** — Total Time, Avg Session, Focus Rate with reactive emoji
- **Bar chart** — Week / Month / Year toggle with rich floating hover tooltips (total, productive, distracted, avg session)
- **Distraction Breakdown** — donut chart with Today / This Week toggle
- Ranked distraction categories with time, count, and percentage
- Productive ratio bar
- Tooltips (`?` icons) explain every metric

### 🖥 System Tray & Native Integration
- Tray icon with live menu: Start/Stop, Add Lap, Show Window, Quit
- Close-confirmation dialog with **Save & Quit / Don't Save / Cancel**
- Single-instance lock (no duplicate app windows)
- Auto-updater via GitHub Releases (packaged builds only)

---

## ⌨️ Keyboard Shortcuts

### Main Window
| Key      | Action                         |
|----------|--------------------------------|
| `Space`  | Start / Stop stopwatch         |
| `L`      | Add lap                        |
| `F`      | Add flagged lap                |
| `D`      | Start / Stop distraction timer |
| `Ctrl+S` | Save session                   |
| `Ctrl+R` | Reset stopwatch                |

### Mini Window
| Key            | Action                                  |
|----------------|-----------------------------------------|
| `Space`        | Start / Stop stopwatch                  |
| `D`            | Start distraction / open name input     |
| `Enter`        | Submit distraction name                 |
| `Esc`          | Close distraction name input            |
| `Ctrl+S`       | Save session                            |
| `Ctrl+R`       | Reset stopwatch                         |
| `F`            | Restore main window                     |
| `↓` / `↑`      | Collapse / Expand (↑ twice = restore)   |

---

## 🛠 Tech Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Desktop   | Electron                                 |
| Frontend  | React 18 + TypeScript + Vite             |
| State     | React hooks + refs (60fps timer loops)   |
| Database  | SQLite via `sql.js` (zero-config, local) |
| Bundling  | Bun (main process) + Vite (renderer)     |
| Packaging | electron-builder (NSIS Windows installer)|
| Updates   | electron-updater (GitHub Releases)       |

---

## 🚀 Installation & Running from Source

### Prerequisites
- **Node.js** v20+ — https://nodejs.org
- **Bun** — https://bun.sh (used by the build scripts)
- **Git**

### 1. Clone the repository
```bash
git clone https://github.com/BinaryRishabh/lapwork_Windows.git
cd lapwork_Windows
```

### 2. Install dependencies & run

#### Option A — Using Bun (Recommended ⚡)
```bash
bun install
bun run dev
```

#### Option B — Using npm
The build scripts use Bun's bundler, so install Bun globally first:
```bash
npm install -g bun
npm install
npm run dev
```

> `npm run dev` starts Vite on `http://localhost:5173`, builds the Electron main process, waits for the dev server, and launches the app automatically.

---

## 🧰 Available Scripts

| Script            | Description                                          |
|-------------------|------------------------------------------------------|
| `bun run dev` / `npm run dev`   | Start in development mode (Vite + Electron) |
| `bun run start` / `npm run start` | Build Electron and launch packaged-style app |
| `bun run dist` / `npm run dist`   | Build production installer into `release/`  |

---

## 📦 Building for Production (Windows Installer)

```bash
# Bun
bun run dist

# npm
npm run dist
```

The generated `lapwork Setup x.x.x.exe` installer will be placed in the `release/` folder.

---

## 📥 Download (Windows)

Don't want to build from source? Grab the latest installer from the
[Releases page](https://github.com/BinaryRishabh/lapwork_Windows/releases).

Run `lapwork Setup x.x.x.exe` and follow the installer prompts.

---

## 💾 Data Storage

- All data is stored **locally on your machine** — nothing ever leaves your PC.
- Database file location:
  - **Installed app:** `%APPDATA%/lapwork/lapwork.db`
  - **Development:** `%APPDATA%/lapwork/lapwork-dev.db`

---

## 🧪 Development Notes

- A **DevPanel** (test-data generator) is available in development mode only (`Ctrl+Shift+D` / on-screen toggle) and is automatically excluded from production builds.
- DevTools and the F12 shortcut are disabled by design.
- The mini window, tray, and main window stay in sync over Electron IPC with NaN-safe, crash-guarded messaging.

---

## 📝 License

This project is licensed under the **ISC License**.

---

Made with ❤️ for deep workers.