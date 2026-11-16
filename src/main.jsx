import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Inter is bundled with the app (no third-party font request) so every reader sees the same
// typeface, including offline. The italic file covers <em> in the Code text.
import '@fontsource-variable/inter';
import '@fontsource-variable/inter/wght-italic.css';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { movedPageUrl } from '../moved-pages.js';

// Register the service worker for PWA support
const updateSW = registerSW({
  onNeedRefresh() {
    // Automatically update when new content is available
    updateSW(true);
  },
  onOfflineReady() {
    console.log("App is ready to work offline.");
  },
});

const rootElement = document.getElementById('root');

// A page that has moved to another site: the server redirects its address, but an installed or
// offline copy of the app is opened without asking the server.
const movedUrl = movedPageUrl(window.location);
if (movedUrl) {
    window.location.replace(movedUrl);
} else if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
} else {
    console.error("Could not find root element to mount React app.");
}