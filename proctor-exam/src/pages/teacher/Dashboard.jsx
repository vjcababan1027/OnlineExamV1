import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { callApi } from '../../api/api';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { teacherToken, logoutTeacher } = useAuth();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Duplication Modal State
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newSection, setNewSection] = useState('');
  const [newCode, setNewCode] = useState('');
  const [duplicating, setDuplicating] = useState(false);
  
  const fetchExams = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await callApi('getExams', { token: teacherToken });
      if (data.success) {
        setExams(data.exams || []);
      } else {
        setError(data.error || "Failed to load exams.");
      }
    } catch (err) {
      setError(err.message || "Failed to contact API server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!teacherToken) {
      navigate('/teacher/login');
      return;
    }
    fetchExams();
  }, [teacherToken]);
  
  const handleToggleStatus = async (examId, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Closed' : 'Active';
    try {
      const data = await callApi('updateExamStatus', {
        token: teacherToken,
        examId,
        status: nextStatus
      });
      if (data.success) {
        setExams(prev => prev.map(e => e['Exam ID'] === examId ? { ...e, Status: nextStatus } : e));
      } else {
        alert("Failed to update status: " + data.error);
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleDeleteExam = async (examId, title) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${title}" and all related attempts and question records?`)) {
      return;
    }
    
    try {
      const data = await callApi('deleteExam', {
        token: teacherToken,
        examId
      });
      if (data.success) {
        setExams(prev => prev.filter(e => e['Exam ID'] !== examId));
        alert("Exam deleted successfully.");
      } else {
        alert("Failed to delete exam: " + data.error);
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };
  
  
  const openDuplicateModal = (examId, title) => {
    setSelectedExamId(examId);
    setNewTitle(title ? `${title} (Copy)` : '');
    setNewSection('');
    setNewCode('');
    setDuplicateModalOpen(true);
  };
  
  const handleDuplicate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSection.trim() || !newCode.trim()) return;
    
    setDuplicating(true);
    try {
      const data = await callApi('duplicateExam', {
        token: teacherToken,
        examId: selectedExamId,
        newTitle: newTitle.trim(),
        newSection: newSection.trim(),
        newCode: newCode.trim().toUpperCase()
      });
      
      if (data.success) {
        setDuplicateModalOpen(false);
        fetchExams();
        alert("Exam duplicated successfully!");
      } else {
        alert("Failed to duplicate: " + data.error);
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setDuplicating(false);
    }
  };
  
  const handleLogout = () => {
    logoutTeacher();
    navigate('/');
  };

  const activeExamsCount = exams.filter(e => e['Status'] === 'Active').length;
  const closedExamsCount = exams.filter(e => e['Status'] === 'Closed').length;

  return (
    <div className="container animate-fade-in">
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '1.5rem',
        marginBottom: '2.5rem'
      }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2rem' }}>Teacher Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Manage exams, view grading status, and export statistics.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/teacher/settings')}>⚙️ Settings</button>
          <button className="btn btn-danger" onClick={handleLogout}>Log Out</button>
        </div>
      </header>

      {/* Stats row */}
      <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '2.5rem', gap: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h3 style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '0.25rem' }}>{exams.length}</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Exams</span>
        </div>
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h3 style={{ fontSize: '2.5rem', color: 'var(--accent)', marginBottom: '0.25rem' }}>{activeExamsCount}</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Sessions</span>
        </div>
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h3 style={{ fontSize: '2.5rem', color: 'var(--danger)', marginBottom: '0.25rem' }}>{closedExamsCount}</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Closed Sessions</span>
        </div>
      </div>

      {/* Exam creation panel header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Exam Roster List</h2>
        <button className="btn btn-primary" onClick={() => navigate('/teacher/create-exam')}>+ Create New Exam</button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '1rem',
          color: 'var(--danger)',
          marginBottom: '2rem'
        }}>
          {error}
          <button className="btn btn-secondary" style={{ marginLeft: '1rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={fetchExams}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <span style={{ fontSize: '2rem' }}>🔄</span>
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Querying Google Sheets database...</p>
        </div>
      ) : exams.length === 0 ? (
        <div className="glass-card text-center" style={{ padding: '4rem 2rem' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📝</span>
          <h3 style={{ marginBottom: '0.5rem' }}>No exams created yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
            Get started by creating a new examination structure, then import your students roster and questions.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/teacher/create-exam')}>Create First Exam</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          {exams.map(exam => {
            const examId = exam['Exam ID'];
            const status = exam['Status'] || 'Active';
            return (
              <div key={examId} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                      <h3 style={{ fontSize: '1.3rem' }}>{exam['Title']}</h3>
                      <span className={`badge ${status === 'Active' ? 'badge-active' : 'badge-closed'}`}>
                        {status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span>🔑 Code: <strong style={{ color: '#fff' }}>{exam['Code']}</strong></span>
                      <span>🏫 Section: <strong style={{ color: '#fff' }}>{exam['Section']}</strong></span>
                      <span>⏱️ Duration: <strong style={{ color: '#fff' }}>{exam['Duration (Mins)']}m</strong></span>
                      {exam['Start Time'] && (
                        <span>📅 Start: {new Date(exam['Start Time']).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => navigate(`/teacher/results/${examId}`)}>📊 Results</button>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => navigate(`/teacher/import-students/${examId}`)}>👥 Roster</button>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => navigate(`/teacher/import-questions/${examId}`)}>❓ Questions</button>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => openDuplicateModal(examId, exam['Title'])}>📋 Duplicate</button>
                    <button 
                      className="btn" 
                      style={{ 
                        padding: '0.5rem 1rem', 
                        fontSize: '0.85rem', 
                        background: status === 'Active' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid ' + (status === 'Active' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'),
                        color: status === 'Active' ? 'var(--danger)' : 'var(--success)'
                      }}
                      onClick={() => handleToggleStatus(examId, status)}
                    >
                      {status === 'Active' ? '🔒 Close' : '🔓 Activate'}
                    </button>
                    <button 
                      className="btn" 
                      style={{ 
                        padding: '0.5rem 1rem', 
                        fontSize: '0.85rem', 
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: 'var(--danger)'
                      }}
                      onClick={() => handleDeleteExam(examId, exam['Title'])}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Duplicate Modal */}
      {duplicateModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '450px', background: 'var(--bg-secondary)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Duplicate Exam</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Creates a copy of exam details and questions. Rosters, attempts, and violation logs will be reset.
            </p>
            
            <form onSubmit={handleDuplicate}>
              <div className="form-group">
                <label className="form-label">Exam Title / Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Midterm Examination - Calculus (Copy)"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Section (e.g. Section B)</label>
                <input
                  type="text"
                  className="form-control"
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  placeholder="e.g. Section B"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Exam Code</label>
                <input
                  type="text"
                  className="form-control"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="e.g. MATH101-B"
                  required
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setDuplicateModalOpen(false)} disabled={duplicating}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={duplicating}>
                  {duplicating ? "Duplicating..." : "Confirm Duplicate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
