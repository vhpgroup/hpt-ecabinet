import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './store/AppContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </AppProvider>
  </React.StrictMode>,
);

// Đăng ký service worker cho PWA.
// LƯU Ý: trong iframe sandbox (thiếu allow-same-origin), CHỈ ĐỌC
// navigator.serviceWorker đã ném SecurityError ĐỒNG BỘ — nên phải
// try/catch bao ngoài, .catch() của promise không đỡ được.
try {
  if (location.protocol === 'https:' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      try {
        navigator.serviceWorker.register('./sw.js').catch(() => {/* im lặng trong demo */});
      } catch { /* iframe sandbox: bỏ qua, PWA chỉ chạy khi mở trực tiếp */ }
    });
  }
} catch { /* môi trường chặn Service Worker */ }
