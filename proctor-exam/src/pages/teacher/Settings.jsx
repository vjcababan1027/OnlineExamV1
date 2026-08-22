import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { callApi } from '../../api/api';

export default function Settings() {
  const navigate = useNavigate();
  const { teacherToken, apiUrl, setApiUrl } = useAuth();
  
  const [localApiUrl, setLocalApiUrl] = useState(apiUrl);
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  
  const [apiSuccess, setApiSuccess] = useState('');
  const [passcodeSuccess, setPasscodeSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teacherToken) {
      navigate('/teacher/login');
    }
  }, [teacherToken]);

  const handleSaveApi = (e) => {
    e.preventDefault();
    setApiSuccess('');
    setError('');
    
    if (!localApiUrl.trim()) {
      setError("API Web App URL cannot be empty.");
      return;
    }
    
    setApiUrl(localApiUrl.trim());
    setApiSuccess("API configuration updated successfully!");
  };

  const handleChangePasscode = async (e) => {
    e.preventDefault();
    setPasscodeSuccess('');
    setError('');
    
    if (newPasscode.trim().length < 4) {
      setError("Passcode must be at least 4 characters long.");
      return;
    }
    
    if (newPasscode !== confirmPasscode) {
      setError("New passcodes do not match.");
      return;
    }
    
    setLoading(true);
    try {
      const data = await callApi('changePasscode', {
        token: teacherToken,
        newPasscode: newPasscode.trim()
      });
      
      if (data.success) {
        setPasscodeSuccess("Passcode updated successfully! Next login will require the new passcode.");
        setNewPasscode('');
        setConfirmPasscode('');
      } else {
        setError(data.error || "Failed to update passcode.");
      }
    } catch (err) {
      setError(err.message || "An error occurred updating Apps Script settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '650px' }}>
      <button 
        className="btn btn-secondary" 
        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}
        onClick={() => navigate('/teacher/dashboard')}
      >
        ← Back to Dashboard
      </button>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Global Error Banner */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            color: 'var(--danger)',
            fontSize: '0.85rem'
          }}>
            {error}
          </div>
        )}

        {/* API Settings */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Core System API</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Configure connection to your Google Sheets backend.
          </p>
          
          {apiSuccess && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 1rem',
              color: 'var(--success)',
              fontSize: '0.85rem',
              marginBottom: '1.25rem'
            }}>
              {apiSuccess}
            </div>
          )}

          <form onSubmit={handleSaveApi}>
            <div className="form-group">
              <label className="form-label">Google Apps Script Web App Endpoint</label>
              <input
                type="url"
                className="form-control"
                value={localApiUrl}
                onChange={(e) => setLocalApiUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                required
              />
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem' }}>
              Save API Endpoint
            </button>
          </form>
        </div>

        {/* Security Settings */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Security Passcode</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Update the credentials required to log into this dashboard.
          </p>

          {passcodeSuccess && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 1rem',
              color: 'var(--success)',
              fontSize: '0.85rem',
              marginBottom: '1.25rem'
            }}>
              {passcodeSuccess}
            </div>
          )}

          <form onSubmit={handleChangePasscode}>
            <div className="form-group">
              <label className="form-label">New Instructor Passcode</label>
              <input
                type="password"
                className="form-control"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                placeholder="Minimum 4 characters"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Passcode</label>
              <input
                type="password"
                className="form-control"
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                placeholder="Re-enter new passcode"
                required
              />
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem' }}
              disabled={loading}
            >
              {loading ? "Saving Passcode..." : "Update Passcode"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
