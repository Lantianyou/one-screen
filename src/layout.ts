import { CARD, DENSITIES, assessFit, fits, type Density, type FitMetrics } from "./model";

export interface LayoutReport {
  metrics: FitMetrics;
  density: Density;
  errors: string[];
  notes: string[];
}

function textNodes(element: HTMLElement): Text[] {
  const walker = element.ownerDocument.createTreeWalker(element, 4);
  const result: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    result.push(node as Text);
    node = walker.nextNode();
  }
  return result;
}

function keepNamesTogether(body: HTMLElement) {
  for (const node of textNodes(body)) {
    if (node.parentElement?.closest("pre, code, .math, .katex, .os-nowrap")) continue;
    // Short Latin names stay together; long phrases retain normal wrapping.
    const matches = [...node.data.matchAll(/\b[A-Z][a-z]+(?: [A-Z][a-z]+){1,2}\b/g)].filter(
      (match) => match[0].length <= 24,
    );
    if (!matches.length) continue;
    const fragment = body.ownerDocument.createDocumentFragment();
    let offset = 0;
    for (const match of matches) {
      fragment.append(node.data.slice(offset, match.index));
      const span = body.ownerDocument.createElement("span");
      span.className = "os-nowrap";
      span.textContent = match[0];
      fragment.append(span);
      offset = match.index + match[0].length;
    }
    fragment.append(node.data.slice(offset));
    node.replaceWith(fragment);
  }
}

function stackWideTables(body: HTMLElement): number {
  let converted = 0;
  for (const table of body.querySelectorAll<HTMLTableElement>("table")) {
    const heading = table.tHead?.rows[0];
    if (!heading || heading.cells.length < 4) continue;
    // Preserve merged-cell relationships in complex tables.
    if (
      Array.from(table.querySelectorAll("th, td")).some(
        (cell) =>
          Number(cell.getAttribute("colspan") ?? 1) > 1 ||
          Number(cell.getAttribute("rowspan") ?? 1) > 1,
      )
    )
      continue;
    const stack = body.ownerDocument.createElement("div");
    stack.className = "os-table-stack";
    if (table.caption) stack.append(table.caption.cloneNode(true));
    for (const row of Array.from(table.tBodies).flatMap((section) => Array.from(section.rows))) {
      const record = body.ownerDocument.createElement("dl");
      for (const [index, cell] of Array.from(row.cells).entries()) {
        const label = body.ownerDocument.createElement("dt");
        label.append(
          ...Array.from(heading.cells[index]?.childNodes ?? [], (node) => node.cloneNode(true)),
        );
        const value = body.ownerDocument.createElement("dd");
        value.append(...Array.from(cell.childNodes, (node) => node.cloneNode(true)));
        record.append(label, value);
      }
      stack.append(record);
    }
    if (!stack.querySelector("dl")) continue;
    table.replaceWith(stack);
    converted++;
  }
  return converted;
}

function textPoint(nodes: Text[], offset: number): [Text, number] | null {
  for (const node of nodes) {
    if (offset <= node.length) return [node, offset];
    offset -= node.length;
  }
  return null;
}

function keepParagraphTailsTogether(body: HTMLElement) {
  for (const paragraph of body.querySelectorAll<HTMLParagraphElement>("p")) {
    if (paragraph.querySelector(".os-keep-tail, code, .math, .katex, .footnote-ref")) continue;
    const nodes = textNodes(paragraph);
    const text = nodes
      .map((node) => node.data)
      .join("")
      .trimEnd();
    const tail = text.match(/[\p{Script=Han}\p{Punctuation}]{6}$/u)?.[0];
    if (!tail || !/\p{Script=Han}/u.test(tail)) continue;
    const range = body.ownerDocument.createRange();
    const positions: number[] = [];
    let tolerance = 0.25;
    for (let index = text.length - 1; index >= text.length - tail.length; index--) {
      const start = textPoint(nodes, index);
      const end = textPoint(nodes, index + 1);
      if (!start || !end) continue;
      range.setStart(...start);
      range.setEnd(...end);
      const rect = range.getBoundingClientRect();
      if (rect.height) {
        positions.push(rect.top);
        tolerance = Math.max(0.25, rect.height * 0.15);
      }
    }
    const lastLine = positions.filter((top) => Math.abs(top - positions[0]) < tolerance).length;
    // Repair a 1–3 character last line without changing or dropping any text.
    if (lastLine < 1 || lastLine > 3 || positions.length !== tail.length) continue;
    const start = textPoint(nodes, text.length - tail.length);
    const end = textPoint(nodes, text.length);
    if (!start || !end) continue;
    range.setStart(...start);
    range.setEnd(...end);
    const span = body.ownerDocument.createElement("span");
    span.className = "os-keep-tail";
    span.append(range.extractContents());
    range.insertNode(span);
  }
}

