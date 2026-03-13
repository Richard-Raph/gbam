import * as path from 'path';
import * as vscode from 'vscode';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

// State
let isEnabled = true;
let lastTriggerTime = 0;
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

// Config
const COOLDOWN_MS = 3000;        // 3s between Gbams
const DRAMATIC_DELAY_MS = 100;   // Suspense before impact

export function activate(context: vscode.ExtensionContext) {
	try {
		outputChannel = vscode.window.createOutputChannel('Gbam');

		// Create status bar item
		statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		statusBarItem.text = '💥 Gbam';
		statusBarItem.tooltip = 'Click to test Gbam sound';
		statusBarItem.command = 'gbam.test';
		statusBarItem.show();
		context.subscriptions.push(statusBarItem);

		// Load config
		const config = vscode.workspace.getConfiguration('gbam');
		isEnabled = config.get<boolean>('enabled', true);

		// Commands
		context.subscriptions.push(
			vscode.commands.registerCommand('gbam.enable', () => {
				isEnabled = true;
				vscode.window.showInformationMessage('💥 Gbam enabled!');
			}),

			vscode.commands.registerCommand('gbam.disable', () => {
				isEnabled = false;
				vscode.window.showInformationMessage('Gbam disabled');
			}),

			vscode.commands.registerCommand('gbam.test', () => {
				outputChannel.appendLine('Gbam: Manual test triggered');
				triggerGbam(context, 'Manual test');
			})
		);

		// Hook 1: Task success
		context.subscriptions.push(
			vscode.tasks.onDidEndTaskProcess((event) => {
				if (!isEnabled) { return; }
				if (event.exitCode !== 0) { return; }

				const taskName = event.execution.task.name.toLowerCase();
				const triggers = ['build', 'test', 'compile', 'run', 'npm', 'yarn', 'pnpm'];

				if (triggers.some(t => taskName.includes(t))) {
					outputChannel.appendLine(`Gbam: Task success detected: ${taskName}`);
					triggerGbam(context, `Task: ${event.execution.task.name}`);
				}
			})
		);

		// Hook 2: Debug session ended
		context.subscriptions.push(
			vscode.debug.onDidTerminateDebugSession((session) => {
				if (!isEnabled) { return; }
				outputChannel.appendLine('Gbam: Debug session ended');
				triggerGbam(context, 'Debug finished');
			})
		);

		// Hook 3: Terminal closed with success
		context.subscriptions.push(
			vscode.window.onDidCloseTerminal((terminal) => {
				if (!isEnabled) { return; }
				const name = terminal.name.toLowerCase();
				if (name.includes('build') || name.includes('test') || name.includes('watch')) {
					if (terminal.exitStatus && terminal.exitStatus.code === 0) {
						triggerGbam(context, `Terminal: ${terminal.name}`);
					}
				}
			})
		);

		outputChannel.appendLine('💥 Gbam activated and listening...');

	} catch (err: any) {
		console.error('Gbam activation error:', err);
		vscode.window.showErrorMessage(`Gbam failed to activate: ${err.message || err}`);
	}
}

async function triggerGbam(
	context: vscode.ExtensionContext,
	reason: string
) {
	const now = Date.now();
	if (now - lastTriggerTime < COOLDOWN_MS) {
		outputChannel.appendLine('Gbam: Cooldown active, skipping');
		return;
	}
	lastTriggerTime = now;

	outputChannel.appendLine(`Gbam triggered: ${reason}`);

	await delay(DRAMATIC_DELAY_MS);
	await playGbam(context);
	showGbamStatus(reason);
}

async function playGbam(context: vscode.ExtensionContext) {
	try {
		const config = vscode.workspace.getConfiguration('gbam');
		const volume = config.get<number>('volume', 0.7);

		const soundPath = path.join(context.extensionPath, 'media', 'gbam.wav');
		outputChannel.appendLine(`Gbam: Looking for sound at: ${soundPath}`);

		// Check file exists
		const fs = await import('fs');
		if (!fs.existsSync(soundPath)) {
			outputChannel.appendLine(`Gbam ERROR: Sound file not found!`);
			vscode.window.showWarningMessage('Gbam: Sound file not found at media/gbam.wav');
			return;
		}

		outputChannel.appendLine(`Gbam: Found sound file, playing at volume ${volume}`);

		const platform = process.platform;
		let cmd: string;

		if (platform === 'darwin') {
			// macOS
			cmd = `afplay "${soundPath}" -v ${volume}`;
		} else if (platform === 'linux') {
			// Linux with multiple fallbacks
			const volPercent = Math.floor(volume * 100);
			cmd = `(paplay --volume=${Math.floor(volume * 65535)} "${soundPath}" 2>/dev/null) || (aplay -q "${soundPath}" 2>/dev/null) || (ffplay -nodisp -autoexit -volume ${volPercent} "${soundPath}" 2>/dev/null)`;
		} else {
			// Windows - escape backslashes
			const escapedPath = soundPath.replace(/\\/g, '\\\\');
			cmd = `powershell -Command "(New-Object System.Media.SoundPlayer '${escapedPath}').PlaySync();"`;
		}

		outputChannel.appendLine(`Gbam: Executing audio command`);

		await execAsync(cmd, {
			timeout: 10000,
			windowsHide: true
		});

		outputChannel.appendLine('Gbam: Sound played successfully');

	} catch (err: any) {
		outputChannel.appendLine(`Gbam AUDIO ERROR: ${err.message || err}`);
		vscode.window.showWarningMessage(`Gbam sound failed: ${err.message || 'Check audio system'}`);
	}
}

function showGbamStatus(reason: string) {
	const originalText = statusBarItem.text;
	statusBarItem.text = '💥 Gbam!';
	statusBarItem.tooltip = `Last: ${reason}`;
	statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');

	setTimeout(() => {
		statusBarItem.text = originalText;
		statusBarItem.backgroundColor = undefined;
	}, 2000);

	vscode.window.setStatusBarMessage(`💥 Gbam — ${reason}`, 2500);
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function deactivate() {
	outputChannel?.dispose();
	statusBarItem?.dispose();
}
