import { domToBlob } from "modern-screenshot";
import { CARD, assessFit, fits, type FitMetrics } from "./model";

export function measureCard(card: HTMLElement): FitMetrics {
  const region = card.querySelector<HTMLElement>(".os-body-region");
  const body = card.querySelector<HTMLElement>(".os-markdown");
  if (!region || !body) throw new Error("正文还在渲染，请稍候。");
  return assessFit(body.scrollHeight, region.clientHeight, body.scrollWidth, region.clientWidth);
}

async function waitForImage(image: HTMLImageElement): Promise<void> {
  if (!image.complete) {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        image.removeEventListener("load", loaded);
        image.removeEventListener("error", failed);
      };
      const loaded = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error("有图片加载失败，请检查图片链接。"));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("图片加载超时，请稍后再导出。"));
      }, 10000);
      image.addEventListener("load", loaded, { once: true });
      image.addEventListener("error", failed, { once: true });
    });
  }
  if (!image.naturalWidth) throw new Error("有图片加载失败，请检查图片链接。");
  await image.decode();
}

export async function captureCard(card: HTMLElement): Promise<Blob> {
  const document = card.ownerDocument;
  const clone = card.cloneNode(true) as HTMLElement;
  clone.classList.remove("os-card-overflow");
  clone.style.transform = "none";
  clone.style.boxShadow = "none";
  clone.style.margin = "0";
  const host = document.createElement("div");
  host.className = "os-export-host";
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${CARD.width}px;pointer-events:none;`;
  host.append(clone);
  document.body.append(host);
  try {
    const sourceCanvases = card.querySelectorAll("canvas");
    clone.querySelectorAll("canvas").forEach((canvas, index) => {
      const image = document.createElement("img");
      image.src = sourceCanvases[index].toDataURL();
      image.width = canvas.width;
      image.height = canvas.height;
      canvas.replaceWith(image);
    });
    await document.fonts.ready;
    await Promise.all(Array.from(clone.querySelectorAll("img"), waitForImage));
    const metrics = measureCard(clone);
    if (!fits(metrics)) throw new Error("正文超出卡片，请缩短文字或调整排版后再导出。");
    const blob = await domToBlob(clone, {
      width: CARD.width,
      height: CARD.height,
      scale: CARD.exportScale,
      type: "image/png",
      font: false,
      fetch: {
        placeholderImage: () => {
          throw new Error("图片无法嵌入 PNG，请检查图片链接。");
        },
      },
    });
    if (!blob) throw new Error("生成图片失败，请重试。");
    return blob;
  } finally {
    host.remove();
  }
}
