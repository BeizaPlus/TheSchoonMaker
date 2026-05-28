/** Fixed-size clinical explainer panel (AoE / chapter-screen style). */
export default function SceneExplainer({ caseData, step, stepIndex, totalSteps, patientNode }) {
  return (
    <aside className="scene-explainer">
      <p className="explainer-kicker">Schoonmaker · Case {caseData.ccsNumber}</p>
      <h2 className="explainer-title">{caseData.title}</h2>
      {patientNode && (
        <p className="explainer-location">
          Patient at: <strong>{patientNode.label}</strong>
        </p>
      )}
      {step ? (
        <>
          <p className="explainer-step-label">
            Step {step.order} of {totalSteps}
          </p>
          <h3 className="explainer-step-name">{step.label}</h3>
          <p className="explainer-body">{step.why || caseData.clinical_tip}</p>
          {step.guideline && <p className="explainer-guideline">{step.guideline}</p>}
        </>
      ) : (
        <>
          <p className="explainer-body">{caseData.clinical_tip}</p>
          <p className="explainer-body muted">{caseData.objective}</p>
        </>
      )}
    </aside>
  );
}
