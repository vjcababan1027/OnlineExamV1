import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { callApi } from '../../api/api';

export default function StudentImport() {
  const navigate = useNavigate();
  const { examId } = useParams();
  const { teacherToken } = useAuth();
  const fileInputRef = useRef(null);
  const bannerRef = useRef(null);
  
  const [existingStudents, setExistingStudents] = useState([]);
  const [examMeta, setExamMeta] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  
  // Single Add form
  const [singleName, setSingleName] = useState('');
  const [singleStudentId, setSingleStudentId] = useState('');
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
    fetchStudentsAndExam();
  }, [teacherToken, examId]);

  const scrollToBanner = () => {
    if (bannerRef.current) {
      bannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const fetchStudentsAndExam = async () => {
    setLoadingList(true);
    try {
      // 1. Fetch Students
      const studentData = await callApi('getStudents', {
        token: teacherToken,
        examId
      });
      if (studentData.success) {
        setExistingStudents(studentData.students || []);
      }

      // 2. Fetch Exams to get this exam's default section
      const examsData = await callApi('getExams', { token: teacherToken });
      if (examsData.success && examsData.exams) {
        const currentExam = examsData.exams.find(e => String(e['Exam ID']).trim() === String(examId).trim());
        if (currentExam) {
          setExamMeta(currentExam);
          const defaultSec = currentExam['Section'] || 'Section A';
          setSingleSection(prev => prev || defaultSec);
          setBulkSection(prev => prev || defaultSec);
        }
      }
    } catch (err) {
      console.error("Failed to load students or exam info", err);
    } finally {
      setLoadingList(false);
    }
  };

  // Smart parser on text change (handles newlines and CSV lines)
  useEffect(() => {
    if (!rawText.trim()) {
      setPreviewList([]);
      return;
    }
    
    // Split by newlines first
    let lines = rawText.split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Ignore typical CSV header row
    if (lines.length > 0) {
      const firstLineLower = lines[0].toLowerCase();
      if (firstLineLower.includes('student') && (firstLineLower.includes('name') || firstLineLower.includes('id'))) {
        lines = lines.slice(1);
      }
    }

    setPreviewList(lines);
  }, [rawText]);

  // Handle File Upload (.csv, .txt)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result || '';
      setRawText(content);
      setBulkMode(true);
      setError('');
      setSuccess(`Loaded file "${file.name}". Review names below and click "Import Students".`);
      scrollToBanner();
    };
    reader.onerror = () => {
      setError("Failed to read the selected file. Please try copy-pasting the content.");
      scrollToBanner();
    };
    reader.readAsText(file);
    // Reset file input so same file can be re-selected if needed
    e.target.value = '';
  };

  // Handle adding a single student
  const handleAddSingle = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!singleName.trim()) {
      setError("Please provide the Student's Full Name.");
      scrollToBanner();
      return;
    }

    const sectionToUse = singleSection.trim() || (examMeta && examMeta['Section']) || 'Section A';

    setAddingSingle(true);
    try {
      const data = await callApi('addStudent', {
        token: teacherToken,
        examId,
        name: singleName.trim(),
        section: sectionToUse,
        studentId: singleStudentId.trim() || undefined
      });

      if (data.success && data.student) {
        setSuccess(`Student "${data.student.name}" added successfully with ID: ${data.student.studentId}`);
        setSingleName('');
        setSingleStudentId('');
        await fetchStudentsAndExam();
      } else {
        setError(`Failed to add student: ${data.error || 'Unknown error from server'}`);
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setAddingSingle(false);
      scrollToBanner();
    }
  };

  // Handle Bulk Import
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (previewList.length === 0) {
      setError("Please paste student names or upload a file before clicking Import.");
      scrollToBanner();
      return;
    }

    const sectionToUse = bulkSection.trim() || (examMeta && examMeta['Section']) || 'Section A';
    
    setLoadingBulk(true);
    try {
      const data = await callApi('importStudents', {
        token: teacherToken,
        examId,
        section: sectionToUse,
        students: previewList
      });
      
      if (data.success) {
        setSuccess(`Successfully added ${data.count} new students to the roster!`);
        setRawText('');
        setBulkMode(false);
        fetchStudentsAndExam();
      } else {
        setError(data.error || "Roster upload failed.");
      }
    } catch (err) {
      setError(err.message || "An error occurred writing student entries.");
    } finally {
      setLoadingBulk(false);
      scrollToBanner();
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
    } finally {
      scrollToBanner();
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
              {examMeta ? `${examMeta['Title']} (${examMeta['Code']})` : 'Manage registered students'}
            </p>
          </div>
          
          {/* Mode Switcher Tabs */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.06)', borderRadius: 'var(--radius-sm)', padding: '0.25rem', gap: '0.25rem' }}>
            <button 
              type="button"
              className="btn"
              onClick={() => { setBulkMode(false); setError(''); }}
              style={{
                fontSize: '0.85rem',
                padding: '0.4rem 0.8rem',
                background: !bulkMode ? 'var(--primary)' : 'transparent',
                color: !bulkMode ? '#fff' : 'var(--text-secondary)',
                border: 'none'
              }}
            >
              ➕ Single Add
            </button>
            <button 
              type="button"
              className="btn"
              onClick={() => { setBulkMode(true); setError(''); }}
              style={{
                fontSize: '0.85rem',
                padding: '0.4rem 0.8rem',
                background: bulkMode ? 'var(--primary)' : 'transparent',
                color: !bulkMode ? 'var(--text-secondary)' : '#fff',
                border: 'none'
              }}
            >
              📋 Bulk Paste / CSV
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        <div ref={bannerRef}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem 1.1rem',
              color: 'var(--danger)',
              fontSize: '0.9rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
          
          {success && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem 1.1rem',
              color: 'var(--success)',
              fontSize: '0.9rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>✅</span>
              <span>{success}</span>
            </div>
          )}
        </div>

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
            <form onSubmit={handleAddSingle} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
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
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Student ID (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Auto-generated if empty"
                  value={singleStudentId}
                  onChange={(e) => setSingleStudentId(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Section</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Section A"
                  value={singleSection}
                  onChange={(e) => setSingleSection(e.target.value)}
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ height: '42px', minWidth: '120px', background: 'linear-gradient(135deg, var(--accent) 0%, #0d9488 100%)' }}
                disabled={addingSingle}
              >
                {addingSingle ? 'Adding...' : '+ Add Student'}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📋</span> Bulk Import Roster Names
              </h3>

              {/* Upload CSV / TXT Button */}
              <div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".csv,.txt" 
                  style={{ display: 'none' }} 
                  onChange={handleFileUpload} 
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  📁 Upload .CSV / .TXT File
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.5' }}>
              Paste one student per line or upload a CSV. Supported formats: <code>Full Name</code> (e.g. <em>Juan Dela Cruz</em> or <em>Dela Cruz, Juan</em>) or with ID like <code>2024-001, Juan Dela Cruz</code> or <code>ID | Name | Section</code>. IDs are auto-generated if omitted.
            </p>

            <form onSubmit={handleBulkSubmit}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>Default Section</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Section A"
                  value={bulkSection}
                  onChange={(e) => setBulkSection(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Paste Names / Rows</span>
                  <span style={{ color: previewList.length > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {previewList.length} student{previewList.length === 1 ? '' : 's'} detected
                  </span>
                </label>
                <textarea
                  className="form-control"
                  style={{ minHeight: '140px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                  placeholder={"Juan Dela Cruz\nDela Cruz, Maria\n2024-001, Carlos Garcia\nSTU-555 | Sarah Connor | Section A"}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setRawText(''); setBulkMode(false); }}>Cancel</button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #0d9488 100%)' }}
                  disabled={loadingBulk}
                >
                  {loadingBulk ? "Importing Roster..." : (previewList.length > 0 ? `Import ${previewList.length} Students` : "Import Students")}
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
                        <code style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
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
