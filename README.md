# gbam

&gt; *"When your code finally works, you need to hear it."*

**Gbam** plays a satisfying Nigerian "Gbam!" sound effect every time your tests pass, builds succeed, or debug sessions finish successfully. Because success should feel good.

## Features

- 🔊 **Satisfying sound** on every success — tests, builds, debug sessions
- 🎯 **Smart detection** — automatically detects task completion, debug termination, and terminal success
- ⏱️ **Cooldown protection** — 3-second debounce prevents sound spam
- 🎚️ **Volume control** — adjustable from 0.0 to 1.0 in settings
- 💻 **Cross-platform** — works on macOS, Linux, and Windows
- 🔘 **Status bar integration** — click "💥 Gbam" to test the sound anytime

![Gbam Status Bar](media/status-bar.png)

&gt; Tip: The status bar item shows "💥 Gbam" and can be clicked to test the sound manually.

## Requirements

- VS Code 1.110.0 or higher
- System audio working (macOS: `afplay`, Linux: `paplay`/`aplay`, Windows: PowerShell with .NET)

No external dependencies or Node.js modules required — Gbam uses only VS Code APIs and system commands.

## Extension Settings

This extension contributes the following settings:

* `gbam.enabled`: Enable/disable sound effects (default: `true`)
* `gbam.volume`: Sound volume from 0.0 to 1.0 (default: `0.7`)
* `gbam.triggerOn`: Array of events that trigger Gbam — `["test", "debug"]` by default

## Known Issues

- Debug session success detection uses heuristics (no direct exit code available from VS Code API)
- Terminal success detection only works for named terminals (e.g., "npm test", "build")
- Linux requires `paplay` (PulseAudio) or `aplay` (ALSA) installed

## Release Notes

### 0.0.1

Initial release of Gbam:
- Task success detection (npm, yarn, pnpm, build, test, compile, run)
- Debug session termination detection
- Terminal close with exit code 0 detection
- Manual test command via status bar or command palette
- Volume and enable/disable configuration

---

## Contributing

Issues and pull requests are welcome! 

* [Open an issue](https://github.com/Richard-Raph/gbam/issues)
* [Submit a pull request](https://github.com/Richard-Raph/gbam/pulls)

### Development Setup

```bash
git clone https://github.com/Richard-Raph/gbam.git
cd gbam
npm install
npm run compile
# Press F5 to test in VS Code