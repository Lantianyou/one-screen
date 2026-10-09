# One Screen

一个 Obsidian 插件，把 Markdown 短文排成适合手机阅读的一屏图片。白底、无衬线字体，自动处理标题层级、章节留白与中英文换行。

打开笔记后，在命令面板运行 **One Screen：打开单屏卡片预览**，或点击左侧的侧栏图标。预览会跟随当前笔记和编辑器里的文字更新。预览上方显示已用容量比例；正文超出一屏时，显示超出约多少行、多少像素，宽度溢出也会单独提示，并暂停导出。

画布按 iPhone 18 Pro 固定为 402 × 874，按 3 倍导出 PNG 为 1206 × 2622，与 [Apple 官方屏幕分辨率](https://www.apple.com/iphone-18-pro/specs/)一致。只输出一屏，不生成长图或分页。点击“导出 PNG”后，图片会保存到当前 vault 的 `attachments/one-screen/`，并复制到系统剪贴板；文件名带时间戳。原始 Markdown 不会被修改。

正文保持 17px。排版依次尝试舒展、适中、紧凑三档，行距为 1.45、1.4、1.34，并配合紧凑的段落和标题留白，仅调整排版节奏，不缩小正文，也不删除文字。三档都无法容纳时会提示需要精简的行数，并暂停导出。主标题为 30px，章节标题为 23px；代码和表格为 15px，脚注为 14px。四列及以上的普通表格会改为带列名的逐条阅读布局，保留全部单元格内容。含合并单元格的复杂表格保留原有结构。

预览默认靠上、适应侧栏宽度，可以切换到实际大小检查文字。字体与图片加载完成后才进行排版；导出前再次检查宽高溢出和可读字号，图片加载失败时会提示错误。

标题优先使用正文中的一级标题，没有一级标题时显示笔记文件名，和 Obsidian 的内联标题保持一致。标题会计入一屏占用的高度。

## 开发

React 19 + TypeScript + Vite+。Markdown 使用 Obsidian 的原生渲染器，PNG 使用 modern-screenshot。没有服务端，也没有主题设置面板。

```sh
pnpm install
pnpm check
pnpm test
pnpm build
pnpm install:local "/absolute/path/to/your/vault"
```

构建输出在 `dist/`，包含 Obsidian 所需的 `main.js`、`manifest.json` 和 `styles.css`。在 Obsidian 中启用 One Screen 即可。安装脚本只复制插件文件，不改变其他插件的启用状态。

```sh
pnpm dev
```

此命令监听源码并重新构建。构建后重新运行安装命令，再通过 Obsidian CLI 的 `plugin:reload id=one-screen` 重载插件。

尺寸与导出路径在 `src/model.ts`，排版规则在 `src/styles.css`，自动排版与检查在 `src/layout.ts`，预览在 `src/Preview.tsx`，Obsidian 集成在 `src/main.tsx`。

插件已加载且预览面板打开时，运行 `pnpm verify:obsidian` 检查文件名标题、已有标题、代码块和引用中的标题。测试只临时替换预览内容，不改写笔记。

## 数据处理

笔记的读取、预览和 PNG 生成都在本地完成。插件没有遥测，也不向服务端上传笔记。笔记中的远程图片或嵌入内容可能由 Obsidian 渲染器或图片导出库通过网络加载。

## 许可证

[MIT](LICENSE)
