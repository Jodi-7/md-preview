# Markdown 预览器 · 示例文档

这是一份用来验证渲染效果的示例，覆盖了日常文档里最常出现的语法。
把任意 `.md` 文件拖进窗口，或点左侧的「打开文件 / 打开文件夹」即可替换它。

> 渲染遵循 CommonMark 规范，并启用 GitHub 风格的扩展（表格、任务列表、删除线、自动链接、脚注）。
> 原始 HTML 会在渲染后经过白名单净化，脚本类内容不会执行。

## 快速开始

```bash
pnpm install
pnpm dev        # 打开 http://localhost:5180
pnpm build      # 产出 dist/ 静态文件
```

## 常用语法

### 行内标记

**粗体**、*斜体*、~~删除线~~、`行内代码`、[站外链接](https://commonmark.org)、自动链接 https://spec.commonmark.org ，
以及键盘键 <kbd>Ctrl</kbd> + <kbd>F</kbd>（浏览器自带的页内查找同样可用）。

### 表格

| 能力 | 状态 | 说明 |
| --- | :---: | --- |
| CommonMark 解析 | 已支持 | 官方规范用例全覆盖 |
| GFM 表格与任务列表 | 已支持 | 表头对齐生效 |
| 代码高亮 | 已支持 | 常用语言内置 |
| Mermaid 图表 | 已支持 | 命中时才加载 |
| 公式（KaTeX） | 已支持 | 懒加载，不进首屏 |
| 目录内全文搜索 | 已支持 | 左侧切换到「内容」模式 |

### 任务列表

- [x] 单文件预览
- [x] 整目录浏览
- [x] 大纲与滚动定位
- [x] 文件改动自动刷新

### 代码块

```ts
interface Library {
  rootName: string
  docs: DocEntry[]
  readDoc(path: string): Promise<string>
}

async function open(files: File[]): Promise<Library> {
  const docs = files.filter((f) => /\.md$/.test(f.name))
  return { rootName: '本地文件', docs: [], readDoc: async () => '' }
}
```

未标注语言或用冷门语言时，会自动退化为纯文本，不会报错：

```
没有语言标记的代码块
  缩进与换行都会原样保留
```

### 引用与分隔线

> 阅读模式的排版应该让注意力落在文字上：
> 合适的行宽、足够的行高、克制的颜色。

---

## Mermaid 图表

```mermaid
flowchart LR
  A[拖入文件] --> B{是否有目录}
  B -- 单文件 --> C[读取文本]
  B -- 目录 --> D[扫描 .md]
  D --> C
  C --> E[解析为 HTML]
  E --> F[白名单净化]
  F --> G[渲染预览]
```

## 数学公式

行内公式：质能方程 $E = mc^2$，勾股定理 $a^2 + b^2 = c^2$。

块级公式：

$$
\int_{0}^{\infty} e^{-x^{2}}\,\mathrm{d}x = \frac{\sqrt{\pi}}{2}
$$

价格写法 $5 和 $6 不会被误认成公式——`$` 后面紧跟空格时按普通字符处理。

## 嵌套列表

1. 输入层
   - 拖拽文件或目录
   - 文件选择器
2. 解析层
   - CommonMark 内核
   - GFM 扩展插件
3. 渲染层
   - 代码高亮
   - 大纲联动

## 脚注

Markdown 的规范文本可以在 CommonMark 官网查到[^spec]，GFM 的差异部分见 GitHub 的说明[^gfm]。

[^spec]: CommonMark Spec，<https://spec.commonmark.org>。
[^gfm]: GitHub Flavored Markdown Spec，<https://github.github.com/gfm/>。

## 长段落测试

预览器的价值在于「读得下去」。如果一段文字需要读者的眼睛在行末来回折返，阅读就会变成体力活。
因此正文宽度默认控制在约 720px，行高 1.75 左右，字号 16px；这三项都可以在右上角随时调整。
深色模式不是把颜色反过来那么简单：背景要足够深但不能纯黑，正文对比度要低于纯白，代码块的底色需要比背景略亮一档。

## 结尾

如果这份示例在你的屏幕上显示正常，说明解析、高亮、表格、任务列表、脚注与图表这条链路都是通的。
