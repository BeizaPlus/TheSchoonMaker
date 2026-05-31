/** Shared drag helpers — pickup from dock, drop on patient only. */

export function getStackLabel(wrap) {
  const pillText = wrap?.querySelector('.pill-text');
  if (pillText?.textContent) return pillText.textContent.trim();
  const pill = wrap?.querySelector('.drag-pill');
  if (pill?.textContent) return pill.textContent.trim();
  return 'Stack';
}

export function createDragGhost(label) {
  cleanupDragGhosts();
  const ghost = document.createElement('div');
  ghost.className = 'stack-drag-ghost';
  ghost.textContent = label;
  ghost.setAttribute('aria-hidden', 'true');
  document.body.appendChild(ghost);
  return ghost;
}

export function moveDragGhost(ghost, x, y) {
  if (!ghost) return;
  ghost.style.left = `${x}px`;
  ghost.style.top = `${y}px`;
}

export function cleanupDragGhosts() {
  document.querySelectorAll('.stack-drag-ghost, .order-ghost').forEach((node) => node.remove());
}

export function getPatientDropTarget(scene) {
  if (!scene) return null;
  return scene.querySelector('.patient-drop-surface, .patient-scene-img, .video-layer');
}

export function isPointerOverPatient(scene, clientX, clientY) {
  const patient = getPatientDropTarget(scene);
  if (!patient || clientX == null || clientY == null) return false;
  const rect = patient.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

export function setPatientDropHighlight(scene, active) {
  const patient = getPatientDropTarget(scene);
  patient?.classList.toggle('patient-drop-active', active);
  scene?.classList.toggle('patient-drop-armed', active);
  document.body.classList.toggle('stack-drag-over-patient', active);
  if (active) {
    document.body.style.cursor = 'crosshair';
  } else if (!document.querySelector('.drag-pill.dragging')) {
    document.body.style.cursor = '';
  }
}

export function showPlacementFeedback(scene, label, clientX, clientY) {
  if (!scene) return;
  const el = document.createElement('div');
  el.className = 'stack-placement-feedback';
  el.textContent = `${label} placed`;
  const sr = scene.getBoundingClientRect();
  el.style.left = `${clientX - sr.left}px`;
  el.style.top = `${clientY - sr.top}px`;
  scene.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  window.setTimeout(() => {
    el.classList.remove('is-visible');
    window.setTimeout(() => el.remove(), 1500);
  }, 40);
}

export function snapWrapHome(wrap, snapBackMs = 380) {
  if (!wrap) return;
  wrap.style.transition = `transform ${snapBackMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
  wrap.style.transform = 'translate(0, 0)';
  wrap.setAttribute('data-x', '0');
  wrap.setAttribute('data-y', '0');
  window.setTimeout(() => {
    wrap.style.transition = '';
  }, snapBackMs + 20);
}

export function dismissWrapFromDock(wrap) {
  if (!wrap) return;
  wrap.classList.add('stack-dismiss-up');
}
