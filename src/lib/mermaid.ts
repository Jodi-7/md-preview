let mermaidModule: typeof import('mermaid').default | null = null
let currentTheme: 'default' | 'dark' | null = null

/**
 * Mermaid 体积不小，只有文档里真的出现图表时才加载。
 * 首次加载后缓存模块，主题变化时只重新 initialize。
 */
export async function loadMermaid(dark: boolean): Promise<typeof import('mermaid').default> {
  if (!mermaidModule) {
    const mod = await import('mermaid')
    mermaidModule = mod.default
  }
  const theme = dark ? 'dark' : 'default'
  if (currentTheme !== theme) {
    mermaidModule.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme,
      fontFamily:
        '-apple-system, "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif',
    })
    currentTheme = theme
  }
  return mermaidModule
}
