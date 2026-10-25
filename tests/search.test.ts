import { describe, expect, it } from 'vitest'
import { clipSnippet, matchLines, MAX_HITS_PER_DOC, searchDocs } from '../src/lib/search'

describe('matchLines', () => {
  it('按行返回 1 起的行号', () => {
    const text = '第一行\n命中在这里\n第三行\n又命中一次'
    expect(matchLines(text, '命中')).toEqual([
      { line: 2, snippet: '命中在这里' },
      { line: 4, snippet: '又命中一次' },
    ])
  })

  it('大小写不敏感', () => {
    expect(matchLines('Hello World\nnothing', 'hello world')).toHaveLength(1)
  })

  it('支持中文关键词', () => {
    expect(matchLines('这是一段中文内容\n没有命中', '中文')).toHaveLength(1)
  })

  it('空关键词与无命中都返回空数组', () => {
    expect(matchLines('任意文本', '')).toEqual([])
    expect(matchLines('任意文本', '   ')).toEqual([])
    expect(matchLines('任意文本', '不存在')).toEqual([])
  })

  it('单文件命中数不超过上限', () => {
    const text = Array.from({ length: 20 }, (_, i) => `hit line ${i}`).join('\n')
    const hits = matchLines(text, 'hit')
    expect(hits).toHaveLength(MAX_HITS_PER_DOC)
    expect(hits[0].line).toBe(1)
  })
})

describe('clipSnippet', () => {
  it('短行原样返回（去首尾空白）', () => {
    expect(clipSnippet('  短短一行  ', '行')).toBe('短短一行')
  })

  it('超长行以命中词为中心裁剪，并带省略号', () => {
    const padding = 'x'.repeat(300)
    const raw = `${padding} 目标词 ${padding}`
    const snippet = clipSnippet(raw, '目标词')
    expect(snippet.length).toBeLessThanOrEqual(162)
    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet.endsWith('…')).toBe(true)
    expect(snippet).toContain('目标词')
  })

  it('命中在行首时前面没有省略号', () => {
    const raw = `目标词 ${'y'.repeat(300)}`
    const snippet = clipSnippet(raw, '目标词')
    expect(snippet.startsWith('…')).toBe(false)
    expect(snippet.endsWith('…')).toBe(true)
  })
})

describe('searchDocs', () => {
  const docs = [
    { path: 'a.md', name: 'a.md', dir: '', size: 10, mtime: 0 },
    { path: 'b.md', name: 'b.md', dir: '', size: 10, mtime: 0 },
    { path: 'c.md', name: 'c.md', dir: '', size: 10, mtime: 0 },
  ]

  it('跨文件汇总命中', async () => {
    const contents = new Map([
      ['a.md', '关键词在 a'],
      ['b.md', '没有的东西'],
      ['c.md', 'c 里也有 关键词'],
    ])
    const hits = await searchDocs(docs, '关键词', (path) => {
      const text = contents.get(path)
      if (text === undefined) throw new Error('missing')
      return Promise.resolve(text)
    })
    expect(hits.map((hit) => hit.path)).toEqual(['a.md', 'c.md'])
    expect(hits[0].name).toBe('a.md')
  })

  it('读取失败的文件被跳过，不中断搜索', async () => {
    const hits = await searchDocs(docs, '关键词', (path) => {
      if (path === 'b.md') return Promise.reject(new Error('权限不足'))
      return Promise.resolve(`关键词 @ ${path}`)
    })
    expect(hits).toHaveLength(2)
    expect(hits.map((hit) => hit.path)).toEqual(['a.md', 'c.md'])
  })

  it('空关键词直接返回空', async () => {
    expect(await searchDocs(docs, '', async () => '关键词')).toEqual([])
  })
})
