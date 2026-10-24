type KatexApi = {
  render(tex: string, element: HTMLElement, options?: Record<string, unknown>): void
}

let modulePromise: Promise<KatexApi> | null = null

/**
 * KaTeX 的 JS 与字体体积都不小，只有文档里真的出现公式时才加载。
 * CSS 也一并按需加载，避免首屏多出一个 20KB+ 的样式表。
 */
export function loadKatex(): Promise<KatexApi> {
  if (!modulePromise) {
    modulePromise = Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
      ([katex]) => ((katex as unknown as { default?: KatexApi }).default ?? katex) as KatexApi,
    )
  }
  return modulePromise
}
