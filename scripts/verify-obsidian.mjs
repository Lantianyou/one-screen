import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cli = process.env.OBSIDIAN_CLI ?? "/Applications/Obsidian.app/Contents/MacOS/Obsidian";
function evaluate(expression) {
  const output = execFileSync(cli, ["eval", "code=JSON.stringify(" + expression + ")"], {
    encoding: "utf8",
  });
  const result = output.split("=> ")[1];
  if (!result) throw new Error("Obsidian returned no result: " + output);
  return JSON.parse(result);
}
const original = evaluate('app.plugins.plugins["one-screen"].store.getSnapshot()');
assert.ok(original, "Open a Markdown note and its One Screen preview before verifying.");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fence = String.fromCharCode(96).repeat(3);
const cases = [
  {
    name: "filename title",
    title: "文件名标题",
    markdown: "回归测试正文。",
    expected: "文件名标题",
    headings: 1,
  },
  {
    name: "existing H1",
    title: "文件名标题",
    markdown: "# 正文标题\n\n回归测试正文。",
    expected: "正文标题",
    headings: 1,
  },
  {
    name: "Setext title",
    title: "文件名标题",
    markdown: "正文标题\n===\n\n回归测试正文。",
    expected: "正文标题",
    headings: 1,
  },
  {
    name: "literal filename",
    title: "<标题 & 内容>",
    markdown: "回归测试正文。",
    expected: "<标题 & 内容>",
    headings: 1,
  },
  {
    name: "code is not a title",
    title: "文件名标题",
    markdown: fence + "\n# 代码标题\n" + fence + "\n\n回归测试正文。",
    expected: "文件名标题",
    headings: 1,
  },
  {
    name: "quote is not a title",
    title: "文件名标题",
    markdown: "> # 引用标题\n\n回归测试正文。",
    expected: "文件名标题",
    headings: 2,
  },
  {
    name: "Latin names and inline emphasis",
    title: "中英文排版",
    markdown: "Gordon Moore 提出了这个观点。**回归测试正文**，需要保留全部文字与强调。",
    expected: "中英文排版",
    headings: 1,
    names: ["Gordon Moore"],
    body: "Gordon Moore 提出了这个观点。回归测试正文，需要保留全部文字与强调。",
  },
  {
    name: "wide table keeps every cell",
    title: "手机版表格",
    markdown:
      "回归测试正文。\n\n| 名称 | 定义 | 状态 | 备注 |\n| --- | --- | --- | --- |\n| 数据 | 完整保留 | 已完成 | 手机可读 |",
    expected: "手机版表格",
    headings: 1,
    cells: ["数据", "完整保留", "已完成", "手机可读"],
  },
  {
    name: "long code wraps at readable size",
    title: "代码排版",
    markdown: "回归测试正文。\n\n" + fence + "text\n" + "long_code_".repeat(28) + "\n" + fence,
    expected: "代码排版",
    headings: 1,
  },
  {
    name: "footnotes stay readable",
    title: "正文与注释",
    markdown: "回归测试正文，保留来源引用。[^source]\n\n[^source]: 这是来源说明。",
    expected: "正文与注释",
    headings: 1,
    footnotes: true,
  },
  {
    name: "oversized essay is blocked without deleting text",
    title: "超出一屏",
    markdown:
      "回归测试正文。\n\n" + "手机阅读需要清晰的字号与适当的留白。".repeat(120) + "结尾标记。",
    expected: "超出一屏",
    headings: 1,
    ready: false,
    density: "compact",
    marker: "结尾标记。",
  },
  {
    name: "small custom text is blocked",
    title: "字号检查",
    markdown: '回归测试正文。\n\n<span style="font-size:10px">过小的文字。</span>',
    expected: "字号检查",
    headings: 1,
    ready: false,
    status: "低于手机可读字号",
  },
  {
    name: "horizontal overflow is blocked",
    title: "宽度检查",
    markdown: '回归测试正文。\n\n<div style="width:1000px">过宽的内容。</div>',
    expected: "宽度检查",
    headings: 1,
    ready: false,
    status: "超出页面宽度",
  },
  {
    name: "broken images are blocked",
    title: "图片检查",
    markdown: '回归测试正文。\n\n<img src="data:image/png;base64,invalid">',
    expected: "图片检查",
    headings: 1,
    ready: false,
    status: "图片加载失败",
  },
  {
    name: "internally clipped content is blocked",
    title: "完整性检查",
    markdown:
      '回归测试正文。\n\n<div style="height:20px;overflow:hidden">' +
      "全部文字必须保留。".repeat(8) +
      "</div>",
    expected: "完整性检查",
    headings: 1,
    ready: false,
    status: "嵌入内容被截断",
  },
];
function state() {
  return evaluate(`(() => {
    const card = document.querySelector('.os-card');
    const body = card?.querySelector('.os-markdown');
    const heading = body?.querySelector('h1');
    return {
      text:body?.textContent, title:heading?.textContent,
      headings:body?.querySelectorAll('h1').length,
      ready:!document.querySelector('.os-export-button')?.disabled,
      prepared:body?.dataset.prepared === 'true',
      status:document.querySelector('.os-fit-status')?.textContent,
      font:body && getComputedStyle(body).fontSize,
      leading:body && Number.parseFloat(getComputedStyle(body).lineHeight),
      titleFont:heading && getComputedStyle(heading).fontSize,
      width:card?.style.width, height:card?.style.height,
      density:card?.dataset.density,
      names:Array.from(body?.querySelectorAll('.os-nowrap') ?? [], node => node.textContent),
      cells:Array.from(body?.querySelectorAll('.os-table-stack dd') ?? [], node => node.textContent),
      footnoteFont:body?.querySelector('.footnotes') && getComputedStyle(body.querySelector('.footnotes')).fontSize
    };
  })()`);
}
async function settle(marker = "回归测试正文") {
  let result;
  for (let i = 0; i < 120; i++) {
    await delay(50);
    result = state();
    if (
      result.text?.includes(marker) &&
      ((result.prepared && !result.status.includes("正在")) ||
        result.status.includes("图片加载失败"))
    )
      return result;
  }
  throw new Error("Preview did not settle: " + JSON.stringify(result));
}
try {
  for (const fixture of cases) {
    const essay = {
      path: original?.path ?? "One Screen 示例.md",
      title: fixture.title,
      markdown: fixture.markdown,
    };
    evaluate(
      '(app.plugins.plugins["one-screen"].store.setDocument(' + JSON.stringify(essay) + "), true)",
    );
    const result = await settle();
    assert.equal(result.title, fixture.expected, fixture.name);
    assert.equal(result.headings, fixture.headings, fixture.name + " must not duplicate the title");
    assert.equal(result.ready, fixture.ready ?? true, fixture.name + " export availability");
    assert.equal(result.font, "17px", fixture.name + " body must stay readable");
    assert.equal(result.titleFont, "30px", fixture.name + " title hierarchy");
    assert.equal(result.width, "402px");
    assert.equal(result.height, "874px");
    if (fixture.names) assert.deepEqual(result.names, fixture.names);
    if (fixture.cells) assert.deepEqual(result.cells, fixture.cells);
    if (fixture.body)
      assert.ok(result.text.includes(fixture.body), "inline text must be preserved");
    if (fixture.density) assert.equal(result.density, fixture.density);
    if (fixture.marker)
      assert.ok(result.text.includes(fixture.marker), "overflow must not remove text");
    if (fixture.status)
      assert.ok(result.status.includes(fixture.status), fixture.name + ": " + result.status);
    if (fixture.footnotes) assert.equal(result.footnoteFont, "14px");
    assert.equal(
      evaluate('app.plugins.plugins["one-screen"].store.getSnapshot().markdown'),
      fixture.markdown,
    );
    console.log("PASS " + fixture.name);
  }

  const densities = new Set();
  for (let repeats = 24; repeats <= 36 && densities.size < 3; repeats++) {
    const essay = {
      path: original.path,
      title: "自动排版",
      markdown: "回归测试正文。" + "手机阅读需要清晰的字号与适当的留白。".repeat(repeats),
    };
    evaluate(
      '(app.plugins.plugins["one-screen"].store.setDocument(' + JSON.stringify(essay) + "), true)",
    );
    const result = await settle();
    if (!result.ready) continue;
    assert.equal(result.font, "17px", "spacing adaptation must never shrink the body");
    const leading = { comfortable: 1.65, balanced: 1.6, compact: 1.55 }[result.density];
    assert.ok(Math.abs(result.leading - 17 * leading) < 0.05);
    densities.add(result.density);
  }
  assert.deepEqual(
    [...densities].toSorted((a, b) => a.localeCompare(b)),
    ["balanced", "comfortable", "compact"],
  );
  console.log("PASS all three spacing densities fit without reducing the font size");

  const example = {
    path: original?.path ?? "One Screen 示例.md",
    title: "一屏短文",
    markdown: readFileSync(new URL("../examples/一屏短文.md", import.meta.url), "utf8"),
  };
  evaluate(
    '(app.plugins.plugins["one-screen"].store.setDocument(' + JSON.stringify(example) + "), true)",
  );
  const result = await settle("写一篇短文");
  assert.equal(result.ready, true, "example should fit a single readable screen");
  assert.equal(result.density, "comfortable", "short essays use the most spacious layout");

  // Exercise the real export without creating test attachments in the vault.
  evaluate(`(() => {
    const plugin = app.plugins.plugins['one-screen'];
    window.__oneScreenSave = plugin.savePng;
    window.__oneScreenExport = null;
    plugin.savePng = async blob => {
      const bytes = await blob.arrayBuffer();
      const header = new DataView(bytes);
      const width = header.getUint32(16);
      const height = header.getUint32(20);
      require('fs').writeFileSync('/tmp/one-screen-iphone18pro.png', Buffer.from(bytes));
      window.__oneScreenExport = {width, height};
      return '/tmp/one-screen-iphone18pro.png';
    };
    document.querySelector('.os-export-button').click();
    return true;
  })()`);
  let exported;
  for (let i = 0; i < 200; i++) {
    await delay(50);
    exported = evaluate("window.__oneScreenExport");
    if (exported) break;
  }
  assert.deepEqual(exported, { width: 1206, height: 2622 }, "real PNG must match the phone screen");
  console.log("PASS single-screen PNG export (1206 × 2622)");
} finally {
  evaluate(`(() => {
    if (window.__oneScreenSave) app.plugins.plugins['one-screen'].savePng = window.__oneScreenSave;
    delete window.__oneScreenSave;
    delete window.__oneScreenExport;
    return true;
  })()`);
  evaluate(
    '(app.plugins.plugins["one-screen"].store.setDocument(' + JSON.stringify(original) + "), true)",
  );
}
