/** Cases with authored CCS-specific order stacks (study guide seed set). */
export default function CaseReadyTag({ compact = false }) {
  return (
    <span
      className={`case-tag case-tag-ready ${compact ? 'compact' : ''}`}
      title="Case-specific CCS stack — ready to practice"
    >
      {compact ? 'Ready' : 'Ready to practice'}
    </span>
  );
}
