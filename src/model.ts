export const CARD = {
  // iPhone 18 Pro: 1206 × 2622 physical pixels, rendered at 3×.
  device: "iPhone 18 Pro",
  width: 402,
  height: 874,
  fontSize: 17,
  lineHeight: 1.45,
  exportScale: 3,
  exportFolder: "attachments/one-screen",
} as const;

// Adapt spacing only. The body stays at a readable 17 logical pixels.
export const DENSITIES = ["comfortable", "balanced", "compact"] as const;
export type Density = (typeof DENSITIES)[number];
export const DENSITY_LABELS: Record<Density, string> = {
  comfortable: "舒展排版",
  balanced: "适中排版",
  compact: "紧凑排版",
};

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
  lineHeight: number = CARD.fontSize * CARD.lineHeight,
): FitMetrics {
  const overflow = Math.max(0, used - available);
  return {
    used,
    available,
    overflow,
    horizontalOverflow: Math.max(0, contentWidth - availableWidth),
    percent: Math.round((used / Math.max(1, available)) * 100),
    extraLines: Math.ceil(overflow / lineHeight),
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
