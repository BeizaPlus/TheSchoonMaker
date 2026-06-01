import {
  IconActivityHeartbeat,
  IconClipboardPulse,
  IconEyeOff,
  IconFileMedical,
  IconLockOpen,
  IconMessage,
  IconMicrophone,
  IconMoon,
  IconRotate,
  IconSkipForward,
  IconStethoscope,
} from './SceneToolbarIcons.jsx';

function ToolbarBtn({ active, amber, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      className={`toolbar-btn${active ? ' active' : ''}${amber ? ' is-amber' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return <span className="toolbar-sep" aria-hidden="true" />;
}

/**
 * Bottom scene toolbar — visual match to clinical-scene build.
 */
export default function PlaySceneToolbar({
  examOpen,
  historyOpen,
  vitalsHighlight,
  stacksOpen,
  chatOpen,
  readPlaying,
  showCues,
  darkMode,
  freeDrop,
  onToggleExam,
  onToggleHistory,
  onToggleVitals,
  onOpenStacks,
  onToggleChat,
  onReadAloud,
  onTriggerDeath,
  onRestart,
  onToggleCues,
  onToggleTheme,
  onToggleDropMode,
}) {
  return (
    <nav className="toolbar" aria-label="Scene controls">
      <ToolbarBtn
        active={examOpen}
        onClick={onToggleExam}
        title="Physical exam"
        aria-label="Physical exam"
      >
        <IconStethoscope />
      </ToolbarBtn>
      <ToolbarBtn
        active={vitalsHighlight}
        onClick={onToggleVitals}
        title="Vitals"
        aria-label="Vitals"
      >
        <IconActivityHeartbeat />
      </ToolbarBtn>
      <ToolbarBtn
        active={historyOpen}
        onClick={onToggleHistory}
        title="Patient chart"
        aria-label="Patient chart"
      >
        <IconClipboardPulse />
      </ToolbarBtn>
      <ToolbarBtn
        active={stacksOpen}
        onClick={onOpenStacks}
        title="Treatment stacks"
        aria-label="Treatment stacks"
      >
        <IconFileMedical />
      </ToolbarBtn>

      <ToolbarSep />

      <ToolbarBtn active={chatOpen} onClick={onToggleChat} title="Chat" aria-label="Chat">
        <IconMessage />
      </ToolbarBtn>
      <ToolbarBtn
        active={readPlaying}
        amber={readPlaying}
        onClick={onReadAloud}
        title="Read case aloud"
        aria-label="Read case aloud"
      >
        <IconMicrophone />
      </ToolbarBtn>
      <ToolbarBtn onClick={onTriggerDeath} title="Skip to deterioration" aria-label="Skip to deterioration">
        <IconSkipForward />
      </ToolbarBtn>
      <ToolbarBtn onClick={onRestart} title="Restart case" aria-label="Restart case">
        <IconRotate />
      </ToolbarBtn>

      <ToolbarSep />

      <ToolbarBtn active={!showCues} onClick={onToggleCues} title="Hide cues" aria-label="Hide cues">
        <IconEyeOff />
      </ToolbarBtn>
      <ToolbarBtn active={darkMode} onClick={onToggleTheme} title="Dark mode" aria-label="Dark mode">
        <IconMoon />
      </ToolbarBtn>
      <ToolbarBtn
        active={freeDrop}
        onClick={onToggleDropMode}
        title="Free drop mode"
        aria-label="Free drop mode"
      >
        <IconLockOpen />
      </ToolbarBtn>
    </nav>
  );
}
