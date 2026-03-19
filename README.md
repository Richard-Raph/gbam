# Gbam

> *"When your code finally works, you need to hear it."*

**Gbam** plays a satisfying Nigerian "Gbam!" sound effect every time your tests pass, builds succeed, or debug sessions finish. Because success should feel good.

---

## Features

- 🔊 **Instant sound** on every success — tasks, builds, debug sessions
- 💥 **Full status bar flash** — the entire bar lights up green on success
- ⏱️ **Cooldown protection** — 3-second debounce prevents sound spam
- 💻 **Cross-platform** — works on macOS, Linux, and Windows with no installs
- 🔘 **Status bar button** — click `💥 Gbam` to test sound and flash anytime

---

## How It Triggers

Gbam fires automatically when:

- A **task completes successfully** (exit code 0) with a name matching: `build`, `test`, `dev`, `start`, `run`, `compile`, or `deploy`
- A **debug session ends** (launch-type sessions only)

You can also trigger it manually by clicking `💥 Gbam` in the status bar or running **"Test Gbam Sound"** from the Command Palette (`Ctrl+Shift+P`).

---

## Requirements

- VS Code 1.90.0 or higher
- No npm packages or external installs required

Audio is handled by built-in OS tools:

| Platform | Tool used | Ships with OS? |
|---|---|---|
| macOS | `afplay` | ✅ Always |
| Linux | `paplay` → `aplay` → `ffplay` (first found) | ✅ Most distros |
| Windows | `wscript.exe` + WMPlayer (VBScript) | ✅ Since Windows 98 |

---

## Commands

All commands are available via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description |
|---|---|
| `Gbam: Test Gbam Sound` | Trigger sound and flash manually |
| `Gbam: Enable Gbam` | Re-enable after disabling |
| `Gbam: Disable Gbam` | Silence Gbam without uninstalling |

---

## Known Limitations

- **Task success detection is based on exit codes** — Gbam treats any task that exits with code `0` as a success. It cannot distinguish between a true successful run and cases where a process exits cleanly but was manually stopped or did not complete its intended work.
- **Debug session detection is heuristic-based** — VS Code does not provide an exit code for debug sessions. Gbam triggers when a `launch`-type session ends, but cannot determine whether it ended successfully or was stopped manually.
- **Linux audio** requires at least one of `paplay`, `aplay`, or `ffplay` to be installed. Most desktop Linux distros include one by default

---

## Release Notes

### 0.0.1

Initial release:
- Task success detection (`build`, `test`, `dev`, `start`, `run`, `compile`, `deploy`)
- Debug session termination detection
- Full status bar green flash on success
- Manual test via status bar click or Command Palette
- Cooldown-aware click handler (shows remaining time if clicked during cooldown)
- Cross-platform audio with automatic fallback chain

---

## Development

```bash
git clone https://github.com/Richard-Raph/gbam.git
cd gbam
npm install
npm run compile
# Press F5 in VS Code to launch the Extension Development Host
```

To test manually inside the dev host, click `💥 Gbam` in the status bar or run **"Test Gbam Sound"** from the Command Palette.

Before packaging for production:
1. Change `ENV_MODE` from `"dev"` to `"prod"` in `extension.ts`
2. Run `vsce package`

---

## Contributing

Issues and pull requests are welcome.

- [Open an issue](https://github.com/Richard-Raph/gbam/issues)
- [Submit a pull request](https://github.com/Richard-Raph/gbam/pulls)