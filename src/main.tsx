import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource-variable/archivo/wdth.css';
import './styles.css';
import App from './App';
import { StoreProvider } from './store';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider><App /></StoreProvider>
  </StrictMode>,
);

// ios standalone (viewport-fit=cover) reports a viewport that is short by the status-bar inset,
// leaving a dead band under fixed, full-height screens. the app owns the whole screen there, so use it.
const standalone = (navigator as Navigator & { standalone?: boolean }).standalone || matchMedia('(display-mode: standalone)').matches;
const setAppH = () => {
  const portrait = matchMedia('(orientation: portrait)').matches;
  const full = standalone ? (portrait ? Math.max(screen.height, screen.width) : Math.min(screen.height, screen.width)) : 0;
  document.documentElement.style.setProperty('--app-h', `${Math.max(innerHeight, full)}px`);
};
setAppH();
addEventListener('resize', setAppH);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
