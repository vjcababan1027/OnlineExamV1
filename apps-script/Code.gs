/**
 * Main Web App Entry Point & Router
 */

// Handle GET requests (health check/ping)
function doGet(e) {
  return jsonResponse({
    status: "ok",
    message: "Proctor Exam API is active.",
    timestamp: new Date().toISOString()
  });
}

// Handle POST requests
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: "Empty request body" });
    }
    
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    
    if (!action) {
      return jsonResponse({ success: false, error: "Missing 'action' parameter" });
    }
    
    // Register action handlers
    const handlers = {
      // Auth
      teacherLogin: handleTeacherLogin,
      changePasscode: handleChangePasscode,
      
      // Exams
      getExams: handleGetExams,
      createExam: handleCreateExam,
      duplicateExam: handleDuplicateExam,
      
      // Imports
      importStudents: handleImportStudents,
      importQuestions: handleImportQuestions,
      
      // Student verification & runner
      studentVerify: handleStudentVerify,
      getExamRoster: handleGetExamRoster,
      startAttempt: handleStartAttempt,
      submitAnswer: handleSubmitAnswer,
      logViolation: handleLogViolation,
      finishAttempt: handleFinishAttempt,
      
      // Grading & results
      getResults: handleGetResults,
      updateExamStatus: handleUpdateExamStatus
    };
    
    const handler = handlers[action];
    if (!handler) {
      return jsonResponse({ success: false, error: "Unknown action: " + action });
    }
    
    // Execute handler inside a thread lock where appropriate
    // Write actions should use locking
    const writeActions = ["createExam", "duplicateExam", "importStudents", "importQuestions", "startAttempt", "submitAnswer", "logViolation", "finishAttempt", "updateExamStatus"];
    
    let result;
    if (writeActions.indexOf(action) !== -1) {
      result = runWithLock(function() {
        return handler(body);
      });
    } else {
      result = handler(body);
    }
    
    return jsonResponse(result);
    
  } catch (error) {
    Logger.log("API Error: " + error.toString());
    return jsonResponse({ success: false, error: error.toString() });
  }
}
