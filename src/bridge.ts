import type { PreviewStore } from "./model";

export interface PreviewBridge {
  store: PreviewStore;
  renderMarkdown: (
    markdown: string,
    target: HTMLElement,
    sourcePath: string,
  ) => Promise<() => void>;
  savePng: (blob: Blob, title: string) => Promise<string>;
  notify: (message: string) => void;
}
