# One Screen

一个简单的 Obsidian 插件，用 Markdown 写能装进一张手机截图的短文。排版参考 [Screenshot Essays](https://www.screenshotessays.com/)：白底、无衬线字体、紧凑段落。

打开笔记后，在命令面板运行 **One Screen：打开单屏卡片预览**，或点击左侧的侧栏图标。预览会跟随当前笔记和编辑器里的文字更新。预览上方显示已用容量比例；正文超出一屏时，显示超出约多少行、多少像素，宽度溢出也会单独提示，并暂停导出。

画布按 iPhone 15 Pro 固定为 393 × 852，按 3 倍导出 PNG 为 1179 × 2556，与 [Apple 官方屏幕分辨率](https://support.apple.com/zh-cn/111829)一致。图片保存到当前 vault 的 `attachments/one-screen/`，文件名带时间戳。原始 Markdown 不会被修改。

标题优先使用正文中的一级标题，没有一级标题时显示笔记文件名，和 Obsidian 的内联标题保持一致。标题会计入一屏占用的高度。

## 开发

React 19 + TypeScript + Vite+。Markdown 使用 Obsidian 的原生渲染器，PNG 使用 modern-screenshot。没有服务端，也没有主题或排版设置面板。

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

尺寸与导出路径在 `src/model.ts`，排版在 `src/styles.css`，预览在 `src/Preview.tsx`，Obsidian 集成在 `src/main.tsx`。

插件已加载且预览面板打开时，运行 `pnpm verify:obsidian` 检查文件名标题、已有标题、代码块和引用中的标题。测试只临时替换预览内容，不改写笔记。

## 数据处理

笔记的读取、预览和 PNG 生成都在本地完成。插件没有遥测，也不向服务端上传笔记。笔记中的远程图片或嵌入内容可能由 Obsidian 渲染器或图片导出库通过网络加载。

## 许可证

[MIT](LICENSE)
