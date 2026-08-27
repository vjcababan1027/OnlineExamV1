/**
 * Student Attempt Tracking & Proctoring Log Logic
 */

// Verify student credentials and check exam status
function handleStudentVerify(body) {
  try {
    const { examCode, studentId } = body;
    if (!examCode || !studentId) {
      return { ok: false, error: "Exam Code and Student ID are required" };
    }
    
    // 1. Find exam
    const exams = getRowsAsObjects("Exams");
    const exam = exams.find(e => String(e["Code"]).trim().toUpperCase() === String(examCode).trim().toUpperCase());
    
    if (!exam) {
      return { ok: false, error: "Exam not found." };
    }
    
    if (exam["Status"] !== "Active") {
      return { ok: false, error: "This exam is currently closed or inactive." };
    }
    
    // Check time window if defined
    const now = new Date();
    if (exam["Start Time"]) {
      const startTime = new Date(exam["Start Time"]);
      if (now < startTime) {
        return { ok: false, error: "This exam has not started yet. Starts at: " + new Date(exam["Start Time"]).toLocaleString() };
      }
    }
    if (exam["End Time"]) {
      const endTime = new Date(exam["End Time"]);
      if (now > endTime) {
        return { ok: false, error: "This exam has already closed. Closed at: " + new Date(exam["End Time"]).toLocaleString() };
      }
    }
    
    // 2. Verify student is on roster
    const students = getRowsAsObjects("Students");
    const student = students.find(s => 
      String(s["Student ID"]).trim().toUpperCase() === String(studentId).trim().toUpperCase() && 
      String(s["Exam ID"]).trim() === String(exam["Exam ID"]).trim()
    );
    
    if (!student) {
      return { ok: false, error: "Student ID is not registered for this exam." };
    }
    
    // 3. Check for existing attempts
    const attempts = getRowsAsObjects("Attempts");
    const studentAttempt = attempts.find(a => 
      String(a["Student ID"]).trim().toUpperCase() === String(student["Student ID"]).trim().toUpperCase() && 
      String(a["Exam ID"]).trim() === String(exam["Exam ID"]).trim()
    );
    
    if (studentAttempt) {
      if (studentAttempt["Status"] === "Finished" || studentAttempt["Status"] === "Auto-Submitted") {
        return { ok: false, error: "You have already completed this exam." };
      }
      // If student has an unfinished attempt, allow resumption!
      return {
        ok: true,
        studentName: student["Name"],
        studentId: student["Student ID"],
        examMeta: {
          examId: exam["Exam ID"],
          title: exam["Title"],
          code: exam["Code"],
          duration: Number(exam["Duration (Mins)"]) || 60,
          deduction: Number(exam["Deduction"]) || 0,
          maxViolations: Number(exam["Max Violations"]) || 3,
          randomize: exam["Randomize"] === "TRUE",
          timerMode: exam["Timer Mode"] || "per_question",
          perQuestionSec: Number(exam["Per Question Sec"]) || 60
        },
        attemptId: studentAttempt["Attempt ID"],
        resumed: true
      };
    }
    
    return {
      ok: true,
      studentName: student["Name"],
      studentId: student["Student ID"],
      examMeta: {
        examId: exam["Exam ID"],
        title: exam["Title"],
        code: exam["Code"],
        duration: Number(exam["Duration (Mins)"]) || 60,
        deduction: Number(exam["Deduction"]) || 0,
        maxViolations: Number(exam["Max Violations"]) || 3,
        randomize: exam["Randomize"] === "TRUE",
        timerMode: exam["Timer Mode"] || "per_question",
        perQuestionSec: Number(exam["Per Question Sec"]) || 60
      },
      resumed: false
    };
  } catch (error) {
    return { ok: false, error: error.toString() };
  }
}

