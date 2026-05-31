import { useCallback, useEffect, useState } from 'react';
import { FiBookmark } from 'react-icons/fi';
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
      <FiBookmark aria-hidden />
      {!iconOnly && <span>{flagged ? 'Flagged' : 'Review next'}</span>}
    </button>
  );
}
