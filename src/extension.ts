import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { spawn } from "child_process";

// ─────────────────────────────────────────────
//  ⚙️  ENVIRONMENT SWITCH
//  DEV  → keep as "dev"
//  PROD → change to "prod" before running vsce package
// ─────────────────────────────────────────────

// ✅ DEV MODE
// const ENV_MODE: "dev" | "prod" = "dev";

// 🚀 PROD MODE — uncomment before vsce package
const ENV_MODE: "dev" | "prod" = "prod";

// ─────────────────────────────────────────────

const COOLDOWN_MS       = 3_000;
const FLASH_DURATION_MS = 600;

const FLASH_KEYS = [
    "statusBar.background",
    "statusBar.foreground",
    "statusBar.noFolderBackground",
    "statusBar.debuggingBackground",
] as const;

const FLASH_COLOR_BG = "#23d18b";
const FLASH_COLOR_FG = "#000000";

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
interface GbamState {
    isEnabled:       boolean;
    lastTriggerTime: number;
    flashTimeout:    NodeJS.Timeout | undefined;
    extensionPath:   string;
    outputChannel:   vscode.OutputChannel;
    statusBarItem:   vscode.StatusBarItem;
    flashColors:     Record<string, string>;
    restoreColors:   Record<string, string> | undefined;
}

let state: GbamState;

// ─────────────────────────────────────────────
//  LOGGING
// ─────────────────────────────────────────────
type LogLevel = "INFO" | "WARN" | "ERROR";

function log(level: LogLevel, message: string): void {
    const ts = new Date().toISOString();
    state.outputChannel.appendLine(`[GBAM ${ts}] [${level}] ${message}`);
}

// ─────────────────────────────────────────────
//  ACTIVATION
// ─────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel("Gbam");
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );

    const config  = vscode.workspace.getConfiguration("workbench");
    const current = config.get<Record<string, string>>("colorCustomizations") ?? {};

    const restoreBase = { ...current };
    for (const key of FLASH_KEYS) { delete restoreBase[key]; }
    const restoreColors = Object.keys(restoreBase).length > 0 ? restoreBase : undefined;

    const flashColors: Record<string, string> = {
        ...(restoreColors ?? {}),
        "statusBar.background":          FLASH_COLOR_BG,
        "statusBar.foreground":          FLASH_COLOR_FG,
        "statusBar.noFolderBackground":  FLASH_COLOR_BG,
        "statusBar.debuggingBackground": FLASH_COLOR_BG,
    };

    state = {
        isEnabled:       true,
        lastTriggerTime: 0,
        flashTimeout:    undefined,
        extensionPath:   context.extensionPath,
        outputChannel,
        statusBarItem,
        flashColors,
        restoreColors,
    };

    context.subscriptions.push(outputChannel, statusBarItem);

    context.subscriptions.push(
        vscode.commands.registerCommand("gbam.enable", () => {
            state.isEnabled = true;
            vscode.window.showInformationMessage("💥 Gbam enabled");
            log("INFO", "Manually enabled");
        }),
        vscode.commands.registerCommand("gbam.disable", () => {
            state.isEnabled = false;
            vscode.window.showInformationMessage("Gbam disabled");
            log("INFO", "Manually disabled");
        }),
        vscode.commands.registerCommand("gbam.test", () => {
            handleStatusBarClick();
        })
    );

    statusBarItem.text    = "💥 Gbam";
    statusBarItem.tooltip = "Click to test Gbam";
    statusBarItem.command = "gbam.test";
    statusBarItem.show();

    context.subscriptions.push(
        vscode.tasks.onDidEndTaskProcess((event) => {
            if (!state.isEnabled) { return; }
            if (event.exitCode !== 0) {
                log("INFO", `Task "${event.execution.task.name}" exited ${event.exitCode} — skipping`);
                return;
            }
            const name = event.execution.task.name.toLowerCase();
            if (isDevCommand(name)) {
                triggerGbam(`Task succeeded: ${name}`);
            }
        }),

        vscode.debug.onDidTerminateDebugSession((session) => {
            if (!state.isEnabled) { return; }
            if (session.type !== "" && session.configuration?.request === "launch") {
                triggerGbam(`Debug session ended: ${session.name}`);
            }
        })
    );

    log("INFO", `Gbam activated — mode: ${ENV_MODE} — extensionPath: ${context.extensionPath}`);
}

