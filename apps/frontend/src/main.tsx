import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/globals.css'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', gap: 16,
          background: '#0f172a', color: '#e2e8f0', fontFamily: 'sans-serif',
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Что-то пошло не так</div>
          <div style={{ fontSize: 14, color: '#94a3b8', maxWidth: 400, textAlign: 'center' }}>
            {(this.state.error as Error).message}
          </div>
          <button
            style={{ marginTop: 8, padding: '10px 24px', borderRadius: 8, border: 'none',
              background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 14 }}
            onClick={() => window.location.reload()}
          >
            Обновить страницу
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
