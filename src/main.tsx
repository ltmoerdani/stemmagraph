import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// i18n must initialize before the first render so Indonesian strings are
// available synchronously on first paint.
import { i18n } from './lib/i18n';
import './index.css';

// Reflect the active language on the document as soon as we boot
document.documentElement.lang = i18n.language;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
