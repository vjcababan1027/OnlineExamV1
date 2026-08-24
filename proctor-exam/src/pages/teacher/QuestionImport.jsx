import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { callApi } from '../../api/api';

export default function QuestionImport() {
  const navigate = useNavigate();
  const { examId } = useParams();
  const { teacherToken } = useAuth();
  
  const [rawText, setRawText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState('');

  // Existing questions state
  const [existingQuestions, setExistingQuestions] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [qSearchFilter, setQSearchFilter] = useState('');

  useEffect(() => {
    if (!teacherToken) {
      navigate('/teacher/login');
      return;
    }
    fetchExistingQuestions();
  }, [teacherToken]);

  const fetchExistingQuestions = async () => {
    setLoadingExisting(true);
    try {
      const data = await callApi('getQuestions', { token: teacherToken, examId });
      if (data.success) setExistingQuestions(data.questions || []);
    } catch (err) {
      console.error('Could not load questions:', err);
    } finally {
      setLoadingExisting(false);
    }
  };

  // Client-side delimiter parser
  useEffect(() => {
    if (!rawText.trim()) {
      setParsedQuestions([]);
      setParseErrors([]);
      return;
    }

    const lines = rawText.split('\n');
    const questionsList = [];
    const errorsList = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return; // Skip empty rows

      const cols = trimmed.split('|').map(col => col.trim());
      const rowNum = idx + 1;

      if (cols.length < 9) {
        errorsList.push(`Line ${rowNum}: Expected 9 columns, found ${cols.length}. Format: NUMBER|TYPE|QUESTION|A|B|C|D|ANSWER|POINTS`);
        return;
      }

      const [numStr, type, qText, a, b, c, d, answer, ptsStr] = cols;
      const number = parseInt(numStr, 10);
      const points = parseFloat(ptsStr);

      if (isNaN(number)) {
        errorsList.push(`Line ${rowNum}: Invalid question number "${numStr}"`);
        return;
      }

      if (isNaN(points)) {
        errorsList.push(`Line ${rowNum}: Invalid points value "${ptsStr}"`);
        return;
      }

      const upperType = type.toUpperCase();
      const validTypes = ['MCQ', 'TRUE_FALSE', 'IDENTIFICATION'];
      if (!validTypes.includes(upperType)) {
        errorsList.push(`Line ${rowNum}: Unknown question type "${type}". Must be MCQ, TRUE_FALSE, or IDENTIFICATION.`);
        return;
      }

      // Validate matching structures
      if (upperType === 'MCQ') {
        if (!a || !b || !c || !d) {
          errorsList.push(`Line ${rowNum}: MCQ requires option columns (A, B, C, D) to be non-empty.`);
          return;
        }
        if (!['A', 'B', 'C', 'D'].includes(answer.toUpperCase())) {
          errorsList.push(`Line ${rowNum}: MCQ correct answer must be one of: A, B, C, D.`);
          return;
        }
      } else if (upperType === 'TRUE_FALSE') {
        if (!['A', 'B', 'TRUE', 'FALSE', 'T', 'F'].includes(answer.toUpperCase())) {
          errorsList.push(`Line ${rowNum}: TRUE_FALSE answer must be A (True) or B (False).`);
          return;
        }
      }

      questionsList.push({
        number,
        type: upperType,
        questionText: qText,
        a: upperType === 'TRUE_FALSE' ? 'True' : a,
        b: upperType === 'TRUE_FALSE' ? 'False' : b,
        c: upperType === 'TRUE_FALSE' ? '' : c,
        d: upperType === 'TRUE_FALSE' ? '' : d,
        answer: answer.toUpperCase(),
        points
      });
    });

    setParsedQuestions(questionsList);
    setParseErrors(errorsList);
  }, [rawText]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    setSuccess('');

    if (parseErrors.length > 0) {
      setApiError("Please resolve all formatting errors before uploading.");
      return;
    }

    if (parsedQuestions.length === 0) {
      setApiError("Paste block is empty. Please supply at least one valid question.");
      return;
    }

    setLoading(true);
    try {
      const data = await callApi('importQuestions', {
        token: teacherToken,
        examId,
        questions: parsedQuestions
      });

      if (data.success) {
        setSuccess(`Question bank updated! Imported ${data.count} questions successfully.`);
        setRawText('');
        fetchExistingQuestions();
      } else {
        setApiError(data.error || "Failed to upload questions.");
      }
    } catch (err) {
      setApiError(err.message || "An error occurred updating Google Sheets.");
    } finally {
      setLoading(false);
    }
  };

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
        <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Import Questions</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Format details: Use pipe-delimited text blocks to batch-load your question library.
        </p>

        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '1rem',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          marginBottom: '1.5rem'
        }}>
          <strong>Delimited Template (Pasted row format):</strong><br />
          <code>NUMBER | TYPE | QUESTION_TEXT | OPTION_A | OPTION_B | OPTION_C | OPTION_D | ANSWER_KEY | POINTS</code><br />
          <strong style={{ display: 'block', marginTop: '0.5rem' }}>Sample Inputs:</strong>
          <code>1 | MCQ | What is 2+2? | 3 | 4 | 5 | 6 | B | 1.0</code><br />
          <code>2 | TRUE_FALSE | The Earth is flat. | | | | | B | 2.5</code><br />
          <code>3 | IDENTIFICATION | Who wrote Hamlet? | | | | | Shakespeare | 2.0</code>
        </div>

        {apiError && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            color: 'var(--danger)',
            fontSize: '0.85rem',
            marginBottom: '1.5rem'
          }}>
            {apiError}
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
            <label className="form-label">Delimited Paste Block</label>
            <textarea
              className="form-control"
              style={{ minHeight: '220px', fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
              placeholder="1|MCQ|Capital of France?|London|Paris|Rome|Berlin|B|1"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              required
            ></textarea>
          </div>

          {parseErrors.length > 0 && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              color: 'var(--danger)',
              fontSize: '0.8rem',
              maxHeight: '150px',
              overflowY: 'auto',
              marginBottom: '1.5rem'
            }}>
              <h5 style={{ color: 'var(--danger)', marginBottom: '0.5rem', fontWeight: 600 }}>Syntax Errors Found:</h5>
              <ul style={{ paddingLeft: '1.25rem' }}>
                {parseErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          {parsedQuestions.length > 0 && parseErrors.length === 0 && (
            <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Valid Questions Preview ({parsedQuestions.length})
              </h4>
              <div style={{
                maxHeight: '220px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(0,0,0,0.2)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)' }}>#</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Type</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Question</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Key</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedQuestions.map((q, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>{q.number}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}><span className="badge badge-active" style={{ fontSize: '0.65rem' }}>{q.type}</span></td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{q.questionText}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--accent)', fontWeight: 'bold' }}>{q.answer}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{q.points}</td>
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
              disabled={loading || parseErrors.length > 0}
            >
              {loading ? "Importing Bank..." : `Upload ${parsedQuestions.length} Questions`}
            </button>
          </div>
        </form>

        {/* Existing Questions Table */}
        <div style={{ marginTop: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem' }}>
              Current Question Bank ({existingQuestions.length})
            </h3>
            <input
              type="text"
              className="form-control"
              style={{ maxWidth: '250px', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
              placeholder="🔍 Search questions..."
              value={qSearchFilter}
              onChange={(e) => setQSearchFilter(e.target.value)}
            />
          </div>

          {loadingExisting ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <span style={{ fontSize: '1.8rem' }}>🔄</span>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.85rem' }}>Loading question bank...</p>
            </div>
          ) : existingQuestions.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '2.5rem 1rem',
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed var(--border-color)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>❓</span>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No questions uploaded yet. Use the import form above.</p>
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)', width: '40px' }}>#</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)', width: '110px' }}>Type</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Question</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)', width: '60px' }}>Key</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)', width: '60px' }}>Pts</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', color: 'var(--text-secondary)', width: '70px' }}>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {existingQuestions
                    .filter(q =>
                      !qSearchFilter ||
                      (q.questionText || '').toLowerCase().includes(qSearchFilter.toLowerCase()) ||
                      String(q.number).includes(qSearchFilter)
                    )
                    .map((q) => (
                      <tr key={q.questionId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)' }}>{q.number}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <span className="badge badge-active" style={{ fontSize: '0.65rem' }}>{q.type}</span>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>{q.questionText}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--accent)', fontWeight: 'bold' }}>{q.answer}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>{q.points}</td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            title="Delete this question"
                            onClick={async () => {
                              if (!window.confirm(`Delete question #${q.number}?\n"${q.questionText}"\n\nThis cannot be undone.`)) return;
                              try {
                                const res = await callApi('deleteQuestion', { token: teacherToken, examId, questionId: q.questionId });
                                if (res.success) {
                                  setExistingQuestions(prev => prev.filter(x => x.questionId !== q.questionId));
                                } else {
                                  alert('Failed to delete: ' + res.error);
                                }
                              } catch (err) {
                                alert('Error: ' + err.message);
                              }
                            }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
