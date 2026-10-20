import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { IMAGE_ASSETS } from './resources/images'
import './index.css'
import App from './App.tsx'

let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
if (!favicon) {
  favicon = document.createElement('link')
  favicon.rel = 'icon'
  document.head.append(favicon)
}
favicon.href = IMAGE_ASSETS.appIcon

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
