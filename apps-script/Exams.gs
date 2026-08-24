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
    const { examId, newSection, newCode } = body;
    if (!examId || !newSection || !newCode) {
      return { success: false, error: "Missing examId, newSection, or newCode" };
    }
    
    // Check if newCode is already in use
    const exams = getRowsAsObjects("Exams");
    const codeMatch = exams.find(e => e["Code"] === newCode);
    if (codeMatch) {
      return { success: false, error: "New Exam Code '" + newCode + "' is already in use." };
    }
    
    // Find source exam
    const sourceExam = exams.find(e => e["Exam ID"] === examId);
    if (!sourceExam) {
      return { success: false, error: "Source exam not found" };
    }
    
    const newExamId = generateUUID();
    const newExamRow = {
      "Exam ID": newExamId,
      "Title": sourceExam["Title"] + " (Copy)",
      "Code": newCode,
      "Section": newSection,
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
    const sourceQuestions = allQuestions.filter(q => q["Exam ID"] === examId);
    
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
