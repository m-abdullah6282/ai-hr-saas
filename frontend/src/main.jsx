import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* BrowserRouter: routing ka system — URLs ko pages se match karta hai */}
    <BrowserRouter>
      {/* ErrorBoundary: koi crash ho to blank screen ki jagah message dikhaye */}
      <ErrorBoundary>
        {/* AuthProvider: auth state poori app mein available karata hai */}
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
