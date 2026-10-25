/**
 * 大文档分块：把渲染完成的整篇 HTML 按 h2 边界切成若干块，
 * 界面层先挂载首块，再逐帧挂载后续块，让极端大文档先出首屏。
 *
 * 小文档（节点数不超阈值）不分块，直接返回原 HTML，行为与过去完全一致。
 * 切分只在 DOMParser 里做，不碰真实 DOM；返回的仍是净化后的 HTML 片段。
 */

export const CHUNK_NODE_THRESHOLD = 4000
export const CHUNK_NODE_BUDGET = 1200
/** 新块的最小体量：小于它的 h2 不值得切块，避免碎片化 */
export const CHUNK_MIN_NODES = 400

export interface ChunkPlan {
  /** false 时 chunks 只有一个元素，内容与输入相同 */
  chunked: boolean
  chunks: string[]
}

function countNodes(root: Element): number {
  return root.getElementsByTagName('*').length + 1
}

export function splitIntoChunks(html: string): ChunkPlan {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html')
  const children = Array.from(doc.body.children)
  if (children.length === 0) return { chunked: false, chunks: [html] }

  const total = countNodes(doc.body)
  if (total <= CHUNK_NODE_THRESHOLD) return { chunked: false, chunks: [html] }

  const serialize = (elements: Element[]) =>
    elements.map((element) => element.outerHTML).join('\n')

  const chunks: string[] = []
  let current: Element[] = []
  let currentNodes = 0

  const flush = () => {
    if (current.length > 0) chunks.push(serialize(current))
    current = []
    currentNodes = 0
  }

  for (const element of children) {
    const nodes = countNodes(element)
    const isBoundary = element.tagName === 'H2' && currentNodes >= CHUNK_MIN_NODES

    if (isBoundary) flush()
    current.push(element)
    currentNodes += nodes

    // 单个超巨元素（一张巨大的表格、一个超长代码块）独占一块
    if (currentNodes >= CHUNK_NODE_BUDGET) flush()
  }
  flush()

  return { chunked: true, chunks }
}
