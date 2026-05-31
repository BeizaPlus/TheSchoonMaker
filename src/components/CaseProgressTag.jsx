/** Visual badge for case progress in pickers and lists. */
export default function CaseProgressTag({ record, showNew = false }) {
  if (!record?.plays) {
    if (!showNew) return null;
    return <span className="case-tag case-tag-new">New</span>;
  }

  if (record.completed) {
    return (
      <span
        className="case-tag case-tag-mastered"
        title={`Mastered · played ${record.plays}× · best ${record.bestAccuracy}%`}
      >
        Mastered · {record.bestAccuracy}%
      </span>
    );
  }

  return (
    <span
      className="case-tag case-tag-attempted"
      title={`Attempted ${record.plays}× · best ${record.bestAccuracy}%`}
    >
      Attempted · {record.bestAccuracy}%
    </span>
  );
}
