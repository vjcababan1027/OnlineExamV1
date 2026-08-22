import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { callApi } from '../../api/api';

export default function StudentLogin() {
  const navigate = useNavigate();
  const { verifyStudent, apiUrl } = useAuth();
  
  const [examCode, setExamCode] = useState('');
  const [roster, setRoster] = useState(null);
  const [examMeta, setExamMeta] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  const handleLoadRoster = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!apiUrl) {
      setError("System is not configured. Ask your instructor to configure the API Web App URL.");
      return;
    }
    
    if (!examCode.trim()) {
      setError("Please enter the Exam Code.");
      return;
    }
    
    setLoading(true);
    try {
      const data = await callApi('getExamRoster', { examCode: examCode.trim() });
      if (data.success) {
        setRoster(data.roster || []);
        setExamMeta(data.examMeta);
      } else {
        setError(data.error || "Could not find active exam for this code.");
      }
    } catch (err) {
      setError(err.message || "Failed to contact Sheets database. Check exam code or API endpoint configuration.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!selectedStudentId) {
      setError("Please select your name from the student roster.");
      return;
    }
    
    setVerifying(true);
    try {
      const result = await verifyStudent(examCode.trim(), selectedStudentId);
      if (result.success) {
        navigate('/student/instructions');
      } else {
        setError(result.error || "Credentials verification failed.");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred contacting the server.");
    } finally {
      setVerifying(false);
    }
  };
  
  const handleReset = () => {
    setRoster(null);
    setExamMeta(null);
    setSelectedStudentId('');
    setError('');
  };

  return (
    <div className="container min-vh-100 flex-center" style={{ minHeight: '80vh' }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '480px' }}>
        <button 
          className="btn btn-secondary" 
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}
          onClick={() => navigate('/')}
        >
          ← Back to Roles
        </button>
        
        <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Student Exam Entry</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Enter the Exam Code provided by your instructor to locate your examination roster.
        </p>
        
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            color: 'var(--danger)',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            textAlign: 'left'
          }}>
            {error}
          </div>
        )}
        
        {/* Step 1: Input Exam Code */}
        {!roster && (
          <form onSubmit={handleLoadRoster}>
            <div className="form-group">
              <label className="form-label">Exam Code</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. MIDTERM-MATH-101"
                value={examCode}
                onChange={(e) => setExamCode(e.target.value)}
                required
              />
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '1rem', background: 'linear-gradient(135deg, var(--accent) 0%, #0d9488 100%)', boxShadow: '0 4px 15px var(--accent-glow)' }}
              disabled={loading}
            >
              {loading ? "Searching Exam..." : "Find Exam & Load Roster"}
            </button>
          </form>
        )}

        {/* Step 2: Roster Display */}
        {roster && examMeta && (
          <form onSubmit={handleLoginSubmit}>
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Found Examination:</span>
              <h3 style={{ fontSize: '1.15rem', color: '#fff', marginTop: '0.25rem', marginBottom: '0.25rem' }}>{examMeta.title}</h3>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>🔑 Code: <strong>{examMeta.code}</strong></span>
                <span>⏱️ Timer: <strong>{examMeta.duration} mins</strong></span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Select Your Name</label>
              {roster.length === 0 ? (
                <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>
                  No students are currently registered on this exam roster. Contact your instructor.
                </div>
              ) : (
                <select
                  className="form-control"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  required
                  style={{
                    background: 'var(--bg-secondary)',
                    color: '#fff',
                    border: '1px solid var(--border-color)',
                    padding: '0.75rem'
                  }}
                >
                  <option value="">-- Choose your name --</option>
                  {roster.map((student) => (
                    <option
                      key={student.studentId}
                      value={student.studentId}
                      disabled={student.completed}
                    >
                      {student.name} {student.completed ? " (Already Completed)" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                onClick={handleReset}
                disabled={verifying}
              >
                Change Code
              </button>
              
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ flex: 2, background: 'linear-gradient(135deg, var(--accent) 0%, #0d9488 100%)', boxShadow: '0 4px 15px var(--accent-glow)' }}
                disabled={verifying || roster.length === 0}
              >
                {verifying ? "Loading..." : "Enter Exam Lobby"}
              </button>
            </div>
          </form>
        )}
        
        <div style={{ marginTop: '1.5rem', fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          By continuing, you agree that your browser focus transitions and fullscreen states will be logged.
        </div>
      </div>
    </div>
  );
}
