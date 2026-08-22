/**
 * Student Roster Management Backend Logic
 */

// Import students into an exam roster
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
      importCount++;
    });
    
    return { success: true, count: importCount };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
