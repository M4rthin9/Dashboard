import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { shouldRegisterServiceWorker } from './lib/env'

const app = mount(App, {
  target: document.getElementById('app')!,
})

if (shouldRegisterServiceWorker && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

export default app
