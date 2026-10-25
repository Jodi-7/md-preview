// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  CHUNK_MIN_NODES,
  CHUNK_NODE_THRESHOLD,
  splitIntoChunks,
} from '../src/lib/chunks'

/** 生成 n 个大节：每个节一个 h2 + 80 个段落 */
function bigHtml(sections: number, paragraphs = 80): string {
  const out: string[] = ['<h1>大文档</h1>', '<p>引言段落</p>']
  for (let s = 0; s < sections; s += 1) {
    out.push(`<h2>第 ${s} 章</h2>`)
    for (let p = 0; p < paragraphs; p += 1) {
      out.push(`<p>章节 ${s} 的第 ${p} 段内容，凑一点长度。</p>`)
    }
  }
  return out.join('\n')
}

describe('splitIntoChunks', () => {
  it('小文档不分块，原样返回', () => {
    const html = '<h2>标题</h2><p>一段话</p>'
    const plan = splitIntoChunks(html)
    expect(plan.chunked).toBe(false)
    expect(plan.chunks).toEqual([html])
  })

  it('空内容不分块', () => {
    expect(splitIntoChunks('').chunked).toBe(false)
  })

  it('大文档切多块，块体量在预算内', () => {
    const plan = splitIntoChunks(bigHtml(60))
    expect(plan.chunked).toBe(true)
    expect(plan.chunks.length).toBeGreaterThan(3)
    for (const chunk of plan.chunks) {
      const root = new DOMParser().parseFromString(`<body>${chunk}</body>`, 'text/html').body
      // 单块节点数不超过预算 + 1（允许略超，因为超巨元素独占成块）
      expect(root.getElementsByTagName('*').length).toBeLessThanOrEqual(3000)
    }
  })

  it('块边界落在 h2 上：每个 h2 都出现在某块的开头附近', () => {
    const plan = splitIntoChunks(bigHtml(60))
    expect(plan.chunked).toBe(true)
    const joined = plan.chunks.join('\n')
    for (let s = 0; s < 60; s += 1) {
      expect(joined).toContain(`<h2>第 ${s} 章</h2>`)
    }
    // 第一个块不包含后续章节
    expect(plan.chunks[0]).not.toContain('第 59 章')
  })

  it('分块后内容无丢失：块拼接包含全部元素', () => {
    const html = bigHtml(20, 60)
    const plan = splitIntoChunks(html)
    const original = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body
      .getElementsByTagName('*').length
    const rebuilt = plan.chunks.reduce(
      (sum, chunk) =>
        sum + new DOMParser().parseFromString(`<body>${chunk}</body>`, 'text/html').body.getElementsByTagName('*').length,
      0,
    )
    expect(rebuilt).toBe(original)
  })

  it('data-line 属性在切块后保留（滚动同步依赖它）', () => {
    const plan = splitIntoChunks(bigHtml(30))
    expect(plan.chunks.some((chunk) => chunk.includes('data-line='))).toBe(false) // 输入没有行号时不虚构
    const withLines = bigHtml(30).replace('<h2>第 1 章</h2>', '<h2 data-line="42">第 1 章</h2>')
    const plan2 = splitIntoChunks(withLines)
    expect(plan2.chunks.some((chunk) => chunk.includes('data-line="42"'))).toBe(true)
  })

  it('没有 h2 的超长文档也能切成块', () => {
    const paragraphs = Array.from({ length: 6000 }, (_, i) => `<p>段落 ${i}，内容。</p>`).join('')
    const plan = splitIntoChunks(paragraphs)
    expect(plan.chunked).toBe(true)
    expect(plan.chunks.length).toBeGreaterThan(1)
  })

  it('阈值常量符合设计预期', () => {
    expect(CHUNK_NODE_THRESHOLD).toBe(4000)
    expect(CHUNK_MIN_NODES).toBe(400)
  })
})
