# AGENTS.md

本地 Markdown 预览器：同一套 React 界面跑两种形态——网页版（Vite 静态站）与桌面版（Electron 壳，`pnpm dist` 打包）。纯本地、不联网、无遥测，文档与代码注释均为中文，新写的注释与文档请保持中文。

## 常用命令

包管理器用 **pnpm**。没有测试框架，验证手段只有两个：类型检查 + CDP 浏览器断言。

```bash
pnpm dev            # 网页版开发服务器，固定 http://localhost:5180（strictPort）
pnpm build          # tsc --noEmit + vite build → dist/（构建即校验）
pnpm typecheck      # 仅类型检查
pnpm test           # vitest 单元测试（tests/，纯函数：搜索/分块/同步/路径）
pnpm desktop        # pnpm build && electron .（加载 dist/ 产物）
pnpm dist           # 打包桌面版到 release/MarkdownPreview/（不用 electron-builder，见 scripts/package-desktop.mjs）
pnpm scan           # tools/scan-secrets.mjs，开源前敏感信息扫描
node tools/shot.mjs <url> out.png <w> <h> "<js表达式>"   # CDP 截图 + DOM 断言 + 控制台错误收集
```

桌面版连开发服务器：`MDP_DEV_URL=http://localhost:5180 electron .`（或 `pnpm desktop:dev`）。

## 必读文档

改代码前先读 [docs/04-implementation/实现说明.md](docs/04-implementation/实现说明.md)：目录结构、模块职责表、`Library`/`Tab` 接口契约、**第 5 节踩坑记录**（15 条实测坑，多数有对应代码防御）。想理解选型看 `docs/03-design/`，桌面版看 `docs/06-desktop/`。

## 架构边界

- `src/lib/` — 纯逻辑层：不碰 React、不碰样式、不做 DOM 增强。`markdown.ts` 只做 文本→安全 HTML；`scrollSync.ts` 只做行↔像素换算的纯函数。
- `src/components/` — 界面层：不读文件、不解析 Markdown。`DocumentView.tsx` 按固定顺序做后置增强（复制按钮→相对图片→Mermaid→KaTeX→大纲）。
- `App.tsx` — 只做状态编排（标签页、监听、事件），不写业务算法。
- 文件来源统一收敛为 `types.ts` 的 `Library` 接口，两套实现：`lib/files.ts`（浏览器 File System Access API）与 `lib/desktop.ts`（Electron IPC）。`Tab` 自带 lib 闭包，换目录后旧标签仍可用；**换库必须 `dispose()`**，否则 blob URL 泄漏。
- 库内相对路径永远用 `/` 分隔，桌面层在 `lib/desktop.ts` 内自行转换 `\`。

## Electron 桌面版

- `electron/main.cjs`（窗口、IPC、命令行参数、单实例）+ `preload.cjs`（把有限文件能力挂到 `window.desktop`）。渲染进程 `contextIsolation: true`、`nodeIntegration: false`，**不要**在渲染进程直接用 Node API，一切文件操作走 `desktopBridge`。
- 打包不走 electron-builder：把 `node_modules/electron/dist` 复制过去、界面放 `resources/app` 即可（`scripts/package-desktop.mjs`）。
- **pnpm 10 默认跳过构建脚本**：装完依赖要手动 `node node_modules/electron/install.js` 装 Electron 二进制。
- 调试脚本 spawn Electron 前必须删掉 `ELECTRON_RUN_AS_NODE=1`，否则进程直接退出。

## 安全与渲染约定

- 渲染结果过 DOMPurify 白名单净化；脚本、内联 style、危险协议全部拦截。表格对齐已从内联 style 搬成 class，新增 Markdown 插件时注意别引入 `style` 属性。
- `ALLOW_DATA_ATTR: true`（行号与公式占位需要）；`blob:` 图片不能过净化，要在挂载后改 `img.src`。
- Mermaid、KaTeX、highlight.js 均**动态 import**，不进首屏包；不得引入任何远程资源/字体/遥测，保持完全离线可用。
- markdown-it 的 highlight 回调必须返回以 `<pre` 开头的整段字符串，否则会被再包一层 `<pre><code>`。

## 已知平台限制（改功能前对照）

- 拖拽/粘贴打开的标签不进会话，刷新后消失；Safari/Firefox 无目录授权（监听、保存不可用）；单文件模式无目录上下文，相对图片解析不了。
- 文件监听间隔 `App.tsx` 的 `WATCH_INTERVAL` 不要低于 500 ms；滚动同步的 120 ms 驱动锁防双向弹跳。
- 未启用 React StrictMode（Mermaid 会因重复 id 报错）；要开需先给相关 effect 加幂等保护。
