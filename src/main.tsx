import {
  Component,
  ItemView,
  MarkdownRenderer,
  MarkdownView,
  Notice,
  Plugin,
  TFile,
  TFolder,
  normalizePath,
  type Editor,
  type WorkspaceLeaf,
} from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { Preview } from "./Preview";
import { CARD, PreviewStore, safeFilename } from "./model";
import type { PreviewBridge } from "./bridge";
import "./styles.css";

const VIEW_TYPE = "one-screen-preview";

class OneScreenView extends ItemView {
  private root: Root | null = null;
  private plugin: OneScreenPlugin;
  constructor(leaf: WorkspaceLeaf, plugin: OneScreenPlugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "One Screen";
  }
  getIcon() {
    return "panel-right";
  }

  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("os-view");
    this.root = createRoot(this.contentEl);
    const bridge: PreviewBridge = {
      store: this.plugin.store,
      renderMarkdown: async (markdown, target, sourcePath) => {
        const component = new Component();
        this.addChild(component);
        try {
          await MarkdownRenderer.render(this.app, markdown, target, sourcePath, component);
        } catch (error) {
          this.removeChild(component);
          throw error;
        }
        return () => {
          this.removeChild(component);
        };
      },
      savePng: (blob, title) => this.plugin.savePng(blob, title),
      notify: (message) => {
        new Notice(message);
      },
    };
    this.root.render(<Preview bridge={bridge} />);
  }

  async onClose() {
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
  }
}

export default class OneScreenPlugin extends Plugin {
  store = new PreviewStore();
  private currentFile: TFile | null = null;
  private documentVersion = 0;
  private editorTimer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => new OneScreenView(leaf, this));
    this.addRibbonIcon("panel-right", "One Screen：打开单屏预览", () => {
      void this.openPreview();
    });
    this.addCommand({
      id: "open-preview",
      name: "打开单屏卡片预览",
      callback: () => {
        void this.openPreview();
      },
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (leaf?.view instanceof MarkdownView && leaf.view.file) {
          void this.refreshDocument(leaf.view.file, leaf.view.editor);
        }
      }),
    );
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor, info) => {
        if (!info.file || info.file !== this.currentFile) return;
        clearTimeout(this.editorTimer);
        const file = info.file;
        this.editorTimer = setTimeout(() => {
          void this.refreshDocument(file, editor);
        }, 120);
      }),
    );
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file?.extension === "md") void this.refreshDocument(file);
      }),
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file === this.currentFile) void this.refreshDocument(file);
      }),
    );
    this.registerEvent(
      this.app.vault.on("rename", (file) => {
        if (file instanceof TFile && file === this.currentFile) void this.refreshDocument(file);
      }),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file !== this.currentFile) return;
        clearTimeout(this.editorTimer);
        this.documentVersion++;
        this.currentFile = null;
        this.store.setDocument(null);
      }),
    );
    this.app.workspace.onLayoutReady(() => {
      if (this.closed) return;
      const file = this.app.workspace.getActiveFile();
      if (file?.extension === "md") void this.refreshDocument(file);
    });
  }

  private async refreshDocument(file: TFile, editor?: Editor) {
    if (this.closed || file.extension !== "md") return;
    clearTimeout(this.editorTimer);
    this.currentFile = file;
    const version = ++this.documentVersion;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const liveEditor = editor ?? (view?.file === file ? view.editor : undefined);
    try {
      const markdown = liveEditor ? liveEditor.getValue() : await this.app.vault.cachedRead(file);
      if (version !== this.documentVersion || this.closed) return;
      this.store.setDocument({ path: file.path, title: file.basename, markdown });
    } catch (error) {
      if (version !== this.documentVersion || this.closed) return;
      new Notice(`One Screen：${error instanceof Error ? error.message : "读取笔记失败。"}`);
    }
  }

  async openPreview() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      const newLeaf = this.app.workspace.getRightLeaf(false);
      if (!newLeaf) return;
      leaf = newLeaf;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    const markdownView = this.app.workspace.getMostRecentLeaf()?.view;
    if (markdownView instanceof MarkdownView && markdownView.file) {
      await this.refreshDocument(markdownView.file, markdownView.editor);
    }
  }

  async savePng(blob: Blob, title: string): Promise<string> {
    const directory = CARD.exportFolder;
    let parent = "";
    for (const segment of directory.split("/").filter(Boolean)) {
      parent = normalizePath(`${parent}/${segment}`);
      const existing = this.app.vault.getAbstractFileByPath(parent);
      if (existing && !(existing instanceof TFolder)) throw new Error(`${parent} 不是文件夹。`);
      if (!existing) await this.app.vault.createFolder(parent);
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const stem = `${safeFilename(title)}-${timestamp}`;
    let path = normalizePath(`${directory}/${stem}.png`);
    let suffix = 1;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = normalizePath(`${directory}/${stem}-${suffix++}.png`);
    }
    await this.app.vault.createBinary(path, await blob.arrayBuffer());
    return path;
  }

  onunload() {
    this.closed = true;
    this.documentVersion++;
    clearTimeout(this.editorTimer);
  }
}
