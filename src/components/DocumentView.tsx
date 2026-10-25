import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Library, OutlineItem } from '../types'
import { loadMermaid } from '../lib/mermaid'
import { loadKatex } from '../lib/katex'
import { splitIntoChunks } from '../lib/chunks'

interface Props {
  html: string
  docPath: string
  library: Library
  fontScale: number
  wide: boolean
  dark: boolean
  onOutline(items: OutlineItem[]): void
  onActiveHeading(id: string): void
}

const HEADING_SELECTOR = 'h1[id], h2[id], h3[id], h4[id]'

export function DocumentView({
  html,
  docPath,
  library,
  fontScale,
  wide,
  dark,
  onOutline,
  onActiveHeading,
}: Props) {
  const articleRef = useRef<HTMLElement>(null)
  const plan = useMemo(() => splitIntoChunks(html), [html])
  // 大文档先挂首块出首屏，其余块逐帧补齐；小文档一次挂完，行为与过去一致
  const [mounted, setMounted] = useState(() => (plan.chunked ? 1 : plan.chunks.length))

  useEffect(() => {
    setMounted(plan.chunked ? 1 : plan.chunks.length)
  }, [plan])

  // 自适应批量补块：两次调度间隔（≈上一块的提交耗时 + 帧等待）超过 120ms 说明
  // 单帧太重，批量减半；低于 60ms 则加 1。文档越大重排越贵，批量会自动收敛。
  const batchRef = useRef(2)
  const lastTickRef = useRef(0)
  useEffect(() => {
    if (mounted >= plan.chunks.length) return
    const now = performance.now()
    if (lastTickRef.current > 0) {
      const gap = now - lastTickRef.current
      if (gap > 120) batchRef.current = Math.max(1, Math.floor(batchRef.current / 2))
      else if (gap < 60) batchRef.current = Math.min(8, batchRef.current + 1)
    }
    lastTickRef.current = now

    let cancelled = false
    const frame = requestAnimationFrame(() => {
      if (cancelled) return
      setMounted(Math.min(mounted + batchRef.current, plan.chunks.length))
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [plan, mounted])

  // 后置增强在「每挂一块」后都要跑一遍；内部各自有幂等保护
  const enhanceKey = `${html}::${mounted}`

  // 代码块复制按钮
  useEffect(() => {
    const root = articleRef.current
    if (!root) return
    const blocks = root.querySelectorAll<HTMLPreElement>('pre.hljs')
    const listeners: Array<() => void> = []

    blocks.forEach((pre) => {
      if (pre.dataset.enhanced === '1') return
      pre.dataset.enhanced = '1'

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'code-copy'
      button.textContent = '复制'

      const onClick = async () => {
        const code = pre.querySelector('code')?.textContent ?? ''
        try {
          await navigator.clipboard.writeText(code)
          button.textContent = '已复制'
        } catch {
          button.textContent = '复制失败'
        }
        window.setTimeout(() => {
          button.textContent = '复制'
        }, 1600)
      }

      button.addEventListener('click', onClick)
      pre.appendChild(button)
      listeners.push(() => button.removeEventListener('click', onClick))
    })

    return () => {
      for (const off of listeners) off()
    }
  }, [enhanceKey])

  // 相对路径图片：解析成 blob URL
  useEffect(() => {
    const root = articleRef.current
    if (!root) return
    let cancelled = false

    root.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      const src = img.getAttribute('src') ?? ''
      if (!src || img.dataset.local === '1') return
      void library.resolveAsset(docPath, src).then((url) => {
        if (cancelled) return
        img.dataset.local = '1'
        if (url) img.src = url
        else img.classList.add('is-missing')
      })
    })

    return () => {
      cancelled = true
    }
  }, [enhanceKey, docPath, library])

  // Mermaid：只有出现图表时才加载渲染器
  useEffect(() => {
    const root = articleRef.current
    if (!root) return
    const blocks = Array.from(root.querySelectorAll<HTMLPreElement>('pre.mermaid-src'))
    if (blocks.length === 0) return

    let cancelled = false
    void (async () => {
      const mermaid = await loadMermaid(dark)
      for (const [index, pre] of blocks.entries()) {
        if (cancelled) return
        const source = pre.textContent ?? ''
        try {
          const result = await mermaid.render(`mermaid-${Date.now()}-${index}`, source)
          if (cancelled) return
          const figure = document.createElement('div')
          figure.className = 'mermaid-figure'
          figure.innerHTML = typeof result === 'string' ? result : result.svg
          pre.replaceWith(figure)
        } catch (error) {
          if (cancelled) return
          const note = document.createElement('div')
          note.className = 'mermaid-error'
          note.textContent = `Mermaid 渲染失败：${(error as Error).message}`
          pre.replaceWith(note)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enhanceKey, dark])

  // 公式：KaTeX 同样按需加载
  useEffect(() => {
    const root = articleRef.current
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.math-inline, .math-block'))
    if (nodes.length === 0) return

    let cancelled = false
    void (async () => {
      const katex = await loadKatex()
      if (cancelled) return
      for (const node of nodes) {
        if (node.dataset.katexDone === '1') continue
        const tex = decodeURIComponent(node.dataset.tex ?? '')
        try {
          katex.render(tex, node, {
            displayMode: node.classList.contains('math-block'),
            throwOnError: false,
            output: 'html',
          })
          node.dataset.katexDone = '1'
        } catch {
          node.textContent = `公式错误：${tex}`
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enhanceKey])

  // 大纲：分块挂载完成后重算，保证大纲完整
  useEffect(() => {
    const root = articleRef.current
    if (!root) return
    const items: OutlineItem[] = Array.from(root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)).map(
      (heading) => ({
        id: heading.id,
        text: heading.textContent?.trim() ?? '',
        level: Number(heading.tagName.slice(1)),
      }),
    )
    onOutline(items)
  }, [enhanceKey, onOutline])

  // 滚动联动：取当前视口内最靠上的标题
  useEffect(() => {
    const root = articleRef.current
    if (!root) return
    const scroller = root.closest('.content')
    const headings = Array.from(root.querySelectorAll<HTMLElement>(HEADING_SELECTOR))
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) onActiveHeading(visible[0].target.id)
      },
      { root: scroller, rootMargin: '-16px 0px -68% 0px', threshold: 0 },
    )

    headings.forEach((heading) => observer.observe(heading))
    return () => observer.disconnect()
  }, [enhanceKey, onActiveHeading])

  const style = { '--doc-scale': String(fontScale) } as CSSProperties

  return (
    <article ref={articleRef} className={`md${wide ? ' is-wide' : ''}`} style={style}>
      <div className="md-body">
        {plan.chunks.slice(0, mounted).map((chunk, index) => (
          <div key={index} className="md-chunk" dangerouslySetInnerHTML={{ __html: chunk }} />
        ))}
      </div>
    </article>
  )
}
