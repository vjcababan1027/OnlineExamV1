import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Import Pages
import RoleSelect from './pages/RoleSelect';
import TeacherLogin from './pages/teacher/Login';
import TeacherDashboard from './pages/teacher/Dashboard';
import CreateExam from './pages/teacher/CreateExam';
import StudentImport from './pages/teacher/StudentImport';
import QuestionImport from './pages/teacher/QuestionImport';
import Results from './pages/teacher/Results';
import Settings from './pages/teacher/Settings';

import StudentLogin from './pages/student/Login';
import PreExamInstructions from './pages/student/PreExamInstructions';
import ExamRunner from './pages/student/ExamRunner';
import ExamComplete from './pages/student/ExamComplete';

// Guard wrapper for Teacher pages
function TeacherGuard({ children }) {
  const { teacherToken } = useAuth();
  if (!teacherToken) {
    return <Navigate to="/teacher/login" replace />;
  }
  return children;
}

// Guard wrapper for Student pages
function StudentGuard({ children }) {
  const { studentAttempt } = useAuth();
  if (!studentAttempt) {
    return <Navigate to="/student/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/proctor-exam">
        <Routes>
          {/* Public Entrance */}
          <Route path="/" element={<RoleSelect />} />
          
          {/* Teacher Auth & Routes */}
          <Route path="/teacher/login" element={<TeacherLogin />} />
          
          <Route path="/teacher/dashboard" element={
            <TeacherGuard>
              <TeacherDashboard />
            </TeacherGuard>
          } />
          
          <Route path="/teacher/create-exam" element={
            <TeacherGuard>
              <CreateExam />
            </TeacherGuard>
          } />
          
          <Route path="/teacher/import-students/:examId" element={
            <TeacherGuard>
              <StudentImport />
            </TeacherGuard>
          } />
          
          <Route path="/teacher/import-questions/:examId" element={
            <TeacherGuard>
              <QuestionImport />
            </TeacherGuard>
          } />
          
          <Route path="/teacher/results/:examId" element={
            <TeacherGuard>
              <Results />
            </TeacherGuard>
          } />
          
          <Route path="/teacher/settings" element={
            <TeacherGuard>
              <Settings />
            </TeacherGuard>
          } />
          
          {/* Student Entrance & Runner */}
          <Route path="/student/login" element={<StudentLogin />} />
          
          <Route path="/student/instructions" element={
            <StudentGuard>
              <PreExamInstructions />
            </StudentGuard>
          } />
          
          <Route path="/exam/:attemptId" element={
            <StudentGuard>
              <ExamRunner />
            </StudentGuard>
          } />
          
          <Route path="/student/complete" element={<ExamComplete />} />
          
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
