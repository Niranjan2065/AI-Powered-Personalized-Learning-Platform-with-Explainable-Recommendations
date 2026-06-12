// src/hooks/useQuizProctor.js
// ─────────────────────────────────────────────────────────────────────────────
// Anti-cheating hook for quiz proctoring.
//
// Detects:
//   • Tab switch        (visibilitychange → document hidden)
//   • Window blur       (window blur event — alt-tab, taskbar click)
//   • Copy / Cut        (copy, cut events on document — ALL questions)
//   • Paste             (paste event — blocked silently)
//   • Keyboard cheats   (Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+P, PrintScreen)
//   • Right-click       (contextmenu)
//   • Fullscreen exit   (user presses Esc or F11 to leave fullscreen)
//
// Behaviour:
//   • MAX_WARNINGS = 2  →  3rd violation auto-submits the quiz
//   • Each violation calls onViolation({ type, message }) callback
//   • Cleans up all listeners on unmount
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useCallback, useState } from 'react';

const MAX_WARNINGS = 2; // violations allowed before auto-submit (0-indexed, so 3rd = exit)

export default function useQuizProctor({ onViolation, onForceSubmit, active = true }) {
  const [violationCount, setViolationCount]   = useState(0);
  const [isFullscreen,   setIsFullscreen]     = useState(false);
  const violationLog                           = useRef([]);
  const violationCountRef                      = useRef(0); // sync ref for closures
  const submittedRef                           = useRef(false);

  // ── Record and escalate a violation ────────────────────────────────────────
  const triggerViolation = useCallback((type, message) => {
    if (!active || submittedRef.current) return;

    const entry = { type, message, timestamp: new Date().toISOString() };
    violationLog.current.push(entry);

    violationCountRef.current += 1;
    setViolationCount(violationCountRef.current);

    if (violationCountRef.current > MAX_WARNINGS) {
      // This is the (MAX_WARNINGS + 1)-th violation → force submit
      if (!submittedRef.current) {
        submittedRef.current = true;
        onForceSubmit(violationLog.current);
      }
    } else {
      // Still within warning zone — notify parent to show modal
      onViolation({ type, message, count: violationCountRef.current, log: violationLog.current });
    }
  }, [active, onViolation, onForceSubmit]);

  // ── Fullscreen helpers ──────────────────────────────────────────────────────
  const requestFullscreen = useCallback(() => {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen)           el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen)    el.mozRequestFullScreen();
      else if (el.msRequestFullscreen)     el.msRequestFullscreen();
    } catch (e) {
      console.warn('[Proctor] Fullscreen request failed:', e);
    }
  }, []);

  const exitFullscreenSafe = useCallback(() => {
    try {
      if (document.exitFullscreen)           document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.mozCancelFullScreen)  document.mozCancelFullScreen();
      else if (document.msExitFullscreen)     document.msExitFullscreen();
    } catch { /* ignore */ }
  }, []);

  const getFullscreenElement = () =>
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement;

  // ── Expose violation log for submission payload ─────────────────────────────
  const getViolationLog = useCallback(() => violationLog.current, []);

  // ── Register all event listeners ───────────────────────────────────────────
  useEffect(() => {
    if (!active) return;

    // Enter fullscreen automatically when quiz starts
    requestFullscreen();

    // ── 1. Tab switch (document visibility) ──────────────────────────────────
    const handleVisibility = () => {
      if (document.hidden) {
        triggerViolation('tab_switch', 'You switched to another tab!');
      }
    };

    // ── 2. Window blur (alt-tab, taskbar, other app) ─────────────────────────
    const handleBlur = () => {
      // Small debounce: ignore if it is just a fullscreen transition
      setTimeout(() => {
        if (!document.hasFocus() && !getFullscreenElement()) {
          triggerViolation('window_blur', 'You left the quiz window!');
        }
      }, 300);
    };

    // ── 3. Fullscreen change ──────────────────────────────────────────────────
    const handleFullscreenChange = () => {
      const inFullscreen = !!getFullscreenElement();
      setIsFullscreen(inFullscreen);
      if (!inFullscreen && active && !submittedRef.current) {
        triggerViolation('fullscreen_exit', 'You exited fullscreen mode!');
        // Re-enter fullscreen after warning
        setTimeout(() => requestFullscreen(), 800);
      }
    };

    // ── 4. Copy / Cut (blocked for ALL question types) ───────────────────────
    const handleCopy = (e) => {
      e.preventDefault();
      triggerViolation('copy_attempt', 'Copying text is not allowed during the quiz!');
    };
    const handleCut = (e) => {
      e.preventDefault();
      triggerViolation('cut_attempt', 'Cutting text is not allowed during the quiz!');
    };

    // ── 5. Paste (silently blocked — no warning, student can't paste answers) ─
    const handlePaste = (e) => {
      e.preventDefault();
    };

    // ── 6. Keyboard shortcuts ─────────────────────────────────────────────────
    const handleKeydown = (e) => {
      const key  = e.key?.toUpperCase();
      const ctrl = e.ctrlKey || e.metaKey;

      // Block Ctrl+C / Ctrl+X / Ctrl+V / Ctrl+A / Ctrl+P
      if (ctrl && ['C', 'X', 'V', 'A', 'P', 'U', 'S'].includes(key)) {
        e.preventDefault();
        if (key === 'C' || key === 'X') {
          triggerViolation('keyboard_copy', 'Using keyboard shortcuts to copy is not allowed!');
        }
        return;
      }

      // Block PrintScreen
      if (e.key === 'PrintScreen' || e.key === 'F12') {
        e.preventDefault();
        triggerViolation('screenshot_attempt', 'Screenshots are not allowed during the quiz!');
        return;
      }

      // Block F11 fullscreen toggle (let our fullscreen handler manage it)
      if (e.key === 'F11') {
        e.preventDefault();
      }
    };

    // ── 7. Right-click (context menu) ────────────────────────────────────────
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    // ── 8. Text selection prevention ─────────────────────────────────────────
    const handleSelectStart = (e) => {
      // Allow selection in input/textarea for typing answers,
      // but block it everywhere else
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    };

    // ── Attach all listeners ─────────────────────────────────────────────────
    document.addEventListener('visibilitychange',  handleVisibility);
    window.addEventListener('blur',                handleBlur);
    document.addEventListener('fullscreenchange',  handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange',    handleFullscreenChange);
    document.addEventListener('MSFullscreenChange',     handleFullscreenChange);
    document.addEventListener('copy',              handleCopy);
    document.addEventListener('cut',               handleCut);
    document.addEventListener('paste',             handlePaste);
    document.addEventListener('keydown',           handleKeydown);
    document.addEventListener('contextmenu',       handleContextMenu);
    document.addEventListener('selectstart',       handleSelectStart);

    // Set initial fullscreen state
    setIsFullscreen(!!getFullscreenElement());

    return () => {
      document.removeEventListener('visibilitychange',  handleVisibility);
      window.removeEventListener('blur',                handleBlur);
      document.removeEventListener('fullscreenchange',  handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange',    handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange',     handleFullscreenChange);
      document.removeEventListener('copy',              handleCopy);
      document.removeEventListener('cut',               handleCut);
      document.removeEventListener('paste',             handlePaste);
      document.removeEventListener('keydown',           handleKeydown);
      document.removeEventListener('contextmenu',       handleContextMenu);
      document.removeEventListener('selectstart',       handleSelectStart);
      // Exit fullscreen when quiz ends
      if (getFullscreenElement()) exitFullscreenSafe();
    };
  }, [active, triggerViolation, requestFullscreen, exitFullscreenSafe]);

  return {
    violationCount,
    isFullscreen,
    requestFullscreen,
    getViolationLog,
    MAX_WARNINGS,
  };
}
