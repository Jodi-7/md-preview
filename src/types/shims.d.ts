/** 这两个插件没有官方类型声明（或声明已过时），这里补最小可用的类型 */
declare module 'markdown-it-footnote' {
  import type { PluginSimple } from 'markdown-it'
  const plugin: PluginSimple
  export default plugin
}

declare module 'markdown-it-task-lists' {
  import type { PluginWithOptions } from 'markdown-it'

  export interface TaskListOptions {
    enabled?: boolean
    label?: boolean
    labelAfter?: boolean
  }

  const plugin: PluginWithOptions<TaskListOptions>
  export default plugin
}
