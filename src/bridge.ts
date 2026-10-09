import type { PreviewStore } from "./model";

export interface PreviewBridge {
  store: PreviewStore;
  renderMarkdown: (
    markdown: string,
    target: HTMLElement,
    sourcePath: string,
  ) => Promise<() => void>;
  savePng: (blob: Blob, title: string) => Promise<string>;
  copyPng: (blob: Blob) => Promise<void>;
  notify: (message: string) => void;
}
