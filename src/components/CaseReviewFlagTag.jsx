/** Bookmark tag for cases flagged to review next session. */
export default function CaseReviewFlagTag({ compact = false }) {
  return (
    <span
      className={`case-tag case-tag-review ${compact ? 'compact' : ''}`}
      title="Flagged to review next time"
    >
      {compact ? 'Review' : 'Review next'}
    </span>
  );
}
