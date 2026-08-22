/**
 * Grading Logic and Teacher Results Extraction
 */

// Grade a single exam attempt
function gradeAttempt(attemptId, status = "Finished") {
  const attempts = getRowsAsObjects("Attempts");
  const attempt = attempts.find(a => a["Attempt ID"] === attemptId);
  if (!attempt) throw new Error("Attempt not found during grading: " + attemptId);
  
  const examId = attempt["Exam ID"];
  const studentId = attempt["Student ID"];
  
  // 1. Get Questions and Correct Answers
  const allQuestions = getRowsAsObjects("Questions");
  const examQuestions = allQuestions.filter(q => q["Exam ID"] === examId);
  
  // 2. Get Student's Answers
  const allAnswers = getRowsAsObjects("Answers");
  const studentAnswers = allAnswers.filter(ans => ans["Attempt ID"] === attemptId);
  
  let rawScore = 0;
  
  // Grade each question
  examQuestions.forEach(question => {
    const questionId = question["Question ID"];
    const points = Number(question["Points"]) || 1;
    const correctAnswer = question["Answer"] ? question["Answer"].toString().trim().toUpperCase() : "";
    
    const studentAnsObj = studentAnswers.find(ans => ans["Question ID"] === questionId);
    const studentAnswer = studentAnsObj && studentAnsObj["Selected Answer"] 
      ? studentAnsObj["Selected Answer"].toString().trim().toUpperCase() 
      : "";
    
    if (studentAnswer === correctAnswer && correctAnswer !== "") {
      rawScore += points;
    }
  });
  
  // 3. Calculate Proctoring Violations Deduction
  const allViolations = getRowsAsObjects("Violations");
  const attemptViolations = allViolations.filter(v => v["Attempt ID"] === attemptId);
  const violationCount = attemptViolations.length;
  
  const exams = getRowsAsObjects("Exams");
  const exam = exams.find(e => e["Exam ID"] === examId);
  const deductionPerViolation = exam ? Number(exam["Deduction"]) || 0 : 0;
  
  const deduction = violationCount * deductionPerViolation;
  const finalScore = Math.max(0, rawScore - deduction);
  
  // 4. Update the Attempts sheet
  const updateData = {
    "End Time": new Date().toISOString(),
    "Score": rawScore,
    "Deduction": deduction,
    "Final Score": finalScore,
    "Status": status
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
    const students = getRowsAsObjects("Students").filter(s => s["Exam ID"] === examId);
    const attempts = getRowsAsObjects("Attempts").filter(a => a["Exam ID"] === examId);
    const allViolations = getRowsAsObjects("Violations");
    const allAnswers = getRowsAsObjects("Answers");
    const questions = getRowsAsObjects("Questions").filter(q => q["Exam ID"] === examId);
    
    // Map of attemptId to its violations
    const violationsMap = {};
    allViolations.forEach(v => {
      if (!violationsMap[v["Attempt ID"]]) {
        violationsMap[v["Attempt ID"]] = [];
      }
      violationsMap[v["Attempt ID"]].push(v);
    });
    
    // Generate records per student roster slot
    const rows = students.map(student => {
      const studentId = student["Student ID"];
      const attempt = attempts.find(a => a["Student ID"] === studentId);
      
      const row = {
        studentId: studentId,
        studentName: student["Name"],
        section: student["Section"],
        status: attempt ? attempt["Status"] : "Not Started",
        startTime: attempt ? attempt["Start Time"] : "",
        endTime: attempt ? attempt["End Time"] : "",
        rawScore: attempt ? Number(attempt["Score"]) || 0 : null,
        deduction: attempt ? Number(attempt["Deduction"]) || 0 : null,
        finalScore: attempt ? Number(attempt["Final Score"]) || 0 : null,
        violationCount: attempt ? (violationsMap[attempt["Attempt ID"]] ? violationsMap[attempt["Attempt ID"]].length : 0) : 0,
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
      const stu = students.find(s => s["Student ID"] === a["Student ID"]);
      const attVils = violationsMap[a["Attempt ID"]] || [];
      attVils.forEach(v => {
        detailedViolations.push({
          studentName: stu ? stu["Name"] : "Unknown Student",
          studentId: a["Student ID"],
          type: v["Type"],
          timestamp: v["Timestamp"]
        });
      });
    });
    
    // Gather student question-by-question response details
    const studentAnswersReport = {};
    attempts.forEach(a => {
      const attemptId = a["Attempt ID"];
      const answers = allAnswers.filter(ans => ans["Attempt ID"] === attemptId);
      
      studentAnswersReport[attemptId] = answers.map(ans => {
        const q = questions.find(question => question["Question ID"] === ans["Question ID"]);
        return {
          questionNumber: q ? q["Number"] : "N/A",
          questionText: q ? q["Question Text"] : "",
          type: q ? q["Type"] : "",
          correctAnswer: q ? q["Answer"] : "",
          studentAnswer: ans["Selected Answer"],
          isCorrect: q ? (ans["Selected Answer"] || "").toString().trim().toUpperCase() === (q["Answer"] || "").toString().trim().toUpperCase() : false,
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
