import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  let refreshing = false;

  const emitUpdateReady = (registration) => {
    window.__portfolioUpdateReady = true;
    window.__portfolioWaitingRegistration = registration;
    window.dispatchEvent(new CustomEvent('portfolio-sw-update', { detail: { registration } }));
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          emitUpdateReady(registration);
        }

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              emitUpdateReady(registration);
            }
          });
        });
      })
      .catch(() => {});
  });
}
