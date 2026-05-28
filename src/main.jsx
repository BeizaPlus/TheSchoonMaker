import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { applyTheme, readTheme } from './lib/theme.js';
import { migrateLegacyStorage } from './lib/storageKeys.js';
import './index.css';

migrateLegacyStorage();
applyTheme(readTheme());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
