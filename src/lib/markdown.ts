import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import DOMPurify, { type Config } from 'dompurify'
import { highlightCode, isHighlightable } from './highlight'

const EXTERNAL_LINK = /^(https?:)?\/\//i

/** 标题锚点：保留中文，去掉标点，空格转连字符 */
export function slugify(text: string): string {
  const trimmed = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-')
  return trimmed || 'section'
}

const md: InstanceType<typeof MarkdownIt> = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  breaks: false,
  highlight(code, lang) {
    const language = (lang || '').trim().toLowerCase()
    const escaped = md.utils.escapeHtml(code)

    // Mermaid 先原样占位，等 React 挂载后再异步渲染成 SVG
    if (language === 'mermaid') {
      return `<pre class="mermaid-src"><code>${escaped}</code></pre>`
    }

    if (language && isHighlightable(language)) {
      const highlighted = highlightCode(code, language)
      if (highlighted) {
        return `<pre class="hljs" data-lang="${md.utils.escapeHtml(language)}"><code>${highlighted}</code></pre>`
      }
    }

    return `<pre class="hljs" data-lang="${language || 'text'}"><code>${escaped}</code></pre>`
  },
})

md.use(footnote)
md.use(taskLists, { enabled: false, label: false })
md.use(anchor, { slugify })

// 表格外面包一层，窄屏可以横向滚动而不撑破正文
md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n'
md.renderer.rules.table_close = () => '</table></div>\n'

// 表格对齐：markdown-it 用内联 style 表达对齐，这里换成 class，
// 这样净化策略就可以直接禁掉 style 属性，不用为对齐开例外
type AlignableToken = {
  attrs: Array<[string, string | number]> | null
  attrIndex(name: string): number
  attrJoin(name: string, value: string): void
}

function rewriteAlign(token: AlignableToken): void {
  const style = String(token.attrs?.find(([name]) => name === 'style')?.[1] ?? '')
  const align = /center/i.test(style) ? 'center' : /right/i.test(style) ? 'right' : /left/i.test(style) ? 'left' : ''
  if (align) token.attrJoin('class', `align-${align}`)
  const index = token.attrIndex('style')
  if (index >= 0 && token.attrs) token.attrs.splice(index, 1)
}

const baseThOpen =
  md.renderer.rules.th_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.th_open = (tokens, idx, options, env, self) => {
  rewriteAlign(tokens[idx])
  return baseThOpen(tokens, idx, options, env, self)
}

const baseTdOpen =
  md.renderer.rules.td_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.td_open = (tokens, idx, options, env, self) => {
  rewriteAlign(tokens[idx])
  return baseTdOpen(tokens, idx, options, env, self)
}

// 站外链接新开窗口，并补上 rel；站内锚点保持默认行为
const baseLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = String(tokens[idx].attrGet('href') ?? '')
  if (EXTERNAL_LINK.test(href)) {
    tokens[idx].attrSet('target', '_blank')
    tokens[idx].attrSet('rel', 'noopener noreferrer')
  }
  return baseLinkOpen(tokens, idx, options, env, self)
}

const baseImage =
  md.renderer.rules.image ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.image = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('loading', 'lazy')
  return baseImage(tokens, idx, options, env, self)
}

/* ------------------------------------------------------------------ */
/* 源码行号：给块级元素打上 data-line，供双栏滚动同步使用                */
/* ------------------------------------------------------------------ */

const CONTAINER_TOKENS = new Set([
  'heading_open',
  'paragraph_open',
  'blockquote_open',
  'bullet_list_open',
  'ordered_list_open',
  'list_item_open',
  'table_open',
])

md.core.ruler.push('source_line_map', (state) => {
  for (const token of state.tokens) {
    if (!token.map) continue
    if (token.nesting !== 1) continue
    if (!CONTAINER_TOKENS.has(token.type)) continue
    token.attrSet('data-line', String(token.map[0]))
  }
})

// 代码块由 highlight 直接返回 <pre>，属性会被忽略，这里补一次 data-line
const baseFence = md.renderer.rules.fence
if (baseFence) {
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const html = baseFence(tokens, idx, options, env, self)
    const line = tokens[idx].map?.[0]
    if (line === undefined || !html.startsWith('<pre')) return html
    return html.replace('<pre ', `<pre data-line="${line}" `)
  }
}

/* ------------------------------------------------------------------ */
/* 公式：先输出占位，挂载后再由 KaTeX 渲染（KaTeX 不进首屏）             */
/* ------------------------------------------------------------------ */

const encodeTex = (tex: string) => encodeURIComponent(tex)

function mathBlockRule(
  state: { bMarks: number[]; eMarks: number[]; tShift: number[]; src: string; line: number; push: (type: string, tag: string, nesting: number) => MathToken },
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  const begin = state.bMarks[startLine] + state.tShift[startLine]
  const max = state.eMarks[startLine]
  if (begin + 2 > max || state.src.slice(begin, begin + 2) !== '$$') return false
  if (silent) return true

  let next = startLine
  let content = ''
  const firstLine = state.src.slice(begin + 2, max)
  const closedOnFirstLine = firstLine.indexOf('$$')

  if (closedOnFirstLine >= 0) {
    content = firstLine.slice(0, closedOnFirstLine)
  } else {
    content = firstLine
    let closed = false
    for (next = startLine + 1; next < endLine; next += 1) {
      const lineStart = state.bMarks[next] + state.tShift[next]
      const lineEnd = state.eMarks[next]
      const line = state.src.slice(lineStart, lineEnd)
      const closeAt = line.indexOf('$$')
      if (closeAt >= 0) {
        content += `\n${line.slice(0, closeAt)}`
        closed = true
        break
      }
      content += `\n${line}`
    }
    if (!closed) return false
  }

  state.line = next + 1
  const token = state.push('math_block', 'div', 0)
  token.map = [startLine, next + 1]
  token.content = content.trim()
  return true
}

function mathInlineRule(
  state: { src: string; pos: number; posMax: number; push: (type: string, tag: string, nesting: number) => MathToken },
  silent: boolean,
): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x24) return false
  if (state.src.charCodeAt(state.pos + 1) === 0x24) return false

  const start = state.pos + 1
  if (start >= state.posMax) return false
  const first = state.src.charCodeAt(start)
  // $ 后面紧跟空格不当作公式开头，避免把「$5 和 $6」这类金额吃掉
  if (first === 0x20 || first === 0x09 || first === 0x0a) return false

  let pos = start
  let found = -1
  while (pos < state.posMax) {
    const code = state.src.charCodeAt(pos)
    if (code === 0x5c) {
      pos += 2
      continue
    }
    if (code === 0x0a) return false
    if (code === 0x24) {
      found = pos
      break
    }
    pos += 1
  }
  if (found < 0 || found === start) return false
  if (state.src.charCodeAt(found - 1) === 0x20) return false
  // 收尾的 $ 后面紧跟数字，多半是「$5 … $6」这类金额，不当公式
  const after = state.src.charCodeAt(found + 1)
  if (after >= 0x30 && after <= 0x39) return false

  const content = state.src.slice(start, found)
  // 反引号出现说明这一段其实跨进了代码区，放弃，交给代码规则处理
  if (content.includes('`')) return false

  if (!silent) {
    const token = state.push('math_inline', 'span', 0)
    token.content = content
  }
  state.pos = found + 1
  return true
}

type MathToken = {
  content: string
  map?: [number, number]
  block?: boolean
}

md.block.ruler.before('fence', 'math_block', mathBlockRule as never, {
  alt: ['paragraph', 'reference', 'blockquote', 'list'],
})
md.inline.ruler.before('emphasis', 'math_inline', mathInlineRule as never)

md.renderer.rules.math_inline = (tokens, idx) =>
  `<span class="math-inline" data-tex="${encodeTex(tokens[idx].content)}"></span>`

md.renderer.rules.math_block = (tokens, idx) =>
  `<div class="math-block" data-tex="${encodeTex(tokens[idx].content)}"></div>\n`

/**
 * 净化白名单：允许常见排版标签与属性，禁止脚本、样式表、表单与外链 iframe。
 * 原始 HTML 是「先渲染再净化」，而不是整体转义，所以 <details>、<kbd> 这类能正常显示。
 */
const PURIFY_CONFIG: Config = {
  ADD_ATTR: ['target', 'rel', 'align', 'colspan', 'rowspan', 'start', 'checked', 'disabled', 'type', 'loading'],
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'base'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
  // 需要放行 data-*：data-line 用于滚动同步，data-tex 用于公式占位
  ALLOW_DATA_ATTR: true,
}

/** Markdown 文本 → 可安全插入 DOM 的 HTML */
export function renderMarkdown(source: string): string {
  try {
    const raw = md.render(source)
    return DOMPurify.sanitize(raw, PURIFY_CONFIG) as unknown as string
  } catch {
    // 解析或净化异常时退化为纯文本，保证「总能看到内容」
    return `<pre class="raw-fallback"><code>${md.utils.escapeHtml(source)}</code></pre>`
  }
}

/** 统计正文规模，用于状态栏展示 */
export function countWords(source: string): number {
  const cjk = source.match(/[\u4e00-\u9fa5]/g)?.length ?? 0
  const latin = source.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9_'-]+/g)?.length ?? 0
  return cjk + latin
}
