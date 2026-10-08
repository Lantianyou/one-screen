export const CARD = {
  // iPhone 15 Pro: 1179 × 2556 physical pixels, rendered at 3×.
  width: 393,
  height: 852,
  fontSize: 17,
  lineHeight: 1.4,
  exportScale: 3,
  exportFolder: "attachments/one-screen",
} as const;

export function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^\uFEFF?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/, "");
}

export interface FitMetrics {
  used: number;
  available: number;
  overflow: number;
  horizontalOverflow: number;
  percent: number;
  extraLines: number;
}

export function assessFit(
  used: number,
  available: number,
  contentWidth: number,
  availableWidth: number,
): FitMetrics {
  const overflow = Math.max(0, used - available);
  return {
    used,
    available,
    overflow,
    horizontalOverflow: Math.max(0, contentWidth - availableWidth),
    percent: Math.round((used / Math.max(1, available)) * 100),
    extraLines: Math.ceil(overflow / (CARD.fontSize * CARD.lineHeight)),
  };
}

export function fits(metrics: FitMetrics): boolean {
  return metrics.overflow <= 1 && metrics.horizontalOverflow <= 1;
}

export interface EssayDocument {
  path: string;
  title: string;
  markdown: string;
}

export class PreviewStore {
  private listeners = new Set<() => void>();
  private document: EssayDocument | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.document;

  setDocument(document: EssayDocument | null) {
    if (
      this.document?.path === document?.path &&
      this.document?.title === document?.title &&
      this.document?.markdown === document?.markdown
    )
      return;
    this.document = document;
    for (const listener of this.listeners) listener();
  }
}

export function safeFilename(name: string): string {
  const cleaned = Array.from(name)
    .filter((char) => char.charCodeAt(0) >= 32 && !'<>:"/\\|?*'.includes(char))
    .join("")
    .trim()
    .replace(/[. ]+$/, "");
  return cleaned.slice(0, 100) || "essay";
}
