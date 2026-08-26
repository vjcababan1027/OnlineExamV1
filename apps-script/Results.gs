/**
 * Grading Logic and Teacher Results Extraction
 */

// Helper to determine if a student's answer is correct across all question types
function isAnswerCorrect(question, rawStudentAnswer) {
  if (rawStudentAnswer === undefined || rawStudentAnswer === null || rawStudentAnswer === "") {
    return false;
  }
  
  const studentAns = String(rawStudentAnswer).trim();
  const correctAns = (question["Answer"] !== undefined && question["Answer"] !== null)
    ? String(question["Answer"]).trim()
    : "";
    
  if (!correctAns) return false;
  
  const qType = (question["Type"] || "MCQ").toUpperCase();
  
  // 1. TRUE_FALSE Question Type
  if (qType === "TRUE_FALSE") {
    const normalizeTF = (val) => {
      const u = String(val).trim().toUpperCase();
      if (u === "A" || u === "TRUE" || u === "T" || u === "1") return "TRUE";
      if (u === "B" || u === "FALSE" || u === "F" || u === "0") return "FALSE";
      return u;
    };
    return normalizeTF(studentAns) === normalizeTF(correctAns);
  }
  
  // 2. Multiple Choice (MCQ) Question Type
  if (qType === "MCQ") {
    const sUpper = studentAns.toUpperCase();
    const cUpper = correctAns.toUpperCase();
    
    // Direct match (e.g. "A" === "A" or "Paris" === "PARIS")
    if (sUpper === cUpper) return true;
    
    // Option letter to text mapping
    const optionMap = {
      "A": question["A"] ? String(question["A"]).trim() : "",
      "B": question["B"] ? String(question["B"]).trim() : "",
      "C": question["C"] ? String(question["C"]).trim() : "",
      "D": question["D"] ? String(question["D"]).trim() : ""
    };
    
    // If correct answer is option letter (A/B/C/D) and student selected option letter
    if (optionMap[cUpper] && sUpper === cUpper) return true;
    
    // If correct answer is text and student sent option letter
    if (optionMap[sUpper] && optionMap[sUpper].toUpperCase() === cUpper) return true;
    
    // If student sent full text and correct answer is option letter
    if (optionMap[cUpper] && optionMap[cUpper].toUpperCase() === sUpper) return true;
    
    return false;
  }
  
  // 3. IDENTIFICATION Question Type
  if (qType === "IDENTIFICATION") {
    const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
    return norm(studentAns) === norm(correctAns);
  }
  
  // Fallback direct case-insensitive match
  return studentAns.toUpperCase() === correctAns.toUpperCase();
}

// Grade a single exam attempt
function gradeAttempt(attemptId, status = "Finished") {
  const attempts = getRowsAsObjects("Attempts");
  const attempt = attempts.find(a => String(a["Attempt ID"]).trim() === String(attemptId).trim());
  if (!attempt) throw new Error("Attempt not found during grading: " + attemptId);
  
  const examId = attempt["Exam ID"];
  const studentId = attempt["Student ID"];
  
  // 1. Get Questions and Correct Answers
  const allQuestions = getRowsAsObjects("Questions");
  const examQuestions = allQuestions.filter(q => String(q["Exam ID"]).trim() === String(examId).trim());
  
  // 2. Get Student's Answers
  const allAnswers = getRowsAsObjects("Answers");
  const studentAnswers = allAnswers.filter(ans => String(ans["Attempt ID"]).trim() === String(attemptId).trim());
  
  let rawScore = 0;
  
  // Grade each question using the unified isAnswerCorrect engine
  examQuestions.forEach(question => {
    const questionId = question["Question ID"];
    const points = Number(question["Points"]) || 1;
    
    const studentAnsObj = studentAnswers.find(ans => 
      String(ans["Question ID"]).trim() === String(questionId).trim()
    );
    const studentAnswer = studentAnsObj ? studentAnsObj["Selected Answer"] : "";
    
    if (isAnswerCorrect(question, studentAnswer)) {
      rawScore += points;
    }
  });
  
  // 3. Calculate Proctoring Violations Deduction
  const allViolations = getRowsAsObjects("Violations");
  const attemptViolations = allViolations.filter(v => String(v["Attempt ID"]).trim() === String(attemptId).trim());
  const violationCount = attemptViolations.length;
  
  const exams = getRowsAsObjects("Exams");
  const exam = exams.find(e => String(e["Exam ID"]).trim() === String(examId).trim());
  const deductionPerViolation = exam ? Number(exam["Deduction"]) || 0 : 0;
  
  const deduction = violationCount * deductionPerViolation;
  const finalScore = Math.max(0, rawScore - deduction);
  
  // 4. Update the Attempts sheet
  const updateData = {
    "End Time": attempt["End Time"] || new Date().toISOString(),
    "Score": rawScore,
    "Deduction": deduction,
    "Final Score": finalScore,
    "Status": status || attempt["Status"] || "Finished"
  };
  
  updateRow("Attempts", "Attempt ID", attemptId, updateData);
  
  return {
    rawScore: rawScore,
    deduction: deduction,
    finalScore: finalScore
  };
}

