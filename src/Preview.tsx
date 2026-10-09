import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PreviewBridge } from "./bridge";
import { captureCard, waitForAssets } from "./export";
import { compileCard, type LayoutReport } from "./layout";
import { CARD, DENSITY_LABELS, fits, stripFrontmatter, type EssayDocument } from "./model";

export function Preview({ bridge }: { bridge: PreviewBridge }) {
  const essay = useSyncExternalStore(bridge.store.subscribe, bridge.store.getSnapshot);
  const hasEssay = essay !== null;
  const bodyRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [renderedEssay, setRenderedEssay] = useState<EssayDocument | null>(null);
  const [report, setReport] = useState<LayoutReport | null>(null);
  const [renderState, setRenderState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [scale, setScale] = useState(1);
  const [actualSize, setActualSize] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateScale = () => {
      setScale(actualSize ? 1 : Math.min(1, Math.max(0.1, (stage.clientWidth - 32) / CARD.width)));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [hasEssay, actualSize]);

  useEffect(() => {
    const target = bodyRef.current;
    if (!target || !essay) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    setRenderState("loading");
    setReport(null);
    setError("");
    setMessage("");
    const staging = target.ownerDocument.createElement("div");
    staging.className = "os-markdown markdown-rendered";
    void bridge
      .renderMarkdown(stripFrontmatter(essay.markdown), staging, essay.path)
      .then(async (unload) => {
        if (cancelled) {
          unload();
          return;
        }
        cleanup = unload;
        if (!staging.querySelector(":scope > h1, :scope > .el-h1 h1")) {
          const heading = target.ownerDocument.createElement("h1");
          heading.textContent = essay.title;
          heading.dir = "auto";
          staging.prepend(heading);
        }
        target.replaceChildren(staging);
        staging.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
          input.disabled = true;
        });
        if (cardRef.current) await waitForAssets(cardRef.current);
        if (!cancelled) {
          setRenderedEssay(essay);
          setRenderState("ready");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "正文渲染失败。");
          setRenderState("error");
        }
      });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [essay, bridge]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || renderState !== "ready") return;
    let cancelled = false;
    let frame: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      clearTimeout(frame);
      frame = setTimeout(() => {
        if (cancelled) return;
        try {
          setReport(compileCard(card));
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "排版检查失败。");
          setRenderState("error");
        }
      }, 16);
    };
    const resize = new ResizeObserver(measure);
    const mutation = new MutationObserver(measure);
    resize.observe(card);
    const region = card.querySelector(".os-body-region");
    const body = card.querySelector(".os-markdown");
    if (region) resize.observe(region);
    if (body) resize.observe(body);
    mutation.observe(card, { childList: true, subtree: true, characterData: true });
    card.addEventListener("load", measure, true);
    void card.ownerDocument.fonts.ready.then(() => {
      if (!cancelled) measure();
    });
    measure();
    return () => {
      cancelled = true;
      clearTimeout(frame);
      resize.disconnect();
      mutation.disconnect();
      card.removeEventListener("load", measure, true);
    };
  }, [renderState, essay?.markdown, essay?.path]);

  const metrics = report?.metrics ?? null;
  const overflowing = report ? !fits(report.metrics) || report.errors.length > 0 : false;
  const verticalOverflow = metrics !== null && metrics.overflow > 1;
  const horizontalOverflow = metrics !== null && metrics.horizontalOverflow > 1;
  const exportReady =
    renderState === "ready" &&
    metrics !== null &&
    !overflowing &&
    !busy &&
    renderedEssay === essay &&
    !!essay?.markdown.trim();

  async function exportImage() {
    const card = cardRef.current;
    if (!card || !essay || !exportReady) return;
    setBusy(true);
    setMessage("");
    try {
      const blob = await captureCard(card);
      const path = await bridge.savePng(blob, essay.title);
      try {
        await bridge.copyPng(blob);
        setMessage("PNG 已保存并复制到剪贴板");
        bridge.notify("One Screen：图片已保存到 " + path + "，并已复制到剪贴板");
      } catch (reason) {
        const copyError = reason instanceof Error ? reason.message : "复制到剪贴板失败。";
        setMessage("PNG 已保存，但" + copyError);
        bridge.notify("One Screen：图片已保存到 " + path + "，但" + copyError);
      }
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : "导出失败，请重试。";
      setMessage(text);
      bridge.notify(text);
    } finally {
      setBusy(false);
    }
  }

  const status =
    renderState === "loading"
      ? "正在排版…"
      : renderState === "error"
        ? error
        : overflowing
          ? verticalOverflow
            ? "超出约 " + metrics?.extraLines + " 行"
            : (report?.errors[0] ?? "排版需要调整")
          : metrics
            ? "一屏内"
            : "正在测量…";
  const overflowDetails = metrics
    ? [
        verticalOverflow ? "高度超出 " + Math.ceil(metrics.overflow) + " px" : "",
        verticalOverflow && horizontalOverflow
          ? "宽度超出 " + Math.ceil(metrics.horizontalOverflow) + " px"
          : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const details = [
    overflowDetails,
    verticalOverflow ? "已使用紧凑排版，请精简文字后导出。正文保持 17 px，不会裁切。" : "",
    ...(report?.notes ?? []),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="os-workspace">
      <header className="os-toolbar">
        <div className="os-title">
          <strong>One Screen</strong>
          <span title={essay?.path}>{essay?.title ?? "单屏短文"}</span>
        </div>
        <button
          className="os-export-button"
          disabled={!exportReady}
          onClick={() => {
            void exportImage();
          }}
        >
          {busy ? "生成中…" : "导出 PNG"}
        </button>
      </header>
      {essay ? (
        <>
          <div
            className={"os-fit-status" + (overflowing ? " is-overflow" : "")}
            role="status"
            aria-label="单屏容量"
          >
            <div className="os-fit-heading">
              <strong>{status}</strong>
              {metrics && renderState === "ready" ? <span>已用 {metrics.percent}%</span> : null}
            </div>
            {details ? <p className="os-fit-details">{details}</p> : null}
            {metrics && renderState === "ready" ? (
              <div className="os-fit-track" aria-hidden="true">
                <div style={{ width: Math.min(100, metrics.percent) + "%" }} />
              </div>
            ) : null}
          </div>
          <div className="os-preview-tools">
            <span>
              {CARD.device} · {report ? DENSITY_LABELS[report.density] : "17 px 正文"}
            </span>
            <button
              type="button"
              aria-pressed={actualSize}
              onClick={() => setActualSize((current) => !current)}
            >
              {actualSize ? "适应宽度" : "实际大小"}
            </button>
          </div>
          <div className="os-stage" ref={stageRef}>
            <div
              className="os-card-shell"
              style={{ width: CARD.width * scale, height: CARD.height * scale }}
            >
              <article
                ref={cardRef}
                className={"os-card" + (overflowing ? " os-card-overflow" : "")}
                style={{
                  width: CARD.width,
                  height: CARD.height,
                  transform: "scale(" + scale + ")",
                }}
                aria-label="单屏文章预览"
              >
                <div className="os-body-region" ref={bodyRef} />
              </article>
            </div>
          </div>
          <footer className="os-status" aria-live="polite">
            <span>
              {message ||
                `${CARD.width} × ${CARD.height} · PNG ${CARD.width * CARD.exportScale} × ${CARD.height * CARD.exportScale}`}
            </span>
          </footer>
        </>
      ) : (
        <div className="os-empty">打开 Markdown 笔记开始写作。</div>
      )}
    </div>
  );
}
