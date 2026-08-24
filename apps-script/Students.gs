/**
 * Student Roster Management Backend Logic
 */

// Get all students for a specific exam
function handleGetStudents(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  try {
    const examId = body.examId;
    if (!examId) return { success: false, error: "Missing examId" };
    
    const allStudents = getRowsAsObjects("Students");
    const examStudents = allStudents.filter(s => String(s["Exam ID"]).trim() === String(examId).trim());
    
    return {
      success: true,
      students: examStudents.map(s => ({
        studentId: s["Student ID"],
        name: s["Name"],
        section: s["Section"],
        examId: s["Exam ID"]
      }))
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Import or add multiple students into an exam roster
function handleImportStudents(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  try {
    const { examId, section, students } = body;
    if (!examId || !section || !students || !Array.isArray(students)) {
      return { success: false, error: "Missing examId, section, or student list" };
    }
    
    let importCount = 0;
    const addedStudents = [];
    
    students.forEach(studentName => {
      if (!studentName || studentName.trim() === "") return;
      
      // Auto-generate a Student ID
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const studentId = "STU-" + randomNum;
      
      const newStudentRow = {
        "Student ID": studentId,
        "Name": studentName.trim(),
        "Section": section.trim(),
        "Exam ID": examId
      };
      
      insertRow("Students", newStudentRow);
      addedStudents.push(newStudentRow);
      importCount++;
    });
    
    return { success: true, count: importCount, students: addedStudents };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Add a single student to roster
function handleAddStudent(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  try {
    const { examId, name, section } = body;
    if (!examId || !name || !section) {
      return { success: false, error: "Missing examId, student name, or section" };
    }
    
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const studentId = "STU-" + randomNum;
    
    const newStudentRow = {
      "Student ID": studentId,
      "Name": name.trim(),
      "Section": section.trim(),
      "Exam ID": examId
    };
    
    insertRow("Students", newStudentRow);
    return { 
      success: true, 
      student: {
        studentId: studentId,
        name: name.trim(),
        section: section.trim(),
        examId: examId
      }
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Delete a student from roster
function handleDeleteStudent(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  try {
    const { examId, studentId } = body;
    if (!examId || !studentId) {
      return { success: false, error: "Missing examId or studentId" };
    }
    
    const sheet = getOrCreateSheet("Students");
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true };
    
    const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    for (let i = lastRow; i >= 2; i--) {
      const rowStuId = values[i - 2][0];
      const rowExamId = values[i - 2][3];
      if (rowStuId == studentId && rowExamId == examId) {
        sheet.deleteRow(i);
        return { success: true };
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