// Retrieve full results report for a specific exam (Teacher Dashboard view)
function handleGetResults(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  const examId = body.examId;
  if (!examId) return { success: false, error: "Missing examId" };
  
  try {
    const students = getRowsAsObjects("Students").filter(s => String(s["Exam ID"]).trim() === String(examId).trim());
    const attempts = getRowsAsObjects("Attempts").filter(a => String(a["Exam ID"]).trim() === String(examId).trim());
    const allViolations = getRowsAsObjects("Violations");
    const allAnswers = getRowsAsObjects("Answers");
    const questions = getRowsAsObjects("Questions").filter(q => String(q["Exam ID"]).trim() === String(examId).trim());
    
    const exams = getRowsAsObjects("Exams");
    const exam = exams.find(e => String(e["Exam ID"]).trim() === String(examId).trim());
    const deductionPerViolation = exam ? Number(exam["Deduction"]) || 0 : 0;
    
    // Map of attemptId to its violations
    const violationsMap = {};
    allViolations.forEach(v => {
      const attId = String(v["Attempt ID"]).trim();
      if (!violationsMap[attId]) {
        violationsMap[attId] = [];
      }
      violationsMap[attId].push(v);
    });
    
    // Generate records per student roster slot and compute score dynamically
    const rows = students.map(student => {
      const studentId = String(student["Student ID"]).trim();
      const attempt = attempts.find(a => String(a["Student ID"]).trim() === studentId);
      
      let rawScore = null;
      let deduction = null;
      let finalScore = null;
      let violationCount = 0;
      
      if (attempt) {
        const attemptId = String(attempt["Attempt ID"]).trim();
        const studentAnswers = allAnswers.filter(ans => String(ans["Attempt ID"]).trim() === attemptId);
        const attemptVils = violationsMap[attemptId] || [];
        violationCount = attemptVils.length;
        
        // Dynamically compute raw score from actual answers
        let calculatedRawScore = 0;
        questions.forEach(q => {
          const qId = String(q["Question ID"]).trim();
          const pts = Number(q["Points"]) || 1;
          const ansObj = studentAnswers.find(ans => String(ans["Question ID"]).trim() === qId);
          const studentAns = ansObj ? ansObj["Selected Answer"] : "";
          if (isAnswerCorrect(q, studentAns)) {
            calculatedRawScore += pts;
          }
        });
        
        rawScore = calculatedRawScore;
        deduction = violationCount * deductionPerViolation;
        finalScore = Math.max(0, rawScore - deduction);
        
        // If the stored attempt score was out of date, sync it
        const storedScore = Number(attempt["Score"]);
        const storedFinal = Number(attempt["Final Score"]);
        if (storedScore !== rawScore || storedFinal !== finalScore) {
          updateRow("Attempts", "Attempt ID", attemptId, {
            "Score": rawScore,
            "Deduction": deduction,
            "Final Score": finalScore
          });
        }
      }
      
      const row = {
        studentId: student["Student ID"],
        studentName: student["Name"],
        section: student["Section"],
        status: attempt ? attempt["Status"] : "Not Started",
        startTime: attempt ? attempt["Start Time"] : "",
        endTime: attempt ? attempt["End Time"] : "",
        rawScore: rawScore,
        deduction: deduction,
        finalScore: finalScore,
        violationCount: violationCount,
        attemptId: attempt ? attempt["Attempt ID"] : null
      };
      
      return row;
    });
    
    // Compile summary statistics
    const completedAttempts = rows.filter(r => r.status === "Finished" || r.status === "Auto-Submitted");
    const scores = completedAttempts.map(r => r.finalScore);
    
    const summary = {
      registered: students.length,
      started: rows.filter(r => r.status === "Started").length,
      completed: completedAttempts.length,
      averageScore: scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0,
      highestScore: scores.length ? Math.max(...scores) : 0,
      lowestScore: scores.length ? Math.min(...scores) : 0,
      totalPossiblePoints: questions.reduce((sum, q) => sum + (Number(q["Points"]) || 1), 0)
    };
    
    // Gather all detailed violations for logs
    const detailedViolations = [];
    attempts.forEach(a => {
      const attId = String(a["Attempt ID"]).trim();
      const stu = students.find(s => String(s["Student ID"]).trim() === String(a["Student ID"]).trim());
      const attVils = violationsMap[attId] || [];
      attVils.forEach(v => {
        detailedViolations.push({
          studentName: stu ? stu["Name"] : "Unknown Student",
          studentId: a["Student ID"],
          type: v["Type"],
          timestamp: v["Timestamp"]
        });
      });
    });
    
    // Gather student question-by-question response details using unified isAnswerCorrect
    const studentAnswersReport = {};
    attempts.forEach(a => {
      const attemptId = String(a["Attempt ID"]).trim();
      const answers = allAnswers.filter(ans => String(ans["Attempt ID"]).trim() === attemptId);
      
      studentAnswersReport[attemptId] = answers.map(ans => {
        const q = questions.find(question => String(question["Question ID"]).trim() === String(ans["Question ID"]).trim());
        return {
          questionNumber: q ? q["Number"] : "N/A",
          questionText: q ? q["Question Text"] : "",
          type: q ? q["Type"] : "",
          correctAnswer: q ? q["Answer"] : "",
          studentAnswer: ans["Selected Answer"],
          isCorrect: q ? isAnswerCorrect(q, ans["Selected Answer"]) : false,
          timeUsed: ans["Time Used"],
          submittedAt: ans["Submitted At"]
        };
      });
    });
    
    return {
      success: true,
      summary: summary,
      rows: rows,
      violations: detailedViolations,
      answers: studentAnswersReport
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Recalculate and re-sync scores for all attempts of an exam
function handleRecalculateScores(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  const examId = body.examId;
  if (!examId) return { success: false, error: "Missing examId" };
  
  try {
    const attempts = getRowsAsObjects("Attempts").filter(a => String(a["Exam ID"]).trim() === String(examId).trim());
    let updatedCount = 0;
    
    attempts.forEach(attempt => {
      const attemptId = attempt["Attempt ID"];
      gradeAttempt(attemptId, attempt["Status"]);
      updatedCount++;
    });
    
    return { success: true, updatedCount: updatedCount };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
