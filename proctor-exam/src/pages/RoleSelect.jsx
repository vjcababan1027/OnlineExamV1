import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleSelect() {
  const navigate = useNavigate();
  const { apiUrl } = useAuth();
  
  return (
    <div className="container min-vh-100 flex-center" style={{ minHeight: '85vh', flexDirection: 'column' }}>
      <div className="text-center mb-8 animate-fade-in" style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }} className="text-gradient">
          ProctorExam
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px' }}>
          A secure, automated web platform for administering proctored examinations with real-time browser integrity logging.
        </p>
      </div>

      <div className="form-row animate-fade-in" style={{ width: '100%', maxWidth: '800px', gap: '2rem' }}>
        {/* Student Card */}
        <div className="glass-card text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', height: '320px' }}>
          <div>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(20, 184, 166, 0.15)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              marginBottom: '1.5rem',
              marginRight: 'auto',
              marginLeft: 'auto',
              border: '1px solid rgba(20, 184, 166, 0.3)'
            }}>
              👨‍🎓
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>I'm a Student</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Access your registered exam. You will need the unique Exam Code and your Student ID assigned by your instructor.
            </p>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', background: 'linear-gradient(135deg, var(--accent) 0%, #0d9488 100%)', boxShadow: '0 4px 15px var(--accent-glow)' }}
            onClick={() => navigate('/student/login')}
          >
            Enter Exam Lobby
          </button>
        </div>

        {/* Teacher Card */}
        <div className="glass-card text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', height: '320px' }}>
          <div>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              marginBottom: '1.5rem',
              marginRight: 'auto',
              marginLeft: 'auto',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}>
              👩‍🏫
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>I'm a Teacher</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Create examinations, customize timers, manage student rosters, import questions, and view graded attempt logs.
            </p>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            onClick={() => navigate('/teacher/login')}
          >
            Access Dashboard
          </button>
        </div>
      </div>
      
      {!apiUrl && (
        <div className="animate-fade-in" style={{ marginTop: '2.5rem', padding: '1rem 1.5rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 'var(--radius-sm)', maxWidth: '500px', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <p style={{ color: 'var(--warning)', fontSize: '0.85rem', textAlign: 'left', margin: 0 }}>
            <strong>Configuration needed:</strong> Apps Script API URL is not configured. Please login as a teacher to set it up in Settings.
          </p>
        </div>
      )}
    </div>
  );
}
