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

/** 预览里所有映射块的（视口坐标 top, 源码行号），按 top 升序 */
export function previewLineMarks(preview: HTMLElement): { top: number; line: number }[] {
  const marks = mappedElements(preview)
    .map((element) => ({ top: element.getBoundingClientRect().top, line: Number(element.dataset.line) }))
    .filter((mark) => !Number.isNaN(mark.line))
  marks.sort((a, b) => a.top - b.top)
  return marks
}

/** 在相邻映射块之间按滚动比例线性插值出连续行号（可带小数） */
export function interpolateLine(marks: { top: number; line: number }[], y: number): number {
  if (marks.length === 0) return 0
  if (y <= marks[0].top) return marks[0].line
  const last = marks[marks.length - 1]
  if (y >= last.top) return last.line
  for (let index = 0; index < marks.length - 1; index += 1) {
    const a = marks[index]
    const b = marks[index + 1]
    if (y >= a.top && y <= b.top) {
      const span = b.top - a.top
      if (span <= 0) return b.line
      return a.line + (b.line - a.line) * ((y - a.top) / span)
    }
  }
  return last.line
}

/** 把（可能带小数的）行号换算回编辑器偏移：落在两行之间时按比例取 */
export function editorOffsetForLine(offsets: number[], line: number): number {
  if (offsets.length === 0) return 0
  const index = Math.floor(line)
  if (index >= offsets.length - 1) return offsets[Math.min(index, offsets.length - 1)]
  const fraction = line - index
  return offsets[index] + (offsets[index + 1] - offsets[index]) * fraction
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
