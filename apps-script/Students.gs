/**
 * Student Roster Management Backend Logic
 */

// Helper to test if a string looks like a student ID rather than a surname/name
function isLikelyStudentId(str) {
  if (!str) return false;
  const s = String(str).trim();
  if (s.length === 0 || s.length > 25) return false;
  // If it starts with common ID prefixes
  if (/^(STU|ID|S|STD|STUDENT)[-_#]?\d+/i.test(s)) return true;
  // If it has at least one number and no spaces (e.g., 2024-001, 102938, CS-2024-12)
  if (/\d/.test(s) && !/\s/.test(s)) return true;
  // If it is purely alphanumeric with no spaces and contains numbers or dashes
  if (/^[A-Z0-9_-]+$/i.test(s) && (/\d/.test(s) || s.includes('-') || s.includes('_'))) return true;
  return false;
}

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
        studentId: String(s["Student ID"] !== undefined ? s["Student ID"] : "").trim(),
        name: String(s["Name"] !== undefined ? s["Name"] : "").trim(),
        section: String(s["Section"] !== undefined ? s["Section"] : "").trim(),
        examId: String(s["Exam ID"] !== undefined ? s["Exam ID"] : "").trim()
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
    if (!examId || !students || !Array.isArray(students)) {
      return { success: false, error: "Missing examId or student list" };
    }
    
    // Look up exam default section if section was blank
    let defaultSection = (section || "").toString().trim();
    if (!defaultSection) {
      const exams = getRowsAsObjects("Exams");
      const exam = exams.find(e => String(e["Exam ID"]).trim() === String(examId).trim());
      if (exam && exam["Section"]) {
        defaultSection = String(exam["Section"]).trim();
      }
    }
    if (!defaultSection) defaultSection = "Default";
    
    const allStudents = getRowsAsObjects("Students");
    const existingForExam = allStudents.filter(s => String(s["Exam ID"]).trim() === String(examId).trim());
    const existingIds = new Set(existingForExam.map(s => String(s["Student ID"]).trim().toUpperCase()));
    
    let importCount = 0;
    const addedStudents = [];
    
    students.forEach(studentEntry => {
      if (!studentEntry) return;
      let rawLine = String(studentEntry).trim();
      if (!rawLine) return;
      
      let studentId = "";
      let studentName = "";
      let stuSection = defaultSection;
      
      // Parse formats:
      // 1. Object: { studentId, name, section }
      // 2. Delimited string: "ID | Name | Section" or "ID \t Name" or "ID, Name" or "Lastname, Firstname" or just "Name"
      if (typeof studentEntry === 'object' && studentEntry.name) {
        studentName = String(studentEntry.name).trim();
        studentId = studentEntry.studentId ? String(studentEntry.studentId).trim() : "";
        stuSection = studentEntry.section ? String(studentEntry.section).trim() : defaultSection;
      } else {
        // Check for tab or pipe delimiter first
        if (rawLine.includes('|') || rawLine.includes('\t')) {
          const delim = rawLine.includes('|') ? '|' : '\t';
          const parts = rawLine.split(delim).map(p => p.trim()).filter(p => p.length > 0);
          if (parts.length >= 2) {
            studentId = parts[0];
            studentName = parts[1];
            if (parts.length >= 3) stuSection = parts[2];
          } else {
            studentName = parts[0] || rawLine;
          }
        } else if (rawLine.includes(',')) {
          // Comma separation could be:
          // 1. "ID, Name, Section"
          // 2. "ID, Name"
          // 3. "Lastname, Firstname"
          const parts = rawLine.split(',').map(p => p.trim()).filter(p => p.length > 0);
          if (parts.length >= 3) {
            // E.g. "STU-101, Juan Dela Cruz, Section A"
            studentId = parts[0];
            studentName = parts[1];
            stuSection = parts[2];
          } else if (parts.length === 2) {
            if (isLikelyStudentId(parts[0])) {
              // E.g. "2024-001, Juan Dela Cruz"
              studentId = parts[0];
              studentName = parts[1];
            } else if (isLikelyStudentId(parts[1])) {
              // E.g. "Juan Dela Cruz, 2024-001"
              studentName = parts[0];
              studentId = parts[1];
            } else {
              // E.g. "Dela Cruz, Juan" -> format as full name
              studentName = rawLine; // Keeps "Dela Cruz, Juan"
              studentId = ""; // Auto-generate ID
            }
          } else {
            studentName = rawLine;
          }
        } else {
          studentName = rawLine;
        }
      }
      
      if (!studentName) return;
      
      // If studentId was not specified or already exists, generate a unique one
      if (!studentId || existingIds.has(studentId.toUpperCase())) {
        let uniqueId = "";
        do {
          const randomNum = Math.floor(10000 + Math.random() * 90000);
          uniqueId = "STU-" + randomNum;
        } while (existingIds.has(uniqueId.toUpperCase()));
        studentId = uniqueId;
      }
      
      existingIds.add(studentId.toUpperCase());
      
      const newStudentRow = {
        "Student ID": String(studentId).trim(),
        "Name": String(studentName).trim(),
        "Section": String(stuSection).trim(),
        "Exam ID": String(examId).trim()
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
    const { examId, name, section, studentId: customStudentId } = body;
    if (!examId || !name || String(name).trim() === "") {
      return { success: false, error: "Missing examId or student name" };
    }
    
    // Look up exam default section if section was blank
    let studentSection = (section || "").toString().trim();
    if (!studentSection) {
      const exams = getRowsAsObjects("Exams");
      const exam = exams.find(e => String(e["Exam ID"]).trim() === String(examId).trim());
      if (exam && exam["Section"]) {
        studentSection = String(exam["Section"]).trim();
      }
    }
    if (!studentSection) studentSection = "Default";
    
    // Check existing student IDs
    const allStudents = getRowsAsObjects("Students");
    const existingForExam = allStudents.filter(s => String(s["Exam ID"]).trim() === String(examId).trim());
    const existingIds = new Set(existingForExam.map(s => String(s["Student ID"]).trim().toUpperCase()));
    
    let finalStudentId = customStudentId ? String(customStudentId).trim() : "";
    if (finalStudentId && existingIds.has(finalStudentId.toUpperCase())) {
      return { 
        success: false, 
        error: "Student ID '" + finalStudentId + "' is already enrolled in this exam roster. Please use a unique ID." 
      };
    }

    if (!finalStudentId) {
      let uniqueId = "";
      do {
        const randomNum = Math.floor(10000 + Math.random() * 90000);
        uniqueId = "STU-" + randomNum;
      } while (existingIds.has(uniqueId.toUpperCase()));
      finalStudentId = uniqueId;
    }
    
    const newStudentRow = {
      "Student ID": String(finalStudentId).trim(),
      "Name": String(name).trim(),
      "Section": String(studentSection).trim(),
      "Exam ID": String(examId).trim()
    };
    
    insertRow("Students", newStudentRow);
    return { 
      success: true, 
      student: {
        studentId: finalStudentId,
        name: String(name).trim(),
        section: studentSection,
        examId: String(examId).trim()
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
      const rowStuId = String(values[i - 2][0]).trim().toUpperCase();
      const rowExamId = String(values[i - 2][3]).trim();
      if (rowStuId === String(studentId).trim().toUpperCase() && rowExamId === String(examId).trim()) {
        sheet.deleteRow(i);
        return { success: true };
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
