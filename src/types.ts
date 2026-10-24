export type Theme = 'light' | 'dark'
export type FontSize = 'sm' | 'md' | 'lg'
export type ContentWidth = 'narrow' | 'wide'
export type ViewMode = 'read' | 'split'

/** 文档库来源：单个文件 / 整个目录 / 内置示例 */
export type LibraryKind = 'single' | 'directory' | 'demo'

export interface DocEntry {
  /** 库内相对路径，使用 / 分隔，例如 docs/README.md */
  path: string
  /** 文件名，例如 README.md */
  name: string
  /** 所在目录，根目录为空字符串 */
  dir: string
  size: number
  mtime: number
}

export interface DocStat {
  mtime: number
  size: number
}

/** 来源标记：只有带 origin 的库才能在刷新后恢复 */
export interface LibraryOrigin {
  kind: 'dir' | 'file' | 'demo' | 'path'
  handle?: unknown
  /** 桌面版：绝对路径 */
  root?: string
  isDir?: boolean
}

/**
 * 一个文档库：对外只暴露「有哪些文档」和「怎么读」，
 * 界面层不关心文件来自拖拽、目录选择还是内置示例。
 */
export interface Library {
  kind: LibraryKind
  /** 显示在侧栏顶部的名字 */
  rootName: string
  docs: DocEntry[]
  /** 是否支持监听磁盘改动（只有拿到了文件句柄才可能为 true） */
  watchable: boolean
  /** 可恢复的来源；拖拽 / 粘贴没有这一项 */
  origin?: LibraryOrigin
  readDoc(path: string): Promise<string>
  /**
   * 把文档里的相对图片路径解析成可直接加载的 URL。
   * 无法解析时返回 null，交给界面层决定如何降级。
   */
  resolveAsset(docPath: string, src: string): Promise<string | null>
  /** 只有可监听的来源才有 */
  stat?(path: string): Promise<DocStat | null>
  /** 只有拿到句柄、且有写权限时才有 */
  writeDoc?(path: string, text: string): Promise<void>
  dispose(): void
}

/**
 * 一个打开中的标签页。
 * 它自带读取闭包，所以即使之后又打开了别的目录，这个标签仍然可读、可保存。
 */
export interface Tab {
  id: string
  path: string
  name: string
  rootName: string
  /** 这个标签所属的文档库，用于解析相对图片 */
  lib: Library
  /** 当前内容（可能被编辑过） */
  text: string
  /** 最近一次读盘或保存时的内容，用来判断是否未保存 */
  savedText: string
  html: string
  mtime: number
  /** 用于刷新后恢复；没有来源的标签不会被持久化 */
  source?: LibraryOrigin
  read(): Promise<string>
  stat?(): Promise<DocStat | null>
  write?(text: string): Promise<void>
}

export interface OutlineItem {
  id: string
  text: string
  level: number
}
