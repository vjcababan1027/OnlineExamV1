/**
 * Question Bank Backend Logic
 */

// Import questions for an exam, replacing existing ones to avoid duplicates
function handleImportQuestions(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  try {
    const { examId, questions } = body;
    if (!examId || !questions || !Array.isArray(questions)) {
      return { success: false, error: "Missing examId or questions list" };
    }
    
    // Remove existing questions for this exam to ensure clean replacement
    const sheet = getOrCreateSheet("Questions");
    
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      // Fetch Exam ID column (column 2)
      const values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      // Iterate backwards to safely delete matching rows
      for (let i = lastRow; i >= 2; i--) {
        if (values[i - 2][0] == examId) {
          sheet.deleteRow(i);
        }
      }
    }
    
    let importCount = 0;
    
    questions.forEach(q => {
      const questionId = generateUUID();
      const newQuestionRow = {
        "Question ID": questionId,
        "Exam ID": examId,
        "Number": Number(q.number) || (importCount + 1),
        "Type": q.type || "MCQ",
        "Question Text": q.questionText || "",
        "A": q.a || "",
        "B": q.b || "",
        "C": q.c || "",
        "D": q.d || "",
        "Answer": q.answer ? q.answer.toString().trim() : "",
        "Points": Number(q.points) || 1,
        "Time Limit (Sec)": q.timeLimit ? Number(q.timeLimit) : ""
      };
      
      insertRow("Questions", newQuestionRow);
      importCount++;
    });
    
    return { success: true, count: importCount };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Get all questions for an exam (with answer keys for teacher view)
function handleGetQuestions(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  try {
    const examId = body.examId;
    if (!examId) return { success: false, error: "Missing examId" };
    
    const allQuestions = getRowsAsObjects("Questions");
    const examQuestions = allQuestions.filter(q => q["Exam ID"] === examId);
    
    examQuestions.sort((a, b) => Number(a["Number"]) - Number(b["Number"]));
    
    return {
      success: true,
      questions: examQuestions.map(q => ({
        questionId: q["Question ID"],
        examId: q["Exam ID"],
        number: q["Number"],
        type: q["Type"],
        questionText: q["Question Text"],
        a: q["A"],
        b: q["B"],
        c: q["C"],
        d: q["D"],
        answer: q["Answer"],
        points: q["Points"],
        timeLimit: q["Time Limit (Sec)"]
      }))
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Delete a single question
function handleDeleteQuestion(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  try {
    const { examId, questionId } = body;
    if (!examId || !questionId) {
      return { success: false, error: "Missing examId or questionId" };
    }
    
    const sheet = getOrCreateSheet("Questions");
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true };
    
    const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (let i = lastRow; i >= 2; i--) {
      const rowQId = values[i - 2][0];
      const rowExamId = values[i - 2][1];
      if (rowQId == questionId && rowExamId == examId) {
        sheet.deleteRow(i);
        return { success: true };
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

