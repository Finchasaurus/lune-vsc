import * as fs from "fs";
import path from "path";
import {
	CancellationToken,
	Event,
	EventEmitter,
	ProviderResult,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	Uri,
	window,
	workspace,
} from "vscode";

export class ScriptItem extends TreeItem {
	constructor(
		public readonly fullPath: string,
		public readonly label: string,
		public readonly collapsibleState: TreeItemCollapsibleState,
	) {
		super(label, collapsibleState);

		this.tooltip = fullPath;
		this.resourceUri = Uri.file(fullPath);

		if (collapsibleState === TreeItemCollapsibleState.None) {
			this.command = {
				command: "vscode.open",
				title: "Open Script",
				arguments: [Uri.file(fullPath)],
			};
			this.contextValue = "luneScriptItem";
		}
	}
}

export class ScriptsProvider implements TreeDataProvider<ScriptItem> {
	private _onDidChangeTreeData: EventEmitter<ScriptItem | undefined | void> = new EventEmitter<
		ScriptItem | undefined | void
	>();
	readonly onDidChangeTreeData: Event<ScriptItem | undefined | void> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot?: string) {}

	getTreeItem(element: ScriptItem): TreeItem | Thenable<TreeItem> {
		return element;
	}

	getChildren(element?: ScriptItem): ProviderResult<ScriptItem[]> {
		if (!this.workspaceRoot) {
			window.showInformationMessage("No Workspace is open");
			return Promise.resolve([]);
		}

		if (!element) {
			const configDirs = workspace
				.getConfiguration("lune scripts")
				.get<string[]>("scriptDirectories", ["lune", ".lune"]);
			const scriptDirs = configDirs.map((d) => path.join(this.workspaceRoot!, d)).filter(this.pathExists);

			return Promise.resolve(
				scriptDirs.map((p) => new ScriptItem(p, path.basename(p), TreeItemCollapsibleState.Expanded)),
			);
		}

		if (fs.statSync(element.fullPath).isDirectory()) {
			const entries = fs.readdirSync(element.fullPath, { withFileTypes: true });
			const children: ScriptItem[] = [];

			for (const entry of entries) {
				const fullPath = path.join(element.fullPath, entry.name);
				if (entry.isDirectory()) {
					children.push(new ScriptItem(fullPath, entry.name, TreeItemCollapsibleState.Collapsed));
				} else if (entry.isFile() && /\.(lua|luau)$/.test(entry.name)) {
					children.push(new ScriptItem(fullPath, entry.name, TreeItemCollapsibleState.None));
				}
			}

			return children;
		}

		return Promise.resolve([]);
	}

	private pathExists(p: string): boolean {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}
		return true;
	}

	getParent?(element: ScriptItem): ProviderResult<ScriptItem> {
		const parentPath = path.dirname(element.fullPath);
		if (parentPath === this.workspaceRoot) {
			return null;
		}
		const label = path.basename(parentPath);
		return new ScriptItem(parentPath, label, TreeItemCollapsibleState.Collapsed);
	}

	resolveTreeItem?(item: TreeItem, element: ScriptItem, token: CancellationToken): ProviderResult<TreeItem> {
		return item;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}
}
