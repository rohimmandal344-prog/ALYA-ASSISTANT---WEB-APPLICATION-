import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress harmless ResizeObserver and sandbox Vite HMR WebSocket connection notices
window.addEventListener('error', (e) => {
  if (
    e.message === 'ResizeObserver loop completed with undelivered notifications.' ||
    (typeof e.message === 'string' && e.message.includes('WebSocket closed without opened'))
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (e) => {
  if (
    typeof e.reason?.message === 'string' &&
    e.reason.message.includes('WebSocket closed without opened')
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
