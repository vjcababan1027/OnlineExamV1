import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleSelect() {
  const navigate = useNavigate();
  const { apiUrl } = useAuth();
  const [starClicks, setStarClicks] = useState(0);
  const clickTimeoutRef = useRef(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    };
  }, []);

  const handleStarClick = () => {
    const nextCount = starClicks + 1;
    setStarClicks(nextCount);

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    if (nextCount >= 3) {
      setStarClicks(0);
      navigate('/teacher/login');
    } else {
      // Reset clicks if user stops clicking for 2.5 seconds
      clickTimeoutRef.current = setTimeout(() => {
        setStarClicks(0);
      }, 2500);
    }
  };
  
  return (
    <div className="container min-vh-100 flex-center" style={{ minHeight: '85vh', flexDirection: 'column', position: 'relative' }}>
      {/* Upper Secret Star Button */}
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 10 }}>
        <button
          onClick={handleStarClick}
          title="Proctor Portal"
          aria-label="Proctor Portal"
          style={{
            background: starClicks > 0 ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)',
            border: starClicks > 0 ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            width: '42px',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: starClicks > 0 ? 'var(--primary)' : 'var(--text-muted)',
            fontSize: '1.25rem',
            transition: 'all 0.2s ease',
            boxShadow: starClicks > 0 ? '0 0 15px rgba(99, 102, 241, 0.4)' : 'none',
            transform: starClicks > 0 ? `scale(${1 + starClicks * 0.1})` : 'scale(1)'
          }}
        >
          ★
        </button>
      </div>

      <div className="text-center mb-8 animate-fade-in" style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '0.75rem' }} className="text-gradient">
          ProctorExam
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '560px' }}>
          A secure, automated web platform for administering proctored examinations with real-time browser integrity logging.
        </p>
      </div>

      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '440px' }}>
        {/* Student Card */}
        <div className="glass-card text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', minHeight: '320px', padding: '2rem' }}>
          <div>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(20, 184, 166, 0.15)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              marginBottom: '1.5rem',
              marginRight: 'auto',
              marginLeft: 'auto',
              border: '1px solid rgba(20, 184, 166, 0.3)'
            }}>
              👨‍🎓
            </div>
            <h2 style={{ fontSize: '1.6rem', marginBottom: '0.75rem' }}>Student Exam Lobby</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              Access your registered exam. You will need the unique Exam Code and your Student ID assigned by your instructor.
            </p>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', background: 'linear-gradient(135deg, var(--accent) 0%, #0d9488 100%)', boxShadow: '0 4px 15px var(--accent-glow)' }}
            onClick={() => navigate('/student/login')}
          >
            Enter Exam Lobby
          </button>
        </div>
      </div>
      
      {!apiUrl && (
        <div className="animate-fade-in" style={{ marginTop: '2.5rem', padding: '1rem 1.5rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 'var(--radius-sm)', maxWidth: '440px', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <p style={{ color: 'var(--warning)', fontSize: '0.85rem', textAlign: 'left', margin: 0 }}>
            <strong>Configuration needed:</strong> Apps Script API URL is not configured. Please login as a teacher to set it up in Settings.
          </p>
        </div>
      )}
    </div>
  );
}
