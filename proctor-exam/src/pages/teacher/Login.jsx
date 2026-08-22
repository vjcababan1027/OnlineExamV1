import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function TeacherLogin() {
  const navigate = useNavigate();
  const { loginTeacher } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!passcode.trim()) {
      setError("Passcode is required.");
      return;
    }
    
    setLoading(true);
    try {
      const result = await loginTeacher(passcode);
      if (result.success) {
        // Navigate directly to Settings as requested: "then show the settings"
        navigate('/teacher/settings');
      } else {
        setError(result.error || "Authentication failed.");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container min-vh-100 flex-center" style={{ minHeight: '80vh' }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '450px' }}>
        <button 
          className="btn btn-secondary" 
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}
          onClick={() => navigate('/')}
        >
          ← Back to Roles
        </button>
        
        <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Teacher Access</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Enter the security passcode to open dashboard and settings.
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
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Instructor Passcode</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
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
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "👁️" : "🙈"}
              </button>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? "Authenticating..." : "Login & Show Settings"}
          </button>
        </form>
      </div>
    </div>
  );
}
