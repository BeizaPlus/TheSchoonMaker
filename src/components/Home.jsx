import { useState, useMemo } from 'react';
import WelcomeScreen from './WelcomeScreen.jsx';
import CaseBrowser from './CaseBrowser.jsx';
import { isStudioApp } from '../lib/appMode.js';

export default function Home({ onPlay }) {
  const [view, setView] = useState('welcome');
  const studioBuild = useMemo(() => isStudioApp(), []);

  if (view === 'cases') {
    return <CaseBrowser onPlay={onPlay} onBack={() => setView('welcome')} />;
  }

  return (
    <WelcomeScreen
      onPlay={onPlay}
      onOpenCases={() => setView('cases')}
      studioBuild={studioBuild}
    />
  );
}
