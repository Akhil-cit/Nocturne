import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { MiniPlayerApp } from './components/windows/MiniPlayerApp';
import { OverlayApp } from './components/windows/OverlayApp';
import '@/styles/globals.css';

const params = new URLSearchParams(window.location.search);

// Wire listening history integration (only in main app window, not overlay/mini)
if (!params.get('overlay') && !params.get('mini')) {
  void import('@/services/history/listeningSessionIntegration');
}
const isOverlay = params.get('overlay') === '1';
const isMini = params.get('mini') === '1';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isOverlay ? <OverlayApp /> : isMini ? <MiniPlayerApp /> : <App />}
  </React.StrictMode>,
);
