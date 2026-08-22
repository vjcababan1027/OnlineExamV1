import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { callApi } from '../../api/api';

export default function Results() {
  const navigate = useNavigate();
  const { examId } = useParams();
  const { teacherToken } = useAuth();
  
  const [resultsData, setResultsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Selected Student Drilldown Modal State
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetailsModalOpen, setStudentDetailsModalOpen] = useState(false);

  const fetchResults = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await callApi('getResults', {
        token: teacherToken,
        examId
      });
      if (data.success) {
        setResultsData(data);
      } else {
        setError(data.error || "Failed to load results sheets.");
      }
    } catch (err) {
      setError(err.message || "Failed to query Google Sheets database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!teacherToken) {
      navigate('/teacher/login');
      return;
    }
    fetchResults();
  }, [teacherToken, examId]);

  // Client-Side CSV Exporter
  const handleExportCSV = () => {
    if (!resultsData || resultsData.rows.length === 0) return;
    
    const headers = ["Student ID", "Student Name", "Section", "Status", "Start Time", "End Time", "Raw Score", "Violation Count", "Deductions", "Final Score"];
    const csvRows = [headers.join(",")];
    
    resultsData.rows.forEach(r => {
      const rowData = [
        `"${r.studentId}"`,
        `"${r.studentName}"`,
        `"${r.section}"`,
        `"${r.status}"`,
        `"${r.startTime || ''}"`,
        `"${r.endTime || ''}"`,
        r.rawScore !== null ? r.rawScore : '""',
        r.violationCount,
        r.deduction !== null ? r.deduction : '""',
        r.finalScore !== null ? r.finalScore : '""'
      ];
      csvRows.push(rowData.join(","));
    });
    
    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `exam_results_${examId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Detailed Modal
  const openStudentDetails = (studentRow) => {
    if (studentRow.status === 'Not Started') {
      alert("No logs available. Student has not started the exam yet.");
      return;
    }
    
    const attemptId = studentRow.attemptId;
    const studentAnswers = resultsData.answers ? resultsData.answers[attemptId] || [] : [];
    const studentViolations = resultsData.violations ? resultsData.violations.filter(v => v.studentId === studentRow.studentId) : [];
    
    setSelectedStudent({
      ...studentRow,
      answers: studentAnswers,
      violations: studentViolations
    });
    setStudentDetailsModalOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="container min-vh-100 flex-center">
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '2.5rem' }}>🔄</span>
          <h3 style={{ marginTop: '1rem' }}>Compiling attempt grades and violation logs...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container animate-fade-in" style={{ maxWidth: '650px' }}>
        <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={() => navigate('/teacher/dashboard')}>← Back</button>
        <div className="glass-card text-center">
          <span style={{ fontSize: '3rem' }}>❌</span>
          <h3 style={{ margin: '1.5rem 0' }}>Grading Sheets Failure</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={fetchResults}>Retry Query</button>
        </div>
      </div>
    );
  }

  const { summary, rows } = resultsData;

  return (
    <div className="container animate-fade-in print-container">
      
      {/* Print CSS Inject */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .glass-card {
            border: 1px solid #ccc !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
          }
          .btn, header, .no-print {
            display: none !important;
          }
          .text-gradient {
            background: none !important;
            -webkit-text-fill-color: black !important;
            color: black !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #ccc !important;
            color: black !important;
            padding: 8px !important;
          }
        }
      `}</style>

      {/* Header */}
      <header className="no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '1.5rem',
        marginBottom: '2.5rem'
      }}>
        <div>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', marginBottom: '0.75rem', display: 'block' }}
            onClick={() => navigate('/teacher/dashboard')}
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-gradient" style={{ fontSize: '1.8rem' }}>Examination Results</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Detailed student scoring matrix and proctoring log logs.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handlePrint}>🖨️ Print View</button>
          <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #0d9488 100%)' }} onClick={handleExportCSV}>💾 Export CSV</button>
        </div>
      </header>

      {/* Summary Row */}
      <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: '2.5rem', gap: '1.25rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Roster Slots</span>
          <h3 style={{ fontSize: '2rem', marginTop: '0.25rem' }}>{summary.registered}</h3>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>In-Progress</span>
          <h3 style={{ fontSize: '2rem', marginTop: '0.25rem', color: 'var(--warning)' }}>{summary.started}</h3>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Submitted</span>
          <h3 style={{ fontSize: '2rem', marginTop: '0.25rem', color: 'var(--success)' }}>{summary.completed}</h3>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Class Average</span>
          <h3 style={{ fontSize: '2rem', marginTop: '0.25rem', color: 'var(--primary)' }}>
            {summary.averageScore} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ {summary.totalPossiblePoints}</span>
          </h3>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>High / Low</span>
          <h3 style={{ fontSize: '1.5rem', marginTop: '0.5rem', color: 'var(--accent)' }}>{summary.highestScore} <span style={{ color: 'var(--text-muted)' }}>/</span> {summary.lowestScore}</h3>
        </div>
      </div>

      {/* Main Results Table */}
      <div className="glass-card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '1.25rem' }}>Grades & Audits</h2>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '700px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Student Name</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Student ID</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Section</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Violations</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Raw Score</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Deductions</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Final Score</th>
              <th className="no-print" style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{row.studentName}</td>
                <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>{row.studentId}</td>
                <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>{row.section}</td>
                <td style={{ padding: '0.85rem 1rem' }}>
                  <span className={`badge ${
                    row.status === 'Finished' ? 'badge-active' : 
                    row.status === 'Auto-Submitted' ? 'badge-closed' :
                    row.status === 'Started' ? 'badge-active' : ''
                  }`} style={{
                    background: row.status === 'Not Started' ? 'rgba(255,255,255,0.05)' : undefined,
                    color: row.status === 'Not Started' ? 'var(--text-muted)' : undefined,
                    borderColor: row.status === 'Not Started' ? 'var(--border-color)' : undefined
                  }}>
                    {row.status}
                  </span>
                </td>
                <td style={{ padding: '0.85rem 1rem' }}>
                  {row.violationCount > 0 ? (
                    <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>⚠️ {row.violationCount}</span>
                  ) : (
                    <span style={{ color: 'var(--success)' }}>✓ 0</span>
                  )}
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>{row.rawScore !== null ? row.rawScore : '-'}</td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: row.deduction > 0 ? 'var(--danger)' : undefined }}>
                  {row.deduction !== null ? `-${row.deduction}` : '-'}
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 'bold', fontSize: '1rem', color: row.finalScore !== null ? 'var(--accent)' : undefined }}>
                  {row.finalScore !== null ? `${row.finalScore} / ${summary.totalPossiblePoints}` : '-'}
                </td>
                <td className="no-print" style={{ padding: '0.85rem 1rem' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                    onClick={() => openStudentDetails(row)}
                    disabled={row.status === 'Not Started'}
                  >
                    🔍 Inspect Logs
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Student Details Drilldown Modal */}
      {studentDetailsModalOpen && selectedStudent && (
        <div className="no-print" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 11, 16, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1.5rem'
        }}>
          <div className="glass-card animate-fade-in" style={{
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--bg-secondary)',
            border: '1px solid rgba(255, 255, 255, 0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <span className="badge badge-active" style={{ marginBottom: '0.5rem' }}>Attempt Audit</span>
                <h3 style={{ fontSize: '1.5rem' }}>{selectedStudent.studentName}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ID: {selectedStudent.studentId} | Section: {selectedStudent.section}</p>
              </div>
              <button className="btn btn-secondary" onClick={() => setStudentDetailsModalOpen(false)}>✕ Close</button>
            </div>

            {/* Sub-row statistics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</span><br />
                <strong style={{ fontSize: '1.1rem' }}>{selectedStudent.status}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Raw Score</span><br />
                <strong style={{ fontSize: '1.1rem' }}>{selectedStudent.rawScore} points</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Violation Count</span><br />
                <strong style={{ fontSize: '1.1rem', color: selectedStudent.violationCount > 0 ? 'var(--danger)' : undefined }}>{selectedStudent.violationCount} logged</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Final Grade</span><br />
                <strong style={{ fontSize: '1.15rem', color: 'var(--accent)' }}>{selectedStudent.finalScore} / {summary.totalPossiblePoints}</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
              
              {/* Violations Log Block */}
              <div>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', color: 'var(--danger)' }}>⚠️ Activity Security Log ({selectedStudent.violations.length})</h4>
                {selectedStudent.violations.length === 0 ? (
                  <div style={{ padding: '0.75rem', color: 'var(--success)', background: 'rgba(16,185,129,0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16,185,129,0.15)', fontSize: '0.85rem' }}>
                    Perfect Score Integrity! No browser defocusing or fullscreen exits were logged during this attempt.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', maxHeight: '180px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Event Type</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Database Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStudent.violations.map((v, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '0.5rem 0.75rem', color: 'var(--danger)', fontWeight: 'bold' }}>{v.type}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{new Date(v.timestamp).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Answers Key Breakdown */}
              <div>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>📝 Question Response Analysis ({selectedStudent.answers.length})</h4>
                {selectedStudent.answers.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No answers saved.</p>
                ) : (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', maxHeight: '250px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Q#</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Question Text</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Correct Key</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Response</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Result</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Time Spent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStudent.answers.map((ans, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{ans.questionNumber}</td>
                            <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-secondary)' }}>{ans.questionText}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 'bold' }}>{ans.correctAnswer}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 'bold', color: ans.isCorrect ? 'var(--success)' : 'var(--danger)' }}>
                              {ans.studentAnswer || '[Empty]'}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                              {ans.isCorrect ? (
                                <span style={{ color: 'var(--success)' }}>✓ Correct</span>
                              ) : (
                                <span style={{ color: 'var(--danger)' }}>✗ Incorrect</span>
                              )}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{ans.timeUsed}s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
