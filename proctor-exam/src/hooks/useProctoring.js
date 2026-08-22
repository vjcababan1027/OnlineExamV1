import { useEffect, useRef } from 'react';
import { callApi } from '../api/api';

export function useProctoring({
  attemptId,
  isActive,
  isModalOpen,
  onViolationTriggered
}) {
  const isModalOpenRef = useRef(isModalOpen);
  const isActiveRef = useRef(isActive);
  const cooldownRef = useRef(false);

  useEffect(() => {
    isModalOpenRef.current = isModalOpen;
  }, [isModalOpen]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const reportViolation = async (type) => {
    // If exam is completed, or warning modal is active, or cooldown is running, skip
    if (!isActiveRef.current || isModalOpenRef.current || cooldownRef.current) {
      return;
    }

    // Set a short cooldown to avoid double triggers (e.g. browser firing focus + visibility changes)
    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
    }, 1500);

    try {
      const data = await callApi('logViolation', {
        attemptId,
        type
      });
      
      if (data.success) {
        onViolationTriggered({
          type,
          violationCount: data.violationCount,
          deduction: data.deduction,
          maxViolations: data.maxViolations
        });
      }
    } catch (err) {
      console.error("Failed to log proctoring violation:", err);
    }
  };

  useEffect(() => {
    if (!isActive) return;

    // 1. Tab switches (Page visibility API)
    const handleVisibility = () => {
      if (document.hidden) {
        reportViolation("TAB_SWITCH");
      }
    };

    // 2. Window Blur (Window focus state)
    const handleBlur = () => {
      reportViolation("WINDOW_BLUR");
    };

    // 3. Exiting Fullscreen (Fullscreen API)
    const handleFullscreenChange = () => {
      const isFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      if (!isFullscreen) {
        reportViolation("FULLSCREEN_EXIT");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, [isActive, attemptId]);
}
