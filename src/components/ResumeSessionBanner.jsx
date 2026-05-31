import { formatPlayCheckpointSummary } from '../lib/playSessionResume.js';

export default function ResumeSessionBanner({ checkpoint, caseMeta, onResume, onDiscard }) {
  if (!checkpoint?.caseId) return null;
  const summary = formatPlayCheckpointSummary(checkpoint, caseMeta);

  return (
    <section className="welcome-resume-banner" aria-label="Resume recent session">
      <div className="welcome-resume-copy">
        <p className="welcome-resume-kicker">Recent session</p>
        <p className="welcome-resume-title">{summary?.title}</p>
        <p className="welcome-resume-meta">
          {summary?.placed}/{summary?.total} placed · {summary?.timerText}
          {summary?.when ? ` · saved ${summary.when}` : ''}
        </p>
      </div>
      <div className="welcome-resume-actions">
        <button type="button" className="btn-primary" onClick={onResume}>
          Resume session →
        </button>
        <button type="button" className="btn-ghost" onClick={onDiscard}>
          Discard
        </button>
      </div>
    </section>
  );
}
