import PatientScene from './PatientScene.jsx';
import { getBranding } from '../data/gameData.js';

export default function Complete({ caseData, stats, playMode, onAgain, onHome, onNext }) {
  const showNext = playMode === 'shuffle' || playMode === 'random';
  const masteryThreshold = getBranding()?.completionThreshold ?? 99;
  const mastered = stats.accuracy >= masteryThreshold;
  const mm = Math.floor(stats.seconds / 60);
  const ss = String(stats.seconds % 60).padStart(2, '0');

  return (
    <main className="complete-screen">
      <div className="complete-bg" aria-hidden>
        <PatientScene scene={caseData.patientScene} className="complete-bg-img" />
        <div className="complete-bg-overlay" />
      </div>

      <div className="complete-card">
        <p className="complete-kicker">Case complete</p>
        <h1 className="complete-title">{caseData.title}</h1>
        <p className={`complete-verdict ${mastered ? 'mastered' : ''}`}>
          {mastered ? 'Mastered — progress saved' : 'Keep drilling — progress saved'}
        </p>

        <div className="statgrid">
          <div className="stat">
            <span className="stat-label">Accuracy</span>
            <span className="stat-val">{stats.accuracy}%</span>
          </div>
          <div className="stat">
            <span className="stat-label">Attempts</span>
            <span className="stat-val">{stats.attempts}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Time</span>
            <span className="stat-val">
              {mm}:{ss}
            </span>
          </div>
        </div>

        <div className="complete-actions">
          {showNext && (
            <button type="button" className="btn-play" onClick={onNext}>
              {playMode === 'shuffle' ? 'Next in queue →' : 'Random case →'}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onAgain}>
            Replay
          </button>
          <button type="button" className="btn-ghost" onClick={onHome}>
            Home
          </button>
        </div>
      </div>
    </main>
  );
}
