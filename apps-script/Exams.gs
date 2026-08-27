/**
 * Exam Management Backend Logic
 */

// Retrieve all exams for the teacher dashboard
function handleGetExams(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  try {
    const exams = getRowsAsObjects("Exams");
    return { success: true, exams: exams };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Create a new exam entry
function handleCreateExam(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  try {
    const examData = body.exam;
    if (!examData.title || !examData.code || !examData.section) {
      return { success: false, error: "Missing required exam details (title, code, section)" };
    }
    
    // Check if code is already used for an active exam
    const existingExams = getRowsAsObjects("Exams");
    const codeMatch = existingExams.find(e => e["Code"] === examData.code);
    if (codeMatch) {
      return { success: false, error: "Exam Code '" + examData.code + "' is already in use." };
    }
    
    const examId = generateUUID();
    const newExamRow = {
      "Exam ID": examId,
      "Title": examData.title,
      "Code": examData.code,
      "Section": examData.section,
      "Duration (Mins)": Number(examData.duration) || 60,
      "Start Time": examData.startTime || "",
      "End Time": examData.endTime || "",
      "Deduction": Number(examData.deduction) || 0,
      "Max Violations": Number(examData.maxViolations) || 3,
      "Randomize": examData.randomize ? "TRUE" : "FALSE",
      "Timer Mode": examData.timerMode || "per_question",
      "Per Question Sec": Number(examData.perQuestionSec) || 60,
      "Status": "Active",
      "Created At": new Date().toISOString()
    };
    
    insertRow("Exams", newExamRow);
    return { success: true, examId: examId };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Duplicate an exam (copies structure and questions, resets results/attempts)
function handleDuplicateExam(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  try {
    const { examId, newTitle, newSection, newCode } = body;
    if (!examId || !newSection || !newCode) {
      return { success: false, error: "Missing examId, newSection, or newCode" };
    }
    
    // Check if newCode is already in use
    const exams = getRowsAsObjects("Exams");
    const formattedCode = String(newCode).trim().toUpperCase();
    const codeMatch = exams.find(e => String(e["Code"]).trim().toUpperCase() === formattedCode);
    if (codeMatch) {
      return { success: false, error: "New Exam Code '" + formattedCode + "' is already in use." };
    }
    
    // Find source exam
    const sourceExam = exams.find(e => String(e["Exam ID"]).trim() === String(examId).trim());
    if (!sourceExam) {
      return { success: false, error: "Source exam not found" };
    }
    
    const finalTitle = newTitle && String(newTitle).trim() ? String(newTitle).trim() : (sourceExam["Title"] + " (Copy)");
    const newExamId = generateUUID();
    const newExamRow = {
      "Exam ID": newExamId,
      "Title": finalTitle,
      "Code": formattedCode,
      "Section": String(newSection).trim(),
      "Duration (Mins)": sourceExam["Duration (Mins)"],
      "Start Time": sourceExam["Start Time"],
      "End Time": sourceExam["End Time"],
      "Deduction": sourceExam["Deduction"],
      "Max Violations": sourceExam["Max Violations"],
      "Randomize": sourceExam["Randomize"],
      "Timer Mode": sourceExam["Timer Mode"] || "per_question",
      "Per Question Sec": sourceExam["Per Question Sec"] || 60,
      "Status": "Active",
      "Created At": new Date().toISOString()
    };
    
    // 1. Insert new exam
    insertRow("Exams", newExamRow);
    
    // 2. Fetch and duplicate questions
    const allQuestions = getRowsAsObjects("Questions");
    const sourceQuestions = allQuestions.filter(q => String(q["Exam ID"]).trim() === String(examId).trim());
    
    sourceQuestions.forEach(q => {
      const newQuestionRow = {
        "Question ID": generateUUID(),
        "Exam ID": newExamId,
        "Number": q["Number"],
        "Type": q["Type"],
        "Question Text": q["Question Text"],
        "A": q["A"],
        "B": q["B"],
        "C": q["C"],
        "D": q["D"],
        "Answer": q["Answer"],
        "Points": q["Points"],
        "Time Limit (Sec)": q["Time Limit (Sec)"] || ""
      };
      insertRow("Questions", newQuestionRow);
    });
    
    return { success: true, newExamId: newExamId };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Update status of an exam (e.g. Active vs. Closed)
function handleUpdateExamStatus(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  try {
    const { examId, status } = body;
    if (!examId || !status) {
      return { success: false, error: "Missing examId or status" };
    }
    
    const updated = updateRow("Exams", "Exam ID", examId, { "Status": status });
    if (updated) {
      return { success: true };
    } else {
      return { success: false, error: "Exam not found" };
    }
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Delete an exam and cascade delete all its questions, students, and attempt logs
function handleDeleteExam(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  try {
    const examId = body.examId;
    if (!examId) return { success: false, error: "Missing examId" };
    
    // 1. Delete from Exams sheet
    const examSheet = getOrCreateSheet("Exams");
    const lastRowExams = examSheet.getLastRow();
    if (lastRowExams > 1) {
      const examValues = examSheet.getRange(2, 1, lastRowExams - 1, 1).getValues();
      for (let i = lastRowExams; i >= 2; i--) {
        if (examValues[i - 2][0] == examId) {
          examSheet.deleteRow(i);
        }
      }
    }
    
    // 2. Cascade delete from Questions
    const qSheet = getOrCreateSheet("Questions");
    const lastRowQ = qSheet.getLastRow();
    if (lastRowQ > 1) {
      const qValues = qSheet.getRange(2, 2, lastRowQ - 1, 1).getValues();
      for (let i = lastRowQ; i >= 2; i--) {
        if (qValues[i - 2][0] == examId) {
          qSheet.deleteRow(i);
        }
      }
    }
    
    // 3. Cascade delete from Students
    const stuSheet = getOrCreateSheet("Students");
    const lastRowStu = stuSheet.getLastRow();
    if (lastRowStu > 1) {
      const stuValues = stuSheet.getRange(2, 4, lastRowStu - 1, 1).getValues();
      for (let i = lastRowStu; i >= 2; i--) {
        if (stuValues[i - 2][0] == examId) {
          stuSheet.deleteRow(i);
        }
      }
    }
    
    // 4. Cascade delete from Attempts (and associated Answers & Violations)
    const attSheet = getOrCreateSheet("Attempts");
    const lastRowAtt = attSheet.getLastRow();
    const deletedAttemptIds = [];
    if (lastRowAtt > 1) {
      const attValues = attSheet.getRange(2, 1, lastRowAtt - 1, 2).getValues();
      for (let i = lastRowAtt; i >= 2; i--) {
        const attemptId = attValues[i - 2][0];
        const attExamId = attValues[i - 2][1];
        if (attExamId == examId) {
          deletedAttemptIds.push(attemptId);
          attSheet.deleteRow(i);
        }
      }
    }
    
    // 5. Cascade delete Answers
    if (deletedAttemptIds.length > 0) {
      const ansSheet = getOrCreateSheet("Answers");
      const lastRowAns = ansSheet.getLastRow();
      if (lastRowAns > 1) {
        const ansValues = ansSheet.getRange(2, 2, lastRowAns - 1, 1).getValues();
        for (let i = lastRowAns; i >= 2; i--) {
          if (deletedAttemptIds.indexOf(ansValues[i - 2][0]) !== -1) {
            ansSheet.deleteRow(i);
          }
        }
      }
      
      // 6. Cascade delete Violations
      const vilSheet = getOrCreateSheet("Violations");
      const lastRowVil = vilSheet.getLastRow();
      if (lastRowVil > 1) {
        const vilValues = vilSheet.getRange(2, 2, lastRowVil - 1, 1).getValues();
        for (let i = lastRowVil; i >= 2; i--) {
          if (deletedAttemptIds.indexOf(vilValues[i - 2][0]) !== -1) {
            vilSheet.deleteRow(i);
          }
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

