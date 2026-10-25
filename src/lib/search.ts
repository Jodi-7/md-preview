import type { DocEntry, SearchHit } from '../types'

/**
 * 全文搜索的纯匹配逻辑：不碰 IO、不碰 React。
 * 大小写不敏感、按行匹配；上限保护让极端目录也不会卡住界面。
 */
export const MAX_HITS_PER_DOC = 8
export const MAX_TOTAL_HITS = 200
export const SNIPPET_LENGTH = 160

/** 在一段文本里找所有命中行；行号从 1 起 */
export function matchLines(text: string, query: string, maxHits = MAX_HITS_PER_DOC): { line: number; snippet: string }[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const hits: { line: number; snippet: string }[] = []
  const lines = text.split(/\r?\n/)
  for (const [index, raw] of lines.entries()) {
    if (hits.length >= maxHits) break
    if (!raw.toLowerCase().includes(needle)) continue
    hits.push({ line: index + 1, snippet: clipSnippet(raw, needle) })
  }
  return hits
}

/** 把命中行裁成以命中词居中的展示片段 */
export function clipSnippet(raw: string, needle: string): string {
  const line = raw.trim()
  if (line.length <= SNIPPET_LENGTH) return line

  const at = line.toLowerCase().indexOf(needle)
  const center = at < 0 ? 0 : at
  const start = Math.max(0, center - Math.floor(SNIPPET_LENGTH / 3))
  const end = Math.min(line.length, start + SNIPPET_LENGTH)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < line.length ? '…' : ''
  return `${prefix}${line.slice(start, end)}${suffix}`
}

/**
 * 通用搜索：对一组文档逐个读取并匹配。
 * 读取失败的文件（权限、占用）静默跳过，不中断整体搜索。
 */
export async function searchDocs(
  docs: DocEntry[],
  query: string,
  read: (path: string) => Promise<string>,
): Promise<SearchHit[]> {
  const keyword = query.trim()
  if (!keyword) return []

  const hits: SearchHit[] = []
  for (const doc of docs) {
    if (hits.length >= MAX_TOTAL_HITS) break
    let text: string
    try {
      text = await read(doc.path)
    } catch {
      continue
    }
    for (const { line, snippet } of matchLines(text, keyword)) {
      if (hits.length >= MAX_TOTAL_HITS) break
      hits.push({ path: doc.path, name: doc.name, line, snippet })
    }
  }
  return hits
}
