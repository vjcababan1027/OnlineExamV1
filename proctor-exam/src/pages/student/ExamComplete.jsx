import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function ExamComplete() {
  const navigate = useNavigate();
  
  return (
    <div className="container min-vh-100 flex-center" style={{ minHeight: '80vh' }}>
      <div className="glass-card text-center animate-fade-in" style={{ width: '100%', maxWidth: '550px', padding: '3.5rem 2rem' }}>
        
        {/* Success Animated Checkmark Circle */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(20, 184, 166, 0.15)',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.5rem',
          marginBottom: '2rem',
          marginRight: 'auto',
          marginLeft: 'auto',
          border: '2px solid rgba(20, 184, 166, 0.35)',
          boxShadow: '0 0 20px rgba(20, 184, 166, 0.2)'
        }}>
          ✓
        </div>
        
        <h2 style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>Exam Submitted Successfully</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2.5rem' }}>
          Your responses and logs have been compiled and sent to your instructor's grading worksheet. 
          Your final score has been computed, incorporating any proctoring violation deductions.
        </p>

        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '1rem',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          marginBottom: '2.5rem',
          textAlign: 'left'
        }}>
          💡 <strong>Student Note:</strong> To maintain test integrity, your score and item results are not shown here. 
          Please contact your instructor or check your class grading portal for final results.
        </div>

        <button 
          className="btn btn-secondary" 
          style={{ width: '100%', padding: '0.8rem' }}
          onClick={() => navigate('/')}
        >
          Return to Portal Entrance
        </button>
      </div>
    </div>
  );
}