export function measureCard(card: HTMLElement): FitMetrics {
  const region = card.querySelector<HTMLElement>(".os-body-region");
  const body = card.querySelector<HTMLElement>(".os-markdown");
  if (!region || !body) throw new Error("正文还在渲染，请稍候。");
  const styles = card.ownerDocument.defaultView!.getComputedStyle(body);
  return assessFit(
    Math.max(body.scrollHeight, body.offsetHeight),
    region.clientHeight,
    body.scrollWidth,
    region.clientWidth,
    Number.parseFloat(styles.lineHeight),
  );
}

export function validateCard(card: HTMLElement): string[] {
  const errors: string[] = [];
  const metrics = measureCard(card);
  if (metrics.overflow > 1) errors.push(`一屏还需减少约 ${metrics.extraLines} 行`);
  if (metrics.horizontalOverflow > 1) errors.push("有内容超出页面宽度，请调整宽表或公式");
  const body = card.querySelector<HTMLElement>(".os-markdown")!;
  const view = card.ownerDocument.defaultView!;
  for (const element of body.querySelectorAll<HTMLElement>("*")) {
    if (element.closest(".katex-mathml") || !element.getClientRects().length) continue;
    const style = view.getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") continue;
    const clippedVertically =
      /hidden|clip|auto|scroll/.test(style.overflowY) &&
      element.scrollHeight > element.clientHeight + 1;
    const clippedHorizontally =
      /hidden|clip|auto|scroll/.test(style.overflowX) &&
      element.scrollWidth > element.clientWidth + 1;
    if (clippedVertically || clippedHorizontally) {
      errors.push("有嵌入内容被截断，请展开内容或移除固定宽高后导出");
      break;
    }
  }
  for (const node of textNodes(body)) {
    const parent = node.parentElement;
    if (!node.data.trim() || !parent || !parent.getClientRects().length) continue;
    if (parent.closest("sup, sub, .math, .katex, .footnote-ref")) continue;
    const style = view.getComputedStyle(parent);
    if (style.visibility === "hidden" || style.display === "none") continue;
    const minimum = parent.closest(".footnotes")
      ? 14
      : parent.closest("pre, code, table, .os-table-stack")
        ? 15
        : CARD.fontSize;
    if (Number.parseFloat(style.fontSize) < minimum - 0.1) {
      errors.push("有文字低于手机可读字号，请移除正文中的自定义小字号");
      break;
    }
  }
  return errors;
}

export function compileCard(card: HTMLElement): LayoutReport {
  const body = card.querySelector<HTMLElement>(".os-markdown");
  if (!body) throw new Error("正文还在渲染，请稍候。");
  card.dataset.density = "comfortable";
  card.lang = /\p{Script=Han}/u.test(body.textContent ?? "") ? "zh-CN" : "en";
  let tables = Number(body.dataset.stackedTables ?? 0);
  if (!body.dataset.prepared) {
    keepNamesTogether(body);
    tables = stackWideTables(body);
    keepParagraphTailsTogether(body);
    body.dataset.prepared = "true";
    body.dataset.stackedTables = String(tables);
  }
  let density: Density = "comfortable";
  let metrics = measureCard(card);
  for (const candidate of DENSITIES) {
    density = candidate;
    card.dataset.density = candidate;
    keepParagraphTailsTogether(body);
    metrics = measureCard(card);
    if (fits(metrics)) break;
  }
  return {
    metrics,
    density,
    errors: validateCard(card),
    notes: tables ? ["宽表已转为逐条阅读，保留全部单元格内容"] : [],
  };
}
