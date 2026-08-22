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
    const exam = exams.find(e => e["Code"] === examCode.trim());
    
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
    const student = students.find(s => s["Student ID"] === studentId.trim() && s["Exam ID"] === exam["Exam ID"]);
    
    if (!student) {
      return { ok: false, error: "Student ID is not registered for this exam." };
    }
    
    // 3. Check for existing attempts
    const attempts = getRowsAsObjects("Attempts");
    const studentAttempt = attempts.find(a => a["Student ID"] === student["Student ID"] && a["Exam ID"] === exam["Exam ID"]);
    
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
          duration: exam["Duration (Mins)"],
          deduction: exam["Deduction"],
          maxViolations: exam["Max Violations"],
          randomize: exam["Randomize"] === "TRUE"
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
        duration: exam["Duration (Mins)"],
        deduction: exam["Deduction"],
        maxViolations: exam["Max Violations"],
        randomize: exam["Randomize"] === "TRUE"
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
        points: q["Points"]
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
    
    return { success: true, attemptId: attemptId, questions: mappedQuestions };
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
    const students = getRowsAsObjects("Students").filter(s => s["Exam ID"] === exam["Exam ID"]);
    
    // 3. Fetch attempts to cross-reference completion
    const attempts = getRowsAsObjects("Attempts").filter(a => a["Exam ID"] === exam["Exam ID"]);
    
    const roster = students.map(s => {
      const attempt = attempts.find(a => a["Student ID"] === s["Student ID"]);
      return {
        studentId: s["Student ID"],
        name: s["Name"],
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
