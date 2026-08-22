import React, { createContext, useState, useContext, useEffect } from 'react';
import { callApi } from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [teacherToken, setTeacherToken] = useState(() => {
    return sessionStorage.getItem('PROCTOR_TEACHER_TOKEN') || '';
  });
  
  const [studentAttempt, setStudentAttempt] = useState(() => {
    const saved = sessionStorage.getItem('PROCTOR_STUDENT_ATTEMPT');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [apiUrl, setApiUrlState] = useState(() => {
    return import.meta.env.VITE_API_URL || localStorage.getItem('PROCTOR_API_URL') || '';
  });
  
  const setApiUrl = (url) => {
    localStorage.setItem('PROCTOR_API_URL', url);
    setApiUrlState(url);
  };
  
  const loginTeacher = async (passcode) => {
    try {
      const data = await callApi('teacherLogin', { passcode });
      if (data.success && data.token) {
        setTeacherToken(data.token);
        sessionStorage.setItem('PROCTOR_TEACHER_TOKEN', data.token);
        return { success: true };
      }
      return { success: false, error: data.error || "Invalid passcode" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };
  
  const logoutTeacher = () => {
    setTeacherToken('');
    sessionStorage.removeItem('PROCTOR_TEACHER_TOKEN');
  };
  
  const verifyStudent = async (examCode, studentId) => {
    try {
      const data = await callApi('studentVerify', { examCode, studentId });
      if (data.ok) {
        const attemptInfo = {
          studentId: data.studentId,
          studentName: data.studentName,
          examMeta: data.examMeta,
          attemptId: data.attemptId || null,
          resumed: data.resumed || false
        };
        setStudentAttempt(attemptInfo);
        sessionStorage.setItem('PROCTOR_STUDENT_ATTEMPT', JSON.stringify(attemptInfo));
        return { success: true, resumed: data.resumed || false };
      }
      return { success: false, error: data.error || "Verification failed" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };
  
  const updateStudentAttemptId = (attemptId) => {
    setStudentAttempt(prev => {
      if (!prev) return null;
      const updated = { ...prev, attemptId };
      sessionStorage.setItem('PROCTOR_STUDENT_ATTEMPT', JSON.stringify(updated));
      return updated;
    });
  };
  
  const logoutStudent = () => {
    setStudentAttempt(null);
    sessionStorage.removeItem('PROCTOR_STUDENT_ATTEMPT');
  };
  
  return (
    <AuthContext.Provider value={{
      teacherToken,
      studentAttempt,
      apiUrl,
      setApiUrl,
      loginTeacher,
      logoutTeacher,
      verifyStudent,
      updateStudentAttemptId,
      logoutStudent
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
