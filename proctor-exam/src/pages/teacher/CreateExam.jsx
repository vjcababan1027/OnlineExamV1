import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { callApi } from '../../api/api';

export default function CreateExam() {
  const navigate = useNavigate();
  const { teacherToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [section, setSection] = useState('');
  const [duration, setDuration] = useState('60');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [deduction, setDeduction] = useState('2');
  const [maxViolations, setMaxViolations] = useState('3');
  const [randomize, setRandomize] = useState(false);

  useEffect(() => {
    if (!teacherToken) {
      navigate('/teacher/login');
    }
  }, [teacherToken]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!title.trim() || !code.trim() || !section.trim()) {
      setError("Please fill in all required fields (Title, Code, Section).");
      return;
    }
    
    setLoading(true);
    try {
      const data = await callApi('createExam', {
        token: teacherToken,
        exam: {
          title: title.trim(),
          code: code.trim().toUpperCase(),
          section: section.trim(),
          duration: Number(duration),
          startTime: startTime ? new Date(startTime).toISOString() : '',
          endTime: endTime ? new Date(endTime).toISOString() : '',
          deduction: Number(deduction),
          maxViolations: Number(maxViolations),
          randomize
        }
      });
      
      if (data.success) {
        navigate('/teacher/dashboard');
      } else {
        setError(data.error || "Failed to create exam.");
      }
    } catch (err) {
      setError(err.message || "Could not save exam to Google Sheets.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '700px' }}>
      <button 
        className="btn btn-secondary" 
        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}
        onClick={() => navigate('/teacher/dashboard')}
      >
        ← Back to Dashboard
      </button>
      
      <div className="glass-card">
        <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Configure New Examination</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Define the time limits, proctoring penalties, and structural layout for this exam.
        </p>
        
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
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Exam Title *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Midterm Examination in College Algebra"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Unique Exam Code *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. MATH101-MIDTERM"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Class Section *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Section A"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Exam Duration (Minutes)</label>
              <input
                type="number"
                className="form-control"
                min="1"
                max="1440"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Deduction per Violation (Points)</label>
              <input
                type="number"
                className="form-control"
                min="0"
                value={deduction}
                onChange={(e) => setDeduction(e.target.value)}
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Time window (Optional)</label>
              <input
                type="datetime-local"
                className="form-control"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Time window (Optional)</label>
              <input
                type="datetime-local"
                className="form-control"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Maximum Violations Permitted</label>
              <input
                type="number"
                className="form-control"
                min="1"
                value={maxViolations}
                onChange={(e) => setMaxViolations(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', height: '100%', paddingTop: '1.8rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--primary)' }}
                  checked={randomize}
                  onChange={(e) => setRandomize(e.target.checked)}
                />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Randomize Question Order per student</span>
              </label>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => navigate('/teacher/dashboard')}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Creating Exam..." : "Create Exam"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
