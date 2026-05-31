import { useState, useMemo } from 'react';
import WelcomeScreen from './WelcomeScreen.jsx';
import CaseBrowser from './CaseBrowser.jsx';
import { isStudioApp } from '../lib/appMode.js';
import { getCaseById } from '../data/useCcsCatalog.js';

export default function Home({
  onPlay,
  resumeCheckpoint,
  onResumeSession,
  onDiscardSession,
}) {
  const [view, setView] = useState('welcome');
  const [casesFilter, setCasesFilter] = useState('all');
  const studioBuild = useMemo(() => isStudioApp(), []);
  const resumeCase = useMemo(
    () => (resumeCheckpoint?.caseId ? getCaseById(resumeCheckpoint.caseId) : null),
    [resumeCheckpoint?.caseId],
  );

  if (view === 'cases') {
    return (
      <CaseBrowser
        initialFilter={casesFilter}
        onPlay={onPlay}
        onBack={() => setView('welcome')}
      />
    );
  }

  return (
    <WelcomeScreen
      onPlay={onPlay}
      resumeCheckpoint={resumeCheckpoint}
      resumeCase={resumeCase}
      onResumeSession={onResumeSession}
      onDiscardSession={onDiscardSession}
      onOpenCases={() => {
        setCasesFilter('all');
        setView('cases');
      }}
      onOpenReadyCases={() => {
        setCasesFilter('ready');
        setView('cases');
      }}
      onOpenStackTestingCases={() => {
        setCasesFilter('stacks');
        setView('cases');
      }}
      onOpenFlaggedCases={() => {
        setCasesFilter('flagged');
        setView('cases');
      }}
      studioBuild={studioBuild}
    />
  );
}
