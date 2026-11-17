import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { I18nProvider } from './i18n/index.jsx'
import { ConfirmProvider, ToastProvider } from './components/ui.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <ToastProvider>
        <ConfirmProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </ConfirmProvider>
      </ToastProvider>
    </I18nProvider>
  </React.StrictMode>,
)
