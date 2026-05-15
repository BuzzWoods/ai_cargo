import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find the root element')

const root = createRoot(rootElement)

// 项目入口：React 从这里挂载，后续页面结构由 App.tsx 的路由决定。
root.render(
  <App />
)