// Start a new attempt, return list of questions without answers
function handleStartAttempt(body) {
  try {
    const { examId, studentId } = body;
    if (!examId || !studentId) {
      return { success: false, error: "Missing examId or studentId" };
    }
    
    const attempts = getRowsAsObjects("Attempts");
    let attempt = attempts.find(a => a["Student ID"] === studentId && a["Exam ID"] === examId);
    let attemptId;
    
    if (!attempt) {
      attemptId = generateUUID();
      const newAttemptRow = {
        "Attempt ID": attemptId,
        "Exam ID": examId,
        "Student ID": studentId,
        "Start Time": new Date().toISOString(),
        "End Time": "",
        "Score": 0,
        "Deduction": 0,
        "Final Score": 0,
        "Status": "Started"
      };
      insertRow("Attempts", newAttemptRow);
    } else {
      attemptId = attempt["Attempt ID"];
      // If it was somehow finished, reject
      if (attempt["Status"] !== "Started") {
        return { success: false, error: "Attempt is already submitted." };
      }
    }
    
    // Fetch questions
    const allQuestions = getRowsAsObjects("Questions");
    let questions = allQuestions.filter(q => q["Exam ID"] === examId);
    
    // Map questions to omit answer key
    let mappedQuestions = questions.map(q => {
      return {
        questionId: q["Question ID"],
        number: q["Number"],
        type: q["Type"],
        questionText: q["Question Text"],
        a: q["A"],
        b: q["B"],
        c: q["C"],
        d: q["D"],
        points: q["Points"],
        timeLimit: Number(q["Time Limit (Sec)"]) || null
      };
    });
    
    // Sort by question number initially
    mappedQuestions.sort((a, b) => a.number - b.number);
    
    // Randomize if exam settings specify
    const exams = getRowsAsObjects("Exams");
    const exam = exams.find(e => e["Exam ID"] === examId);
    if (exam && exam["Randomize"] === "TRUE") {
      // Shuffle array in place
      for (let i = mappedQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mappedQuestions[i], mappedQuestions[j]] = [mappedQuestions[j], mappedQuestions[i]];
      }
    }
    
    return { 
      success: true, 
      attemptId: attemptId, 
      questions: mappedQuestions,
      examMeta: exam ? {
        timerMode: exam["Timer Mode"] || "per_question",
        perQuestionSec: Number(exam["Per Question Sec"]) || 60,
        duration: Number(exam["Duration (Mins)"]) || 60
      } : null
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Submit a single answer
function handleSubmitAnswer(body) {
  try {
    const { attemptId, questionId, selectedAnswer, timeUsed } = body;
    if (!attemptId || !questionId) {
      return { success: false, error: "Missing attemptId or questionId" };
    }
    
    // Verify attempt is active
    const attempts = getRowsAsObjects("Attempts");
    const attempt = attempts.find(a => a["Attempt ID"] === attemptId);
    if (!attempt) return { success: false, error: "Attempt not found" };
    if (attempt["Status"] !== "Started") {
      return { success: false, error: "Attempt is already submitted or closed." };
    }
    
    // Upsert answer
    const answers = getRowsAsObjects("Answers");
    const existingAnswer = answers.find(ans => ans["Attempt ID"] === attemptId && ans["Question ID"] === questionId);
    
    const answerData = {
      "Attempt ID": attemptId,
      "Question ID": questionId,
      "Selected Answer": selectedAnswer ? selectedAnswer.toString().trim() : "",
      "Time Used": Number(timeUsed) || 0,
      "Submitted At": new Date().toISOString()
    };
    
    if (existingAnswer) {
      updateRow("Answers", "Answer ID", existingAnswer["Answer ID"], answerData);
    } else {
      answerData["Answer ID"] = generateUUID();
      insertRow("Answers", answerData);
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Log a proctoring violation and calculate current deduction
function handleLogViolation(body) {
  try {
    const { attemptId, type } = body;
    if (!attemptId || !type) {
      return { success: false, error: "Missing attemptId or violation type" };
    }
    
    // Verify attempt is active
    const attempts = getRowsAsObjects("Attempts");
    const attempt = attempts.find(a => a["Attempt ID"] === attemptId);
    if (!attempt) return { success: false, error: "Attempt not found" };
    if (attempt["Status"] !== "Started") {
      return { success: false, error: "Attempt is already submitted or closed." };
    }
    
    // Log violation
    const violationId = generateUUID();
    const newViolationRow = {
      "Violation ID": violationId,
      "Attempt ID": attemptId,
      "Type": type,
      "Timestamp": new Date().toISOString()
    };
    insertRow("Violations", newViolationRow);
    
    // Count total violations for this attempt
    const violations = getRowsAsObjects("Violations");
    const attemptViolations = violations.filter(v => v["Attempt ID"] === attemptId);
    const violationCount = attemptViolations.length;
    
    // Look up exam to get deduction rule
    const exams = getRowsAsObjects("Exams");
    const exam = exams.find(e => e["Exam ID"] === attempt["Exam ID"]);
    const deductionPerViolation = exam ? Number(exam["Deduction"]) || 0 : 0;
    const maxViolations = exam ? Number(exam["Max Violations"]) || 3 : 3;
    
    const totalDeduction = violationCount * deductionPerViolation;
    
    // Update attempts table with running deduction
    updateRow("Attempts", "Attempt ID", attemptId, {
      "Deduction": totalDeduction
    });
    
    return {
      success: true,
      violationCount: violationCount,
      deduction: totalDeduction,
      maxViolations: maxViolations
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Close and submit exam attempt
function handleFinishAttempt(body) {
  try {
    const { attemptId } = body;
    if (!attemptId) return { success: false, error: "Missing attemptId" };
    
    const attempts = getRowsAsObjects("Attempts");
    const attempt = attempts.find(a => a["Attempt ID"] === attemptId);
    if (!attempt) return { success: false, error: "Attempt not found" };
    
    if (attempt["Status"] !== "Started") {
      return { success: true, message: "Attempt already completed." };
    }
    
    // Grade the exam attempt (Updates attempt row inside gradeAttempt)
    const gradeResult = gradeAttempt(attemptId);
    
    return { success: true, finalScore: gradeResult.finalScore };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Retrieve registered student list for a validated active exam
function handleGetExamRoster(body) {
  try {
    const { examCode } = body;
    if (!examCode) {
      return { success: false, error: "Exam Code is required" };
    }
    
    // 1. Find exam
    const exams = getRowsAsObjects("Exams");
    const exam = exams.find(e => e["Code"] === examCode.trim());
    
    if (!exam) {
      return { success: false, error: "Exam not found." };
    }
    
    if (exam["Status"] !== "Active") {
      return { success: false, error: "This exam session is closed or inactive." };
    }
    
    // Check time window if defined
    const now = new Date();
    if (exam["Start Time"]) {
      const startTime = new Date(exam["Start Time"]);
      if (now < startTime) {
        return { success: false, error: "This exam has not started yet. Starts at: " + new Date(exam["Start Time"]).toLocaleString() };
      }
    }
    if (exam["End Time"]) {
      const endTime = new Date(exam["End Time"]);
      if (now > endTime) {
        return { success: false, error: "This exam has already closed. Closed at: " + new Date(exam["End Time"]).toLocaleString() };
      }
    }
    
    // 2. Fetch students on roster
    const students = getRowsAsObjects("Students").filter(s => String(s["Exam ID"]).trim() === String(exam["Exam ID"]).trim());
    
    // 3. Fetch attempts to cross-reference completion
    const attempts = getRowsAsObjects("Attempts").filter(a => String(a["Exam ID"]).trim() === String(exam["Exam ID"]).trim());
    
    const roster = students.map(s => {
      const attempt = attempts.find(a => String(a["Student ID"]).trim().toUpperCase() === String(s["Student ID"]).trim().toUpperCase());
      return {
        studentId: String(s["Student ID"]).trim(),
        name: String(s["Name"]).trim(),
        completed: attempt ? (attempt["Status"] === "Finished" || attempt["Status"] === "Auto-Submitted") : false
      };
    });
    
    // Sort names alphabetically
    roster.sort((a, b) => a.name.localeCompare(b.name));
    
    return {
      success: true,
      examMeta: {
        examId: exam["Exam ID"],
        title: exam["Title"],
        code: exam["Code"],
        duration: exam["Duration (Mins)"],
        deduction: exam["Deduction"],
        maxViolations: exam["Max Violations"],
        randomize: exam["Randomize"] === "TRUE"
      },
      roster: roster
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Reset a student's attempt so they can retake the exam
function handleResetAttempt(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  try {
    const { examId, studentId, attemptId } = body;
    if (!examId || (!studentId && !attemptId)) {
      return { success: false, error: "Missing examId or studentId/attemptId" };
    }
    
    // Find matching attempt
    const attempts = getRowsAsObjects("Attempts");
    let targetAttempts = [];
    if (attemptId) {
      targetAttempts = attempts.filter(a => String(a["Attempt ID"]).trim() === String(attemptId).trim());
    } else {
      targetAttempts = attempts.filter(a => 
        String(a["Exam ID"]).trim() === String(examId).trim() && 
        String(a["Student ID"]).trim() === String(studentId).trim()
      );
    }
    
    const targetAttemptIds = targetAttempts.map(a => String(a["Attempt ID"]).trim());
    
    // 1. Delete rows from Attempts sheet
    const attemptsSheet = getOrCreateSheet("Attempts");
    const lastRowAtt = attemptsSheet.getLastRow();
    if (lastRowAtt > 1) {
      const attValues = attemptsSheet.getRange(2, 1, lastRowAtt - 1, 3).getValues(); // col 1: Attempt ID, col 2: Exam ID, col 3: Student ID
      for (let i = lastRowAtt; i >= 2; i--) {
        const rowAttId = String(attValues[i - 2][0]).trim();
        const rowExamId = String(attValues[i - 2][1]).trim();
        const rowStuId = String(attValues[i - 2][2]).trim();
        
        if (targetAttemptIds.includes(rowAttId) || (studentId && rowExamId === String(examId).trim() && rowStuId === String(studentId).trim())) {
          attemptsSheet.deleteRow(i);
        }
      }
    }
    
    // 2. Delete rows from Answers sheet
    if (targetAttemptIds.length > 0) {
      const answersSheet = getOrCreateSheet("Answers");
      const lastRowAns = answersSheet.getLastRow();
      if (lastRowAns > 1) {
        const ansValues = answersSheet.getRange(2, 2, lastRowAns - 1, 1).getValues(); // col 2: Attempt ID
        for (let i = lastRowAns; i >= 2; i--) {
          const rowAttId = String(ansValues[i - 2][0]).trim();
          if (targetAttemptIds.includes(rowAttId)) {
            answersSheet.deleteRow(i);
          }
        }
      }
      
      // 3. Delete rows from Violations sheet
      const violationsSheet = getOrCreateSheet("Violations");
      const lastRowVil = violationsSheet.getLastRow();
      if (lastRowVil > 1) {
        const vilValues = violationsSheet.getRange(2, 2, lastRowVil - 1, 1).getValues(); // col 2: Attempt ID
        for (let i = lastRowVil; i >= 2; i--) {
          const rowAttId = String(vilValues[i - 2][0]).trim();
          if (targetAttemptIds.includes(rowAttId)) {
            violationsSheet.deleteRow(i);
          }
        }
      }
    }
    
    return { success: true, message: "Student attempt has been reset. The student can now take the exam again." };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

