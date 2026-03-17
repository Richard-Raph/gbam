import * as vscode from "vscode";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

let isEnabled = true;
let lastTriggerTime = 0;
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

const COOLDOWN_MS = 3000;
const FLASH_DURATION_MS = 600;
const DRAMATIC_DELAY_MS = 150;

export function activate(context: vscode.ExtensionContext): void {
    outputChannel = vscode.window.createOutputChannel("Gbam");

    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.text = "💥 Gbam";
    statusBarItem.tooltip = "Click to test Gbam";
    statusBarItem.command = "gbam.test";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    const config = vscode.workspace.getConfiguration("gbam");
    const enabledSetting = config.get<boolean>("enabled");
    if (enabledSetting !== undefined) {
        isEnabled = enabledSetting;
    }

    // Commands
    context.subscriptions.push(
        vscode.commands.registerCommand("gbam.enable", () => {
            isEnabled = true;
            vscode.window.showInformationMessage("💥 Gbam enabled!");
        }),
        vscode.commands.registerCommand("gbam.disable", () => {
            isEnabled = false;
            vscode.window.showInformationMessage("Gbam disabled");
        }),
        vscode.commands.registerCommand("gbam.test", () => {
            triggerGbam("Manual test");
        })
    );

    // Task success
    context.subscriptions.push(
        vscode.tasks.onDidEndTaskProcess((event) => {
            if (!isEnabled){ return;}
            if (event.exitCode !== 0){ return;}

            const taskName = event.execution.task.name.toLowerCase();
            if (isLikelyDevCommand(taskName)) {
                triggerGbam(`Task success: ${taskName}`);
            }
        })
    );

    // Debug session finished
    context.subscriptions.push(
        vscode.debug.onDidTerminateDebugSession(() => {
            if (!isEnabled){ return;}
            triggerGbam("Debug session finished");
        })
    );

    // Terminal commands
    const runningCommands = new Map<string, string>();
    context.subscriptions.push(
        vscode.window.onDidStartTerminalShellExecution((event) => {
            if (!isEnabled){ return;}
            const cmdLine = event.execution.commandLine.value;
            if (typeof cmdLine !== "string"){ return;}
            const command = cmdLine.toLowerCase();
            if (!isLikelyDevCommand(command)){ return;}
            runningCommands.set(event.terminal.name, command);
        })
    );

    context.subscriptions.push(
        vscode.window.onDidCloseTerminal((terminal) => {
            if (!isEnabled){ return;}
            const command = runningCommands.get(terminal.name);
            if (!command){ return;}
            runningCommands.delete(terminal.name);
            triggerGbam(`Terminal finished: ${command}`);
        })
    );

    outputChannel.appendLine("💥 Gbam activated");
}

function isLikelyDevCommand(command: string): boolean {
    const keywords = ["build", "test", "compile", "dev", "start", "run", "serve", "deploy"];
    return keywords.some((k) => command.includes(k));
}

async function triggerGbam(reason: string): Promise<void> {
    const now = Date.now();
    if (now - lastTriggerTime < COOLDOWN_MS){ return;}
    lastTriggerTime = now;

    await delay(DRAMATIC_DELAY_MS);

    await playGbam();
    flashAllEditors();
    showGbamStatus(reason);
    vscode.window.showInformationMessage(`💥 GBAM! ${reason}`);
}

async function playGbam(): Promise<void> {
    try {
        const soundPath = path.join(__dirname, "..", "media", "gbam.wav");
        let command = "";

        switch (process.platform) {
            case "darwin":
                command = `afplay "${soundPath}"`;
                break;
            case "linux":
                command = `aplay "${soundPath}"`;
                break;
            case "win32":
                const escaped = soundPath.replace(/\\/g, "\\\\");
                command = `powershell -c (New-Object Media.SoundPlayer '${escaped}').PlaySync();`;
                break;
        }

        if (command){ await execAsync(command, { windowsHide: true });}
    } catch (err) {
        outputChannel.appendLine("Gbam sound failed to play");
    }
}

function flashAllEditors(): void {
    const editors = vscode.window.visibleTextEditors;
    if (!editors.length){ return;}

    for (const editor of editors) {
        const decoration = vscode.window.createTextEditorDecorationType({
            borderWidth: "6px",
            borderStyle: "solid",
            borderColor: "#4dff88",
            backgroundColor: "rgba(77, 255, 136, 0.15)",
            isWholeLine: true,
        });

        const ranges: vscode.Range[] = [];
        for (const visibleRange of editor.visibleRanges) {
            for (let line = visibleRange.start.line; line <= visibleRange.end.line; line++) {
                ranges.push(
                    new vscode.Range(line, 0, line, editor.document.lineAt(line).text.length)
                );
            }
        }

        editor.setDecorations(decoration, ranges);

        setTimeout(() => decoration.dispose(), FLASH_DURATION_MS);
    }
}

function showGbamStatus(reason: string): void {
    const originalText = statusBarItem.text;
    statusBarItem.text = "💥 GBAM!";
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");

    setTimeout(() => {
        statusBarItem.text = originalText;
        statusBarItem.backgroundColor = undefined;
    }, 2000);

    vscode.window.setStatusBarMessage(`💥 GBAM — ${reason}`, 2500);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function deactivate(): void {
    outputChannel?.dispose();
    statusBarItem?.dispose();
}
