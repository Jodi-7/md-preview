import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/app.css'
import './styles/markdown.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root 不存在')

createRoot(container).render(<App />)

// 开发期把文件层的纯函数挂到 window，方便在浏览器里做针对性验证
if (import.meta.env.DEV) {
  void import('./lib/files').then((files) => {
    ;(window as unknown as Record<string, unknown>).__mdp = files
  })
}
