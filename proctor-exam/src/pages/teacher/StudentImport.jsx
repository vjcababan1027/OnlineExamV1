import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { callApi } from '../../api/api';

export default function StudentImport() {
  const navigate = useNavigate();
  const { examId } = useParams();
  const { teacherToken } = useAuth();
  
  const [existingStudents, setExistingStudents] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  
  // Single Add form
  const [singleName, setSingleName] = useState('');
  const [singleSection, setSingleSection] = useState('');
  const [addingSingle, setAddingSingle] = useState(false);
  
  // Bulk Import form
  const [bulkMode, setBulkMode] = useState(false);
  const [rawText, setRawText] = useState('');
  const [bulkSection, setBulkSection] = useState('');
  const [previewList, setPreviewList] = useState([]);
  const [loadingBulk, setLoadingBulk] = useState(false);
  
  // Search filter
  const [searchFilter, setSearchFilter] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!teacherToken) {
      navigate('/teacher/login');
      return;
    }
    fetchStudents();
  }, [teacherToken, examId]);

  const fetchStudents = async () => {
    setLoadingList(true);
    try {
      const data = await callApi('getStudents', {
        token: teacherToken,
        examId
      });
      if (data.success) {
        setExistingStudents(data.students || []);
        if (data.students && data.students.length > 0 && !singleSection) {
          setSingleSection(data.students[0].section || '');
          setBulkSection(data.students[0].section || '');
        }
      }
    } catch (err) {
      console.error("Failed to load students", err);
    } finally {
      setLoadingList(false);
    }
  };

  // Handle parsing on text change
  useEffect(() => {
    const lines = rawText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    setPreviewList(lines);
  }, [rawText]);

  // Handle adding a single student
  const handleAddSingle = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!singleName.trim() || !singleSection.trim()) {
      setError("Please provide both Student Name and Section.");
      return;
    }

    setAddingSingle(true);
    try {
      const data = await callApi('addStudent', {
        token: teacherToken,
        examId,
        name: singleName.trim(),
        section: singleSection.trim()
      });

      if (data.success && data.student) {
        setSuccess(`Student '${data.student.name}' added with ID: ${data.student.studentId}`);
        setSingleName('');
        setExistingStudents(prev => [...prev, data.student]);
      } else {
        setError(data.error || "Failed to add student.");
      }
    } catch (err) {
      setError(err.message || "Failed to add student.");
    } finally {
      setAddingSingle(false);
    }
  };

  // Handle Bulk Import
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!bulkSection.trim()) {
      setError("Please specify the Section for the students.");
      return;
    }
    
    if (previewList.length === 0) {
      setError("Roster paste block is empty. Add at least one name.");
      return;
    }
    
    setLoadingBulk(true);
    try {
      const data = await callApi('importStudents', {
        token: teacherToken,
        examId,
        section: bulkSection.trim(),
        students: previewList
      });
      
      if (data.success) {
        setSuccess(`Successfully added ${data.count} new students to the roster!`);
        setRawText('');
        setBulkMode(false);
        fetchStudents();
      } else {
        setError(data.error || "Roster upload failed.");
      }
    } catch (err) {
      setError(err.message || "An error occurred writing student entries.");
    } finally {
      setLoadingBulk(false);
    }
  };

  // Handle Delete Student
  const handleDelete = async (studentId, name) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" (${studentId}) from this exam roster?`)) {
      return;
    }

    try {
      const data = await callApi('deleteStudent', {
        token: teacherToken,
        examId,
        studentId
      });

      if (data.success) {
        setExistingStudents(prev => prev.filter(s => s.studentId !== studentId));
        setSuccess(`Student "${name}" removed from roster.`);
      } else {
        setError(data.error || "Failed to delete student.");
      }
    } catch (err) {
      setError(err.message || "Failed to delete student.");
    }
  };

  const filteredStudents = existingStudents.filter(s => 
    (s.name || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
    (s.studentId || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
    (s.section || '').toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '900px' }}>
      <button 
        className="btn btn-secondary" 
        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}
        onClick={() => navigate('/teacher/dashboard')}
      >
        ← Back to Dashboard
      </button>
      
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Exam Student Roster</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Manage registered students and add new ones. Each student uses their generated ID to take the exam.
            </p>
          </div>
          <button 
            className="btn btn-secondary"
            onClick={() => setBulkMode(!bulkMode)}
            style={{ fontSize: '0.85rem' }}
          >
            {bulkMode ? "Switch to Single Add" : "📋 Bulk Paste Roster"}
          </button>
        </div>

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

        {/* Add Student Form */}
        {!bulkMode ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginBottom: '2rem'
          }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>➕</span> Add Student to Roster
            </h3>
            <form onSubmit={handleAddSingle} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Student Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Juan Dela Cruz"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Section *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Section A"
                  value={singleSection}
                  onChange={(e) => setSingleSection(e.target.value)}
                  required
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ height: '42px', minWidth: '120px', background: 'linear-gradient(135deg, var(--accent) 0%, #0d9488 100%)' }}
                disabled={addingSingle}
              >
                {addingSingle ? "Adding..." : "+ Add Student"}
              </button>
            </form>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginBottom: '2rem'
          }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📋</span> Bulk Import Roster Names
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Paste one full name per line to append multiple students at once.
            </p>
            <form onSubmit={handleBulkSubmit}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>Section Code (e.g. Section A)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Section A"
                  value={bulkSection}
                  onChange={(e) => setBulkSection(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>Paste Names (One name per line)</label>
                <textarea
                  className="form-control"
                  style={{ minHeight: '140px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                  placeholder="Alice Vance&#10;Bob Smith&#10;Charlie Brown"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  required
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setBulkMode(false)}>Cancel</button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #0d9488 100%)' }}
                  disabled={loadingBulk || previewList.length === 0}
                >
                  {loadingBulk ? "Adding..." : `Import ${previewList.length} Students`}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Existing Roster List Table */}
        <div style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem' }}>
              Enrolled Students ({existingStudents.length})
            </h3>
            <input
              type="text"
              className="form-control"
              style={{ maxWidth: '250px', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
              placeholder="🔍 Search name or ID..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>

          {loadingList ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <span style={{ fontSize: '1.8rem' }}>🔄</span>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.85rem' }}>Loading roster from database...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed var(--border-color)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>👥</span>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {searchFilter ? "No students match your search filter." : "No students added yet. Use the form above to add students to this exam."}
              </p>
            </div>
          ) : (
            <div style={{
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              overflowX: 'auto'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', width: '60px' }}>#</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Student ID</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Full Name</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Section</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', width: '80px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((stu, index) => (
                    <tr key={stu.studentId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{index + 1}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <code style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                          {stu.studentId}
                        </code>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{stu.name}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{stu.section}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          title="Remove student"
                          onClick={() => handleDelete(stu.studentId, stu.name)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

