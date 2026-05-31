import { useCallback, useEffect, useState } from 'react';
import { isCaseFlaggedForReview, toggleCaseReviewFlag } from '../data/caseProgress.js';

export default function CaseReviewFlagButton({
  caseId,
  compact = false,
  iconOnly = false,
  className = '',
  onChange,
}) {
  const [flagged, setFlagged] = useState(() => isCaseFlaggedForReview(caseId));

  useEffect(() => {
    setFlagged(isCaseFlaggedForReview(caseId));
  }, [caseId]);

  const toggle = useCallback(
    (event) => {
      event?.stopPropagation?.();
      event?.preventDefault?.();
      const next = toggleCaseReviewFlag(caseId);
      setFlagged(next);
      onChange?.(next);
    },
    [caseId, onChange],
  );

  if (!caseId) return null;

  return (
    <button
      type="button"
      className={`case-review-flag-btn ${flagged ? 'active' : ''} ${compact ? 'compact' : ''} ${className}`.trim()}
      onClick={toggle}
      aria-pressed={flagged}
      title={flagged ? 'Remove from review list' : 'Flag to review next time'}
    >
      <svg className="chip-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 5v14l12 -7l-12 -7" />
        <path d="M20 5l0 14" />
      </svg>
      {!iconOnly && <span>{flagged ? 'Flagged' : 'Review next'}</span>}
    </button>
  );
}
