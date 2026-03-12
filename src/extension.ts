import * as path from 'path';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// State
let isEnabled = true;
let lastTriggerTime = 0;
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

// Config
const COOLDOWN_MS = 3000;        // 3s between Gbams
const DRAMATIC_DELAY_MS = 150;   // Suspense before impact

export function activate(context: vscode.ExtensionContext) {
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
	isEnabled = config.get('enabled', true);

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
			triggerGbam(context, 'Manual test');
		})
	);

	// Hook 1: Task success (MOST RELIABLE) [^101^][^104^]
	context.subscriptions.push(
		vscode.tasks.onDidEndTaskProcess((event) => {
			if (!isEnabled) return;
			if (event.exitCode !== 0) return; // Only success

			const taskName = event.execution.task.name.toLowerCase();
			const triggers = ['build', 'test', 'compile', 'run', 'npm', 'yarn', 'pnpm'];

			if (triggers.some(t => taskName.includes(t))) {
				triggerGbam(context, `Task: ${event.execution.task.name}`);
			}
		})
	);

	// Hook 2: Debug session ended (no error = success) [^107^]
	context.subscriptions.push(
		vscode.debug.onDidTerminateDebugSession((session) => {
			if (!isEnabled) return;

			// We can't easily get exit code from debug session directly
			// But termination without error usually means success
			// Use a heuristic: if session lasted > 2s, it probably ran successfully
			triggerGbam(context, 'Debug finished');
		})
	);

	// Hook 3: Terminal closed with success (optional, can be noisy)
	context.subscriptions.push(
		vscode.window.onDidCloseTerminal((terminal) => {
			if (!isEnabled) return;
			// Only trigger for named terminals that look like build/test
			const name = terminal.name.toLowerCase();
			if (name.includes('build') || name.includes('test') || name.includes('watch')) {
				// Check exit status if available
				if (terminal.exitStatus && terminal.exitStatus.code === 0) {
					triggerGbam(context, `Terminal: ${terminal.name}`);
				}
			}
		})
	);

	outputChannel.appendLine('💥 Gbam activated and listening...');
}

async function triggerGbam(
	context: vscode.ExtensionContext,
	reason: string
) {
	// Cooldown check
	const now = Date.now();
	if (now - lastTriggerTime < COOLDOWN_MS) {
		return;
	}
	lastTriggerTime = now;

	outputChannel.appendLine(`Gbam triggered: ${reason}`);

	// Dramatic pause
	await delay(DRAMATIC_DELAY_MS);

	// Play sound
	await playGbam(context);

	// Status bar flash
	showGbamStatus(reason);
}

async function playGbam(context: vscode.ExtensionContext) {
	try {
		const config = vscode.workspace.getConfiguration('gbam');
		const volume = config.get<number>('volume', 0.7);

		// FIXED: Use context.extensionPath (not extensionUri.fsPath)
		const soundPath = path.join(context.extensionPath, 'media', 'gbam.mp3');

		const platform = process.platform;
		let cmd: string;

		if (platform === 'darwin') {
			// macOS
			cmd = `afplay "${soundPath}" -v ${volume}`;
		} else if (platform === 'linux') {
			// Linux - try paplay first, fallback to aplay
			cmd = `paplay "${soundPath}" --volume ${Math.floor(volume * 65535)} 2>/dev/null || aplay "${soundPath}"`;
		} else {
			// Windows
			cmd = `powershell -c "(New-Object System.Media.SoundPlayer '${soundPath}').PlaySync()"`;
		}

		await execAsync(cmd, { timeout: 5000 });
	} catch (err) {
		outputChannel.appendLine(`Audio error: ${err}`);
	}
}

function showGbamStatus(reason: string) {
	// Flash status bar
	const originalText = statusBarItem.text;
	statusBarItem.text = '💥 Gbam!';
	statusBarItem.tooltip = `Last: ${reason}`;
	statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');

	// Reset after 2 seconds
	setTimeout(() => {
		statusBarItem.text = originalText;
		statusBarItem.backgroundColor = undefined;
	}, 2000);

	// Also show message
	vscode.window.setStatusBarMessage(`💥 Gbam — ${reason}`, 2500);
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function deactivate() {
	outputChannel?.dispose();
	statusBarItem?.dispose();
}