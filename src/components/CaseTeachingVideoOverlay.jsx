import { useCallback, useEffect, useRef } from 'react';

export default function CaseTeachingVideoOverlay({
  src,
  open = false,
  frozen = false,
  objectPosition = 'center center',
  onEnded,
  onSkip,
  onError,
}) {
  const videoRef = useRef(null);
  const endedRef = useRef(false);

  const freezeFrame = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;

    const seekToEnd = () => {
      try {
        el.pause();
        if (Number.isFinite(el.duration) && el.duration > 0) {
          el.currentTime = Math.max(0, el.duration - 0.05);
        }
      } catch {
        /* ignore seek errors */
      }
    };

    if (Number.isFinite(el.duration) && el.duration > 0) {
      seekToEnd();
      return;
    }

    el.addEventListener('loadedmetadata', seekToEnd, { once: true });
  }, []);

  useEffect(() => {
    if (!open || !src) {
      endedRef.current = false;
      return;
    }
    if (frozen || endedRef.current) return;

    const el = videoRef.current;
    if (!el) return;

    el.preload = 'auto';
    el.muted = false;
    el.currentTime = 0;
    el.play().catch(() => {
      el.muted = true;
      el.play().catch(() => onError?.('Tap play on the video to continue.'));
    });
  }, [open, src, frozen, onError]);

  useEffect(() => {
    if (open && frozen) freezeFrame();
  }, [open, frozen, freezeFrame]);

  const handleEnded = () => {
    endedRef.current = true;
    freezeFrame();
    onEnded?.();
  };

  const handleSkip = () => {
    endedRef.current = true;
    freezeFrame();
    onSkip?.();
  };

  if (!open || !src) return null;

  return (
    <div
      className={`thanks-video-overlay ${frozen ? 'frozen' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Case teaching video"
    >
      <p className="thanks-video-kicker">Teaching video — learn the case takeaway</p>
      <video
        ref={videoRef}
        className="thanks-video-player"
        src={src}
        style={{ objectPosition }}
        autoPlay
        playsInline
        preload="auto"
        muted
        onError={() => onError?.('Video failed to load. Check public/assets/video paths.')}
        onEnded={handleEnded}
      />
      {!frozen && (
        <button type="button" className="thanks-video-skip btn-ghost" onClick={handleSkip}>
          Skip →
        </button>
      )}
    </div>
  );
}
