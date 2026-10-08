import { describe, expect, it } from "vite-plus/test";
import { assessFit, fits, stripFrontmatter, PreviewStore } from "./model";

describe("single-screen fit", () => {
  it("accepts content exactly at the page boundary", () => {
    expect(fits(assessFit(736, 736, 336, 336))).toBe(true);
  });
  it("blocks vertical overflow and reports extra lines", () => {
    const result = assessFit(800, 736, 336, 336);
    expect(fits(result)).toBe(false);
    expect(result.extraLines).toBe(3);
  });
  it("blocks wide content even when the height fits", () => {
    expect(fits(assessFit(400, 736, 500, 336))).toBe(false);
  });
});

describe("Markdown source", () => {
  it("hides frontmatter and preserves the body and horizontal rules", () => {
    expect(stripFrontmatter("---\r\ntags: [essay]\r\n---\r\n# Title\r\n\r\n---\r\nText")).toBe(
      "# Title\r\n\r\n---\r\nText",
    );
    expect(stripFrontmatter("# Title\n\n---\nText")).toBe("# Title\n\n---\nText");
  });
  it("stops notifying an unmounted preview", () => {
    const store = new PreviewStore();
    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications++;
    });
    store.setDocument({ path: "one.md", title: "One", markdown: "# One" });
    unsubscribe();
    store.setDocument(null);
    expect(notifications).toBe(1);
    expect(store.getSnapshot()).toBe(null);
  });
});
