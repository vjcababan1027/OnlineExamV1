import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { callApi } from '../../api/api';

export default function StudentImport() {
  const navigate = useNavigate();
  const { examId } = useParams();
  const { teacherToken } = useAuth();
  
  const [rawText, setRawText] = useState('');
  const [section, setSection] = useState('');
  const [previewList, setPreviewList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!teacherToken) {
      navigate('/teacher/login');
    }
  }, [teacherToken]);

  // Handle parsing on text change
  useEffect(() => {
    const lines = rawText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    setPreviewList(lines);
  }, [rawText]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!section.trim()) {
      setError("Please specify the Section for the students.");
      return;
    }
    
    if (previewList.length === 0) {
      setError("Roster paste block is empty. Add at least one name.");
      return;
    }
    
    setLoading(true);
    try {
      const data = await callApi('importStudents', {
        token: teacherToken,
        examId,
        section: section.trim(),
        students: previewList
      });
      
      if (data.success) {
        setSuccess(`Roster uploaded! Successfully registered ${data.count} students. They can now login using their generated Student IDs.`);
        setRawText('');
      } else {
        setError(data.error || "Roster upload failed.");
      }
    } catch (err) {
      setError(err.message || "An error occurred writing student entries.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '800px' }}>
      <button 
        className="btn btn-secondary" 
        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}
        onClick={() => navigate('/teacher/dashboard')}
      >
        ← Back to Dashboard
      </button>
      
      <div className="glass-card">
        <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Import Student Roster</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Upload authorized students. Student Identification IDs will be automatically generated upon import.
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
        
        {success && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            color: 'var(--success)',
            fontSize: '0.85rem',
            marginBottom: '1.5rem'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Roster Section Code (e.g. Section B)</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Section B"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Paste Names (One name per line)</label>
            <textarea
              className="form-control"
              style={{ minHeight: '180px', fontFamily: 'monospace', fontSize: '0.9rem', resize: 'vertical' }}
              placeholder="Alice Vance&#10;Bob Smith&#10;Charlie Brown"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              required
            ></textarea>
          </div>

          {previewList.length > 0 && (
            <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Roster Preview ({previewList.length} Student{previewList.length > 1 ? 's' : ''})
              </h4>
              <div style={{
                maxHeight: '180px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(0,0,0,0.2)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.5rem 1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Row</th>
                      <th style={{ padding: '0.5rem 1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Full Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewList.map((name, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.5rem 1rem', color: 'var(--text-muted)' }}>{index + 1}</td>
                        <td style={{ padding: '0.5rem 1rem' }}>{name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #0d9488 100%)', boxShadow: '0 4px 15px var(--accent-glow)' }}
              disabled={loading}
            >
              {loading ? "Importing Roster..." : `Import ${previewList.length} Student${previewList.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
