import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function TeacherLogin() {
  const navigate = useNavigate();
  const { loginTeacher, apiUrl, setApiUrl } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [tempApiUrl, setTempApiUrl] = useState(apiUrl || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const needsSetup = !apiUrl;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // If API URL field is shown (setup mode), save it first
    const urlToUse = needsSetup ? tempApiUrl.trim() : apiUrl;

    if (!urlToUse) {
      setError("Please enter your Google Apps Script Web App URL.");
      return;
    }

    if (!passcode.trim()) {
      setError("Passcode is required.");
      return;
    }

    // Save API URL before attempting login
    if (needsSetup) {
      setApiUrl(urlToUse);
    }

    setLoading(true);
    try {
      const result = await loginTeacher(passcode);
      if (result.success) {
        navigate('/teacher/settings');
      } else {
        setError(result.error || "Authentication failed. Check passcode.");
      }
    } catch (err) {
      setError(err.message || "Could not reach the API. Check the Web App URL.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container min-vh-100 flex-center" style={{ minHeight: '80vh' }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '460px' }}>
        <button
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}
          onClick={() => navigate('/')}
        >
          ← Back to Roles
        </button>

        <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Teacher Access</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          {needsSetup
            ? "First-time setup: paste your Apps Script URL and enter the passcode."
            : "Enter your passcode to open the dashboard and settings."}
        </p>

        {needsSetup && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            fontSize: '0.82rem',
            color: 'var(--warning)',
            marginBottom: '1.5rem'
          }}>
            ⚙️ <strong>No API configured.</strong> Enter your Google Apps Script Web App URL below to connect the backend.
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
            marginBottom: '1.5rem',
            textAlign: 'left',
            whiteSpace: 'pre-line'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Show API URL input when not yet configured */}
          {needsSetup && (
            <div className="form-group">
              <label className="form-label">Google Apps Script Web App URL</label>
              <input
                type="url"
                className="form-control"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={tempApiUrl}
                onChange={(e) => setTempApiUrl(e.target.value)}
                required
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                From Apps Script → Deploy → Manage Deployments → Copy Web App URL
              </span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Instructor Passcode</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="••••••"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                required
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                style={{
                  position: 'absolute', right: '10px', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: '1rem'
                }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : needsSetup ? 'Connect & Login' : 'Login & Open Settings'}
          </button>
        </form>

        {/* If already configured, show option to change URL */}
        {!needsSetup && (
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              type="button"
              style={{
                background: 'none', border: 'none',
                color: 'var(--primary)', fontSize: '0.8rem',
                cursor: 'pointer', textDecoration: 'underline'
              }}
              onClick={() => setApiUrl('')}
            >
              Reset API URL
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
