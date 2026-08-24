/**
 * Main Web App Entry Point & Router
 */

function handleAction(body) {
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
    deleteExam: handleDeleteExam,
    
    // Questions
    getQuestions: handleGetQuestions,
    deleteQuestion: handleDeleteQuestion,
    
    // Imports & Roster Management
    importStudents: handleImportStudents,
    importQuestions: handleImportQuestions,
    getStudents: handleGetStudents,
    addStudent: handleAddStudent,
    deleteStudent: handleDeleteStudent,
    
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
  
  const writeActions = [
    "createExam", "duplicateExam", "deleteExam",
    "importStudents", "importQuestions",
    "addStudent", "deleteStudent",
    "deleteQuestion",
    "startAttempt", "submitAnswer", "logViolation", "finishAttempt", "updateExamStatus"
  ];
  
  let result;
  if (writeActions.indexOf(action) !== -1) {
    result = runWithLock(function() {
      return handler(body);
    });
  } else {
    result = handler(body);
  }
  
  return jsonResponse(result);
}

// Handle GET requests (health check/ping or action requests)
function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action) {
      let body = e.parameter;
      if (e.parameter.data) {
        try {
          body = Object.assign({}, body, JSON.parse(e.parameter.data));
        } catch (err) {}
      }
      return handleAction(body);
    }
    
    return jsonResponse({
      status: "ok",
      message: "Proctor Exam API is active.",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// Handle POST requests
function doPost(e) {
  try {
    let body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      body = e.parameter;
    } else {
      return jsonResponse({ success: false, error: "Empty request body" });
    }
    
    return handleAction(body);
  } catch (error) {
    Logger.log("API Error: " + error.toString());
    return jsonResponse({ success: false, error: error.toString() });
  }
}
