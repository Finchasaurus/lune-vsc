import { exec } from "child_process";
import * as os from "os";
import * as vscode from "vscode";
import { ScriptItem, ScriptsProvider } from "./scripts-provider";

let terminal: vscode.Terminal | undefined;

function getOrCreateTerminal(name: string): vscode.Terminal {
	const existing = vscode.window.terminals.find((t) => t.name === name);
	if (existing && !existing.exitStatus) {
		return existing;
	}
	return vscode.window.createTerminal(name);
}

function isLuneAvailable(): Promise<boolean> {
	return new Promise((resolve) => {
		const cmd = os.platform() === "win32" ? "where lune" : "which lune";
		exec(cmd, (err, stdout) => {
			resolve(!err && !!stdout.trim());
		});
	});
}

export function activate(context: vscode.ExtensionContext) {
	const runner = vscode.commands.registerCommand(
		"lune-vsc.runScript",
		async (item: ScriptItem | vscode.Uri | any) => {
			let scriptPath: string | undefined;

			if (item instanceof vscode.Uri) {
				scriptPath = item.fsPath;
			} else if (item?.fullPath) {
				scriptPath = item.fullPath;
			} else if (item?.resourceUri) {
				scriptPath = item.resourceUri.fsPath;
			} else {
				const activeEditor = vscode.window.activeTextEditor;
				if (activeEditor && /(lua|luau)$/.test(activeEditor.document.languageId)) {
					scriptPath = activeEditor.document.uri.fsPath;
				}
			}

			if (!scriptPath) {
				vscode.window.showErrorMessage("Could not determine script path to run.");
				return;
			}

			const luneExists = await isLuneAvailable();
			if (!luneExists) {
				vscode.window.showErrorMessage(
					"Lune is not installed or is not available in your PATH. Please install Lune to run scripts.",
				);
				return;
			}

			const terminalName = "Lune Script Runner";
			terminal = getOrCreateTerminal(terminalName);
			terminal.show();
			terminal.sendText(`lune run "${scriptPath}"`);
		},
	);

	const rootPath =
		vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
			? vscode.workspace.workspaceFolders[0].uri.fsPath
			: undefined;

	const scriptsProvider = new ScriptsProvider(rootPath);
	vscode.window.registerTreeDataProvider("lune-vsc.scriptsView", scriptsProvider);
	vscode.window.createTreeView("lune-vsc.scriptsView", {
		treeDataProvider: scriptsProvider,
	});

	vscode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration("lune scripts.scriptDirectories")) {
			scriptsProvider.refresh();
		}
	});

	const refresh = vscode.commands.registerCommand("lune-vsc.refreshScripts", () => {
		scriptsProvider.refresh();
		vscode.window.showInformationMessage("Lune Scripts refreshed.");
	});

	context.subscriptions.push(runner, refresh);
}

export function deactivate() {
	if (terminal) {
		terminal.dispose();
		terminal = undefined;
	}
}