// ─────────────────────────────────────────────
//  COMMAND FILTER
// ─────────────────────────────────────────────
const DEV_COMMAND_RE = /\b(build|test|dev|start|run|compile|deploy)\b/;

function isDevCommand(command: string): boolean {
    return DEV_COMMAND_RE.test(command);
}

// ─────────────────────────────────────────────
//  TRIGGER
// ─────────────────────────────────────────────
function triggerGbam(reason: string): void {
    log("INFO", `Trigger: ${reason}`);

    const now = Date.now();
    if (now - state.lastTriggerTime < COOLDOWN_MS) {
        log("INFO", "Skipped — cooldown active");
        return;
    }
    state.lastTriggerTime = now;

    playSound();
    flashBar();
}

// ─────────────────────────────────────────────
//  FULL STATUS BAR FLASH
// ─────────────────────────────────────────────
function flashBar(): void {
    if (state.flashTimeout) {
        clearTimeout(state.flashTimeout);
        state.flashTimeout = undefined;
    }

    const config = vscode.workspace.getConfiguration("workbench");

    config.update("colorCustomizations", state.flashColors, vscode.ConfigurationTarget.Global)
        .then(undefined, (e: Error) => log("ERROR", `flash set failed: ${e.message}`));

    state.flashTimeout = setTimeout(() => {
        state.flashTimeout = undefined;
        config.update("colorCustomizations", state.restoreColors, vscode.ConfigurationTarget.Global)
            .then(undefined, (e: Error) => log("ERROR", `flash clear failed: ${e.message}`));
        log("INFO", "Bar restored");
    }, FLASH_DURATION_MS);

    log("INFO", `Bar flashed for ${FLASH_DURATION_MS}ms`);
}

// ─────────────────────────────────────────────
//  SOUND
//
//  Strategy per platform:
//
//  macOS  → afplay       — built-in, instant, reliable
//  Linux  → paplay       — PulseAudio, most distros have it
//           fallback: aplay (ALSA)
//           fallback: ffplay (ffmpeg)
//  Windows → wscript.exe — built into EVERY Windows since 98.
//            Runs a tiny inline VBScript that calls the
//            Windows WScript.Shell sndPlaySound API.
//            Starts in ~40ms vs PowerShell's ~300ms.
//            No install required, no permissions needed.
//
//  All spawns are detached:false so they are killed if
//  VS Code exits. Shell:false avoids a second shell process.
// ─────────────────────────────────────────────

function resolveSoundPath(): string {
    return ENV_MODE === "dev"
        ? path.join(__dirname, "..", "media", "gbam.wav")
        : path.join(state.extensionPath, "media", "gbam.wav");
}

function playSound(): void {
    const soundPath = resolveSoundPath();

    if (!fs.existsSync(soundPath)) {
        log("ERROR", `Sound file not found: ${soundPath}`);
        vscode.window.showWarningMessage(
            `Gbam: sound file missing at "${soundPath}". ` +
            `Ensure media/gbam.wav exists and is listed in package.json.`
        );
        return;
    }

    switch (process.platform) {
        case "darwin":
            spawnAudio("afplay", [soundPath]);
            break;

        case "linux":
            playLinux(soundPath);
            break;

        case "win32":
            playWindows(soundPath);
            break;

        default:
            log("WARN", `Unsupported platform: ${process.platform}`);
    }
}

// ── macOS / Linux helpers ──

function playLinux(soundPath: string): void {
    // Try in order: paplay (PulseAudio) → aplay (ALSA) → ffplay (ffmpeg)
    // Each is a common built-in on most Linux desktops
    const candidates: [string, string[]][] = [
        ["paplay",  [soundPath]],
        ["aplay",   ["-q", soundPath]],
        ["ffplay",  ["-nodisp", "-autoexit", "-loglevel", "quiet", soundPath]],
    ];

    tryNextCandidate(candidates, 0);
}

function tryNextCandidate(candidates: [string, string[]][], index: number): void {
    if (index >= candidates.length) {
        log("ERROR", "No audio player found on this Linux system (tried paplay, aplay, ffplay)");
        vscode.window.showWarningMessage("Gbam: no audio player found. Install pulseaudio-utils or alsa-utils.");
        return;
    }

    const [cmd, args] = candidates[index];
    const child = spawn(cmd, args, { detached: false, shell: false });

    // If the command doesn't exist, ENOENT fires — try next
    child.on("error", (e: NodeJS.ErrnoException) => {
        if (e.code === "ENOENT") {
            log("INFO", `${cmd} not found, trying next`);
            tryNextCandidate(candidates, index + 1);
        } else {
            log("ERROR", `${cmd} error: ${e.message}`);
        }
    });

    child.on("close", (code) => {
        if (code === 0) {
            log("INFO", `Sound played via ${cmd}`);
        }
    });
}

// ── Windows: wscript VBScript — no PowerShell, no install ──
//
//  wscript.exe has been on every Windows since 98.
//  It starts in ~40ms (vs PowerShell's ~300ms).
//  We write a tiny temp .vbs file and run it.
//  The VBScript uses the Windows Multimedia API via
//  WScript.Shell to play the WAV synchronously but
//  the wscript process is detached so it doesn't block us.

function playWindows(soundPath: string): void {
    // Normalise to backslashes for VBScript
    const winPath = soundPath.replace(/\//g, "\\");

    // Write a temp VBScript — one-liner, plays the WAV and exits
    const vbsPath = path.join(require("os").tmpdir(), "gbam_play.vbs");
    const vbs = `Dim snd\nSet snd = CreateObject("WMPlayer.OCX")\nsnd.URL = "${winPath}"\nsnd.controls.play\nDo While snd.playState <> 1\n  WScript.Sleep 50\nLoop`;

    try {
        fs.writeFileSync(vbsPath, vbs, "utf8");
    } catch (e: any) {
        log("ERROR", `Failed to write VBScript: ${e.message}`);
        playWindowsFallback(soundPath);
        return;
    }

    const child = spawn("wscript.exe", [vbsPath], {
        detached: true,   // fully independent — exits on its own when done
        shell:    false,
        windowsHide: true // no flash of a console window
    });

    child.on("error", (e: NodeJS.ErrnoException) => {
        log("WARN", `wscript failed (${e.message}), trying PowerShell fallback`);
        playWindowsFallback(soundPath);
    });

    child.on("close", (code) => {
        log("INFO", `wscript exited: code=${code}`);
        // Clean up temp file
        fs.unlink(vbsPath, () => {});
    });

    // Unref so VS Code exit doesn't wait for it
    child.unref();

    log("INFO", "Sound dispatched via wscript");
}

function playWindowsFallback(soundPath: string): void {
    // Last resort: PowerShell with PlaySync
    // Slower cold-start but guaranteed to work on any Windows
    log("INFO", "Falling back to PowerShell PlaySync");
    spawnAudio("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `(New-Object Media.SoundPlayer '${soundPath.replace(/\\/g, "\\\\")}').PlaySync();`,
    ]);
}

// ── Generic spawn helper ──
function spawnAudio(cmd: string, args: string[]): void {
    log("INFO", `Spawning: ${cmd} ${args[0] ?? ""}`);
    const child = spawn(cmd, args, { detached: false, shell: false });
    child.stderr?.on("data", (d: Buffer) => log("WARN",  `stderr: ${d.toString().trim()}`));
    child.on("error",        (e: Error)  => log("ERROR", `${cmd} error: ${e.message}`));
    child.on("close",        (code)      => log("INFO",  `${cmd} exited: code=${code}`));
}

// ─────────────────────────────────────────────
//  COOLDOWN-AWARE CLICK HANDLER
// ─────────────────────────────────────────────
function handleStatusBarClick(): void {
    const remaining = COOLDOWN_MS - (Date.now() - state.lastTriggerTime);
    if (remaining > 0) {
        vscode.window.setStatusBarMessage(
            `💥 Gbam cooling down… (${Math.ceil(remaining / 1000)}s)`,
            1_500
        );
        log("INFO", `Click ignored — cooldown ${Math.ceil(remaining / 1000)}s remaining`);
        return;
    }
    triggerGbam("Manual test");
}

// ─────────────────────────────────────────────
//  DEACTIVATION
// ─────────────────────────────────────────────
export function deactivate(): void {
    if (state?.flashTimeout) {
        clearTimeout(state.flashTimeout);
        const config = vscode.workspace.getConfiguration("workbench");
        config.update("colorCustomizations", state.restoreColors, vscode.ConfigurationTarget.Global)
            .then(undefined, () => {});
    }
    state?.statusBarItem?.dispose();
    state?.outputChannel?.dispose();
}