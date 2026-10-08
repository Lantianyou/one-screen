import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

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
];
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
    let state;
    for (let i = 0; i < 60; i++) {
      await delay(50);
      state = evaluate(
        '({text:document.querySelector(".os-markdown")?.textContent,title:document.querySelector(".os-markdown h1")?.textContent,headings:document.querySelectorAll(".os-markdown h1").length,ready:!document.querySelector(".os-export-button")?.disabled})',
      );
      if (state?.ready && state.text?.includes("回归测试正文")) break;
    }
    assert.equal(state.title, fixture.expected, fixture.name);
    assert.equal(state.headings, fixture.headings, fixture.name + " must not duplicate the title");
    console.log("PASS " + fixture.name);
  }
} finally {
  evaluate(
    '(app.plugins.plugins["one-screen"].store.setDocument(' + JSON.stringify(original) + "), true)",
  );
}
