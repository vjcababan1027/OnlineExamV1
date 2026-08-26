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
      // 2. Delimited string: "ID, Name" or "ID | Name" or "ID \t Name" or just "Name"
      if (typeof studentEntry === 'object' && studentEntry.name) {
        studentName = String(studentEntry.name).trim();
        studentId = studentEntry.studentId ? String(studentEntry.studentId).trim() : "";
        stuSection = studentEntry.section ? String(studentEntry.section).trim() : defaultSection;
      } else {
        const delimiters = ['|', '\t', ','];
        let matchedDelim = null;
        for (let d of delimiters) {
          if (rawLine.includes(d)) {
            matchedDelim = d;
            break;
          }
        }
        
        if (matchedDelim) {
          const parts = rawLine.split(matchedDelim).map(p => p.trim()).filter(p => p.length > 0);
          if (parts.length >= 2) {
            // Check if first part looks like an ID (e.g. STU-xxx, 2024-xxx, numbers)
            studentId = parts[0];
            studentName = parts[1];
            if (parts.length >= 3) stuSection = parts[2];
          } else {
            studentName = parts[0] || rawLine;
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
        "Student ID": studentId,
        "Name": studentName,
        "Section": stuSection,
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
    
    // Check existing student IDs to prevent duplicates
    const allStudents = getRowsAsObjects("Students");
    const existingForExam = allStudents.filter(s => String(s["Exam ID"]).trim() === String(examId).trim());
    const existingIds = new Set(existingForExam.map(s => String(s["Student ID"]).trim().toUpperCase()));
    
    let finalStudentId = customStudentId ? String(customStudentId).trim() : "";
    if (!finalStudentId || existingIds.has(finalStudentId.toUpperCase())) {
      let uniqueId = "";
      do {
        const randomNum = Math.floor(10000 + Math.random() * 90000);
        uniqueId = "STU-" + randomNum;
      } while (existingIds.has(uniqueId.toUpperCase()));
      finalStudentId = uniqueId;
    }
    
    const newStudentRow = {
      "Student ID": finalStudentId,
      "Name": String(name).trim(),
      "Section": studentSection,
      "Exam ID": examId
    };
    
    insertRow("Students", newStudentRow);
    return { 
      success: true, 
      student: {
        studentId: finalStudentId,
        name: String(name).trim(),
        section: studentSection,
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
      const rowStuId = String(values[i - 2][0]).trim();
      const rowExamId = String(values[i - 2][3]).trim();
      if (rowStuId === String(studentId).trim() && rowExamId === String(examId).trim()) {
        sheet.deleteRow(i);
        return { success: true };
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
