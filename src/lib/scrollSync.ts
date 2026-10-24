/** 预览区对齐时的顶部留白，避免目标行被顶到看不见的位置 */
const TOP_GAP = 12

/** 从镜像元素量出每一行源码的纵向位置 */
export function measureLineOffsets(mirror: HTMLElement | null, paddingTop: number): number[] {
  if (!mirror) return []
  return Array.from(mirror.children).map((node) => (node as HTMLElement).offsetTop + paddingTop)
}

/** 二分查找：当前位置对应第几行源码 */
export function lineAtOffset(offsets: number[], y: number): number {
  if (offsets.length === 0) return 0
  let low = 0
  let high = offsets.length - 1
  let answer = 0
  while (low <= high) {
    const mid = (low + high) >> 1
    if (offsets[mid] <= y) {
      answer = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return answer
}

function mappedElements(preview: HTMLElement): HTMLElement[] {
  return Array.from(preview.querySelectorAll<HTMLElement>('[data-line]'))
}

/** 把预览滚到指定源码行对应的位置 */
export function scrollPreviewToLine(preview: HTMLElement, line: number): void {
  let target: HTMLElement | null = null
  for (const element of mappedElements(preview)) {
    const value = Number(element.dataset.line)
    if (Number.isNaN(value)) continue
    if (value <= line) target = element
    else break
  }
  if (!target) return

  const offset =
    target.getBoundingClientRect().top - preview.getBoundingClientRect().top + preview.scrollTop
  preview.scrollTop = Math.max(0, offset - TOP_GAP)
}

/** 预览区顶部当前停在哪一行源码 */
export function previewLineAtTop(preview: HTMLElement): number {
  const probe = preview.getBoundingClientRect().top + TOP_GAP * 2
  for (const element of mappedElements(preview)) {
    const rect = element.getBoundingClientRect()
    if (rect.bottom > probe) {
      const value = Number(element.dataset.line)
      return Number.isNaN(value) ? 0 : value
    }
  }
  return 0
}
