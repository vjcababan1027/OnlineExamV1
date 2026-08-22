import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { callApi } from '../../api/api';

export default function PreExamInstructions() {
  const navigate = useNavigate();
  const { studentAttempt, updateStudentAttemptId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!studentAttempt) {
      navigate('/student/login');
    }
  }, [studentAttempt]);

  const handleStartExam = async () => {
    setError('');
    setLoading(true);
    
    try {
      // 1. Request fullscreen
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        await document.documentElement.webkitRequestFullscreen();
      }
      
      // 2. Call startAttempt action on backend
      const data = await callApi('startAttempt', {
        examId: studentAttempt.examMeta.examId,
        studentId: studentAttempt.studentId
      });
      
      if (data.success && data.attemptId) {
        // Save actual attemptId in state and storage
        updateStudentAttemptId(data.attemptId);
        navigate(`/exam/${data.attemptId}`);
      } else {
        setError(data.error || "Failed to start the exam session.");
        // Exit fullscreen if backend fails
        if (document.exitFullscreen) document.exitFullscreen();
      }
    } catch (err) {
      setError("Fullscreen permission is required to take this exam: " + err.message);
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!studentAttempt) return null;

  const { studentName, examMeta, resumed } = studentAttempt;

  return (
    <div className="container min-vh-100 flex-center" style={{ minHeight: '80vh' }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '650px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Welcome, {studentName}</h2>
        <h3 className="text-gradient" style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>
          {examMeta.title}
        </h3>
        
        {resumed && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            color: 'var(--warning)',
            fontSize: '0.85rem',
            marginBottom: '1.5rem'
          }}>
            <strong>Exam Resumption detected:</strong> You had an active session. You will be redirected to resume the exam immediately.
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            color: 'var(--danger)',
            fontSize: '0.85rem',
            marginBottom: '1.5rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
          <h4 style={{ fontSize: '1rem', color: '#fff', marginBottom: '0.75rem', fontWeight: 600 }}>Examination Guidelines & Rules:</h4>
          
          <ul style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            lineHeight: '1.6',
            paddingLeft: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <li>⏱️ You have exactly <strong>{examMeta.duration} minutes</strong> to complete the exam.</li>
            <li>🖥️ <strong>Fullscreen mode is strictly enforced.</strong> Exiting fullscreen mode, switching browser tabs, or blurring the window will trigger violation alerts.</li>
            <li>⚠️ Each violation logs a penalty of <strong>-{examMeta.deduction} points</strong> off your final score.</li>
            <li>🛑 Accumulating <strong>{examMeta.maxViolations} violations</strong> may lock your attempt or auto-submit it immediately.</li>
            <li>↩️ **Backward navigation is disabled.** Once you click Next to save a question, you cannot return to edit it. Ensure your answers are final.</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              sessionStorage.clear();
              navigate('/');
            }}
            disabled={loading}
          >
            Cancel & Exit
          </button>
          
          <button 
            className="btn btn-primary"
            style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #0d9488 100%)', boxShadow: '0 4px 15px var(--accent-glow)' }}
            onClick={handleStartExam}
            disabled={loading}
          >
            {loading ? "Starting session..." : resumed ? "Resume Exam" : "Enter Fullscreen & Start"}
          </button>
        </div>
      </div>
    </div>
  );
}
