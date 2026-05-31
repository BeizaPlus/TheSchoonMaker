import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { applyTheme, readTheme } from './lib/theme.js';
import { migrateLegacyStorage } from './lib/storageKeys.js';
import { applyDeviceProfile } from './lib/deviceProfile.js';
import './index.css';
import './ui-overrides.css';

migrateLegacyStorage();
applyDeviceProfile();
applyTheme(readTheme());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
