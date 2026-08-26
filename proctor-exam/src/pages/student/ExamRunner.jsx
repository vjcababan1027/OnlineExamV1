import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useProctoring } from '../../hooks/useProctoring';
import { callApi } from '../../api/api';

export default function ExamRunner() {
  const navigate = useNavigate();
  const { attemptId } = useParams();
  const { studentAttempt, logoutStudent } = useAuth();
  
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [identificationAnswer, setIdentificationAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Timer States
  const [secondsLeft, setSecondsLeft] = useState(60);
  const timerRef = useRef(null);
  const timeSpentRef = useRef(0);
  const totalDurationSeconds = useRef(0);
  
  // Proctoring States
  const [violationModalOpen, setViolationModalOpen] = useState(false);
  const [activeViolation, setActiveViolation] = useState(null);
  const [isAttemptActive, setIsAttemptActive] = useState(true);
  const [maxViolationsReached, setMaxViolationsReached] = useState(false);
  const [syncStatus, setSyncStatus] = useState(''); // Network retry message
  const [submitToast, setSubmitToast] = useState(false); // Success toast
  const [showNoAnswerWarning, setShowNoAnswerWarning] = useState(false); // No-answer popup

  // Redirect to login if auth is lost
  useEffect(() => {
    if (!studentAttempt || studentAttempt.attemptId !== attemptId) {
      navigate('/student/login');
    }
  }, [studentAttempt, attemptId]);

  // Prevent Navigation Backwards & Reload
  useEffect(() => {
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      alert("Navigation backward is disabled during the exam.");
    };
    
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Warning: Closing the browser will not pause the timer. Re-entering will resume the active session.';
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Fetch Questions & Setup Timers
  const getQuestionTimeLimit = (qIndex, questionList) => {
    const list = questionList || questions;
    if (!list || list.length === 0 || !list[qIndex]) return 60;
    const q = list[qIndex];
    if (q.timeLimit && Number(q.timeLimit) > 0) {
      return Number(q.timeLimit);
    }
    const meta = studentAttempt?.examMeta || {};
    if (meta.timerMode === 'per_question' && meta.perQuestionSec) {
      return Number(meta.perQuestionSec);
    }
    if (meta.duration && list.length > 0) {
      const splitLimit = Math.floor((Number(meta.duration) * 60) / list.length);
      return splitLimit > 5 ? splitLimit : 60;
    }
    return 60;
  };

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const data = await callApi('startAttempt', {
          examId: studentAttempt.examMeta.examId,
          studentId: studentAttempt.studentId
        }, {
          critical: true,
          onRetry: (att, msg) => setSyncStatus(msg)
        });
        
        setSyncStatus('');
        if (data.success && data.questions) {
          setQuestions(data.questions);
          const initialLimit = getQuestionTimeLimit(0, data.questions);
          totalDurationSeconds.current = initialLimit;
          setSecondsLeft(initialLimit);
        } else {
          setError(data.error || "Could not retrieve exam questions.");
        }
      } catch (err) {
        setError(err.message || "Failed to contact Sheets database.");
      } finally {
        setLoading(false);
      }
    };
    
    if (studentAttempt) {
      loadQuestions();
    }
  }, [studentAttempt]);

  // Setup Proctoring hook
  useProctoring({
    attemptId,
    isActive: isAttemptActive && !loading && questions.length > 0,
    isModalOpen: violationModalOpen,
    onViolationTriggered: (violationData) => {
      setActiveViolation(violationData);
      setViolationModalOpen(true);
      
      // Auto submit if max violations reached
      if (violationData.violationCount >= violationData.maxViolations) {
        setMaxViolationsReached(true);
      }
    }
  });

  // Re-enter Fullscreen and Resume
  const handleResumeFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        await document.documentElement.webkitRequestFullscreen();
      }
      
      setViolationModalOpen(false);
      
      // If max violations reached, trigger auto-submit now
      if (maxViolationsReached) {
        handleAutoSubmit("Auto-Submitted (Max Violations)");
      }
    } catch (err) {
      alert("Failed to acquire fullscreen: " + err.message);
    }
  };

  const pendingSubmissionsRef = useRef([]);

  // Auto-grading / submission when limit is hit or completed with continuous retry
  const handleAutoSubmit = async (statusLabel = "Auto-Submitted") => {
    setIsAttemptActive(false);
    clearInterval(timerRef.current);
    setLoading(true);
    setSyncStatus('Finishing and submitting exam results...');
    
    try {
      // Exit fullscreen safely
      if (document.exitFullscreen && document.fullscreenElement) {
        await document.exitFullscreen();
      }
      
      // Wait for all pending background submissions to resolve
      if (pendingSubmissionsRef.current.length > 0) {
        await Promise.allSettled(pendingSubmissionsRef.current);
      }
      
      // Call finishAttempt on backend with critical retry
      await callApi('finishAttempt', { attemptId }, {
        critical: true,
        onRetry: (att, msg) => setSyncStatus(`Submitting final results: ${msg}`)
      });
      
      logoutStudent();
      navigate('/student/complete');
    } catch (err) {
      console.error(err);
      logoutStudent();
      navigate('/student/complete');
    }
  };

  // Core function: advance to next question (used by both Next and Skip)
  const advanceQuestion = async (answerToSubmit) => {
    const currentQuestion = questions[currentIndex];
    const timeUsed = timeSpentRef.current;

    // Fire-and-forget background submission
    const bgSubmission = callApi('submitAnswer', {
      attemptId,
      questionId: currentQuestion.questionId,
      selectedAnswer: answerToSubmit,
      timeUsed: timeUsed
    }, {
      critical: true,
      onRetry: (att, msg) => setSyncStatus(`Saving answer (Q${currentIndex + 1}): ${msg}`)
    }).then(() => {
      setSyncStatus('');
    }).catch(err => {
      console.warn('Background answer save warning:', err);
    });

    pendingSubmissionsRef.current.push(bgSubmission);

    // Reset inputs
    setSelectedAnswer('');
    setIdentificationAnswer('');
    timeSpentRef.current = 0;

    const nextIndex = currentIndex + 1;
    if (nextIndex < questions.length) {
      const nextLimit = getQuestionTimeLimit(nextIndex, questions);
      totalDurationSeconds.current = nextLimit;
      setCurrentIndex(nextIndex);
      setSecondsLeft(nextLimit);
    } else {
      try {
        await bgSubmission;
      } catch (err) {}
      handleAutoSubmit('Finished');
    }
  };

  // Next button: warn if no answer selected
  const handleNext = () => {
    if (questions.length === 0) return;
    const currentQuestion = questions[currentIndex];
    const answer = currentQuestion.type === 'IDENTIFICATION' ? identificationAnswer.trim() : selectedAnswer;
    if (!answer) {
      // Show warning popup instead of proceeding
      setShowNoAnswerWarning(true);
      return;
    }
    // Show success toast
    setSubmitToast(true);
    setTimeout(() => setSubmitToast(false), 2000);
    advanceQuestion(answer);
  };

  // Confirm: proceed even without an answer (from popup)
  const handleConfirmNext = () => {
    setShowNoAnswerWarning(false);
    advanceQuestion(''); // Submit blank
  };

  // Skip: silently skip with blank answer, no popup
  const handleSkip = () => {
    if (questions.length === 0) return;
    setShowNoAnswerWarning(false);
    advanceQuestion('');
  };

  // Question timer effect
  useEffect(() => {
    if (loading || questions.length === 0 || violationModalOpen || !isAttemptActive) return;

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        timeSpentRef.current += 1;
        if (prev <= 1) {
          // Time expired! Auto submit current question and move forward
          clearInterval(timerRef.current);
          handleNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [loading, currentIndex, questions, violationModalOpen, selectedAnswer, identificationAnswer, isAttemptActive]);

  if (loading && questions.length === 0) {
    return (
      <div className="container min-vh-100 flex-center">
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '2.5rem' }}>🔄</span>
          <h3 style={{ marginTop: '1rem' }}>Configuring secure exam workspace...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container min-vh-100 flex-center">
        <div className="glass-card text-center" style={{ maxWidth: '500px' }}>
          <span style={{ fontSize: '3rem' }}>❌</span>
          <h3 style={{ margin: '1rem 0' }}>Configuration Error</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/student/login')}>Return to Login</button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  return (
    <div className="container" style={{ maxWidth: '850px', padding: '3rem 1.5rem' }}>
      
      {/* Network Sync / Retry Status Banner */}
      {syncStatus && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.75rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#fbbf24',
          fontSize: '0.9rem',
          fontWeight: 600,
          animation: 'pulse 1.5s infinite'
        }}>
          <span style={{ fontSize: '1.2rem' }}>🔄</span>
          <span>{syncStatus}</span>
        </div>
      )}

      {/* Header Info Panel */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        padding: '1rem 1.5rem',
        marginBottom: '2rem'
      }}>
        <div>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Active Examination</span>
          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{studentAttempt.examMeta.title}</h3>
        </div>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Question</span>
            <strong style={{ fontSize: '1.2rem', color: '#fff' }}>{currentIndex + 1} <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>/ {questions.length}</span></strong>
          </div>
          <div style={{
            background: secondsLeft <= 10 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(20, 184, 166, 0.1)',
            border: '1px solid ' + (secondsLeft <= 10 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(20, 184, 166, 0.3)'),
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center',
            minWidth: '90px'
          }}>
            <span style={{ fontSize: '0.75rem', color: secondsLeft <= 10 ? 'var(--danger)' : 'var(--accent)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Timer</span>
            <strong style={{ fontSize: '1.25rem', color: secondsLeft <= 10 ? 'var(--danger)' : 'var(--accent)' }}>
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
            </strong>
          </div>
        </div>
      </div>

      {/* Progress Bar (Overall Questions) */}
      <div style={{
        width: '100%',
        height: '6px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '9999px',
        marginBottom: '1rem',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${((currentIndex + 1) / questions.length) * 100}%`,
          height: '100%',
          background: 'linear-gradient(90deg, var(--accent) 0%, var(--primary) 100%)',
          borderRadius: '9999px',
          transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}></div>
      </div>

      {/* Question Card */}
      <div className="glass-card" style={{ padding: '2.5rem', minHeight: '350px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        
        {/* Per-Question Live Timer Bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'rgba(255,255,255,0.08)'
        }}>
          <div style={{
            height: '100%',
            width: `${Math.max(0, Math.min(100, (secondsLeft / (totalDurationSeconds.current || 60)) * 100))}%`,
            background: secondsLeft <= 10 ? 'var(--danger)' : secondsLeft <= 20 ? 'var(--warning, #f59e0b)' : 'var(--accent)',
            transition: 'width 1s linear, background-color 0.3s ease'
          }}></div>
        </div>

        {/* Question Header & Content */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="badge badge-active">Question {currentIndex + 1} of {questions.length}</span>
              {secondsLeft <= 10 && (
                <span style={{ 
                  color: 'var(--danger)', 
                  fontSize: '0.8rem', 
                  fontWeight: 600,
                  animation: 'pulse 1s infinite'
                }}>
                  ⚠️ Auto-submitting in {secondsLeft}s!
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{currentQuestion.points} point{currentQuestion.points !== 1 ? 's' : ''}</span>
          </div>
          
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, lineHeight: '1.5', marginBottom: '2.5rem' }}>
            {currentQuestion.questionText}
          </h2>

          {/* Options Render */}
          {currentQuestion.type === 'MCQ' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {['A', 'B', 'C', 'D'].map((optionKey) => {
                const optionText = currentQuestion[optionKey.toLowerCase()];
                return (
                  <label key={optionKey} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem 1.25rem',
                    background: selectedAnswer === optionKey ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid ' + (selectedAnswer === optionKey ? 'var(--primary)' : 'var(--border-color)'),
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}>
                    <input
                      type="radio"
                      name="mcq-option"
                      style={{ width: '1.15rem', height: '1.15rem', accentColor: 'var(--primary)' }}
                      checked={selectedAnswer === optionKey}
                      onChange={() => setSelectedAnswer(optionKey)}
                    />
                    <span style={{ fontSize: '0.95rem' }}><strong style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}>{optionKey}.</strong> {optionText}</span>
                  </label>
                );
              })}
            </div>
          )}

          {currentQuestion.type === 'TRUE_FALSE' && (
            <div style={{ display: 'flex', gap: '1.5rem', width: '100%' }}>
              {['A', 'B'].map((optionKey) => {
                const labelText = optionKey === 'A' ? 'True' : 'False';
                return (
                  <label key={optionKey} style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem 1.25rem',
                    background: selectedAnswer === optionKey ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid ' + (selectedAnswer === optionKey ? 'var(--primary)' : 'var(--border-color)'),
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}>
                    <input
                      type="radio"
                      name="tf-option"
                      style={{ width: '1.15rem', height: '1.15rem', accentColor: 'var(--primary)' }}
                      checked={selectedAnswer === optionKey}
                      onChange={() => setSelectedAnswer(optionKey)}
                    />
                    <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{labelText}</span>
                  </label>
                );
              })}
            </div>
          )}

          {currentQuestion.type === 'IDENTIFICATION' && (
            <div className="form-group" style={{ width: '100%' }}>
              <input
                type="text"
                className="form-control"
                style={{ padding: '1rem', fontSize: '1.05rem' }}
                placeholder="Type your answer here..."
                value={identificationAnswer}
                onChange={(e) => setIdentificationAnswer(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          {/* Skip button — only show if not the last question */}
          {currentIndex < questions.length - 1 ? (
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem', opacity: 0.75 }}
              onClick={handleSkip}
              disabled={loading}
              title="Skip this question and leave it unanswered"
            >
              ⏭ Skip
            </button>
          ) : <span />}

          <button
            className="btn btn-primary"
            style={{ minWidth: '170px', background: 'linear-gradient(135deg, var(--accent) 0%, #0d9488 100%)', boxShadow: '0 4px 15px var(--accent-glow)' }}
            onClick={handleNext}
            disabled={loading}
          >
            {loading ? 'Submitting...' : currentIndex === questions.length - 1 ? 'Finish & Submit Exam' : 'Submit & Next →'}
          </button>
        </div>

      </div>

      {/* ✅ Answer Submitted Success Toast */}
      {submitToast && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(16, 185, 129, 0.95)',
          color: '#fff',
          padding: '0.85rem 2rem',
          borderRadius: 'var(--radius-md)',
          fontWeight: 700,
          fontSize: '1rem',
          boxShadow: '0 8px 32px rgba(16, 185, 129, 0.35)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          animation: 'fadeInUp 0.3s ease'
        }}>
          <span style={{ fontSize: '1.3rem' }}>✅</span> Answer submitted successfully!
        </div>
      )}

      {/* ⚠️ No Answer Warning Popup */}
      {showNoAnswerWarning && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(10, 11, 16, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9998
        }}>
          <div className="glass-card text-center" style={{
            maxWidth: '420px',
            width: '100%',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            boxShadow: '0 0 40px rgba(245, 158, 11, 0.15)'
          }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>⚠️</span>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.75rem', color: '#fbbf24' }}>No Answer Selected</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.6 }}>
              You have not selected or typed an answer for this question.<br />
              Do you want to <strong style={{ color: '#fff' }}>skip it</strong> and leave it blank, or <strong style={{ color: 'var(--accent)' }}>go back</strong> to answer?
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowNoAnswerWarning(false)}
              >
                ← Go Back &amp; Answer
              </button>
              <button
                className="btn"
                style={{
                  flex: 1,
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#fbbf24',
                  fontWeight: 600
                }}
                onClick={handleConfirmNext}
              >
                Skip &amp; Continue →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proctoring Violation warnings overlay */}
      {violationModalOpen && activeViolation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 11, 16, 0.9)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-card text-center" style={{ width: '100%', maxWidth: '500px', border: '1px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 0 50px rgba(239, 68, 68, 0.2)' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>⚠️</span>
            <h2 style={{ color: 'var(--danger)', fontSize: '1.8rem', marginBottom: '1rem' }}>Security Violation Logged</h2>
            
            <div style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem 1.5rem',
              marginBottom: '1.5rem',
              textAlign: 'left'
            }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                You have exited the exam focus state. This activity has been recorded in the database.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Violation Logged:</span><br />
                  <strong style={{ color: 'var(--danger)' }}>{activeViolation.type}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Penalties applied:</span><br />
                  <strong style={{ color: 'var(--danger)' }}>-{activeViolation.deduction} points</strong>
                </div>
              </div>
            </div>

            <div style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: '#fff',
              marginBottom: '2rem'
            }}>
              Violations: <span style={{ color: 'var(--danger)' }}>{activeViolation.violationCount}</span> / {activeViolation.maxViolations}
            </div>

            {maxViolationsReached ? (
              <div>
                <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '1.5rem', fontWeight: 600 }}>
                  You have exceeded the maximum permitted violations. Your exam will be submitted automatically.
                </p>
                <button 
                  className="btn btn-danger" 
                  style={{ width: '100%' }}
                  onClick={handleResumeFullscreen}
                >
                  Process Auto-Submission
                </button>
              </div>
            ) : (
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', background: 'linear-gradient(135deg, var(--accent) 0%, #0d9488 100%)' }}
                onClick={handleResumeFullscreen}
              >
                Re-enter Fullscreen & Resume Exam
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
