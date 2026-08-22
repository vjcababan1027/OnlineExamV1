/**
 * Google Sheets Database Utilities for Proctor Exam System
 */

// Helper to response standard CORS JSON format
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Get the active spreadsheet
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// Retrieve rows of a sheet mapped as javascript objects using the header row
function getRowsAsObjects(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);
  
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1) return []; // Only headers or empty
  
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  
  return values.map((row, rowIndex) => {
    const obj = { _rowNum: rowIndex + 2 }; // Store actual Google Sheet row index (1-based, starts at 2)
    headers.forEach((header, colIndex) => {
      if (header) {
        obj[header.toString().trim()] = row[colIndex];
      }
    });
    return obj;
  });
}

// Insert a row object matching headers
function insertRow(sheetName, dataObj) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);
  
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  
  const newRow = new Array(lastColumn).fill("");
  headers.forEach((header, index) => {
    const key = header.toString().trim();
    if (dataObj.hasOwnProperty(key)) {
      newRow[index] = dataObj[key];
    }
  });
  
  sheet.appendRow(newRow);
  return true;
}

// Update a row in a sheet matching a criteria (e.g. column value)
function updateRow(sheetName, searchKey, searchValue, updateData) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);
  
  const rows = getRowsAsObjects(sheetName);
  const matchedRow = rows.find(r => r[searchKey] == searchValue);
  
  if (!matchedRow) return false;
  
  const rowNum = matchedRow._rowNum;
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  
  headers.forEach((header, index) => {
    const key = header.toString().trim();
    if (updateData.hasOwnProperty(key)) {
      sheet.getRange(rowNum, index + 1).setValue(updateData[key]);
    }
  });
  return true;
}

// Thread-safe lock utility to run transactions
function runWithLock(callback) {
  const lock = LockService.getScriptLock();
  try {
    // Wait up to 30 seconds for lock
    lock.waitLock(30000);
    return callback();
  } catch (e) {
    Logger.log("Failed to acquire lock: " + e.toString());
    throw new Error("Server is busy, please try again.");
  } finally {
    lock.releaseLock();
  }
}

// Generate UUID
function generateUUID() {
  return Utilities.getUuid();
}

/**
 * RUN THIS ONCE FROM THE APPS SCRIPT EDITOR TO SET UP ALL SHEETS.
 * Go to Apps Script → select "setupSheets" from the function dropdown → click Run.
 * This will create all required tabs with correct headers automatically.
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const schemas = {
    "Exams": [
      "Exam ID", "Title", "Code", "Section", "Duration (Mins)",
      "Start Time", "End Time", "Deduction", "Max Violations",
      "Randomize", "Status", "Created At"
    ],
    "Students": [
      "Student ID", "Name", "Section", "Exam ID"
    ],
    "Questions": [
      "Question ID", "Exam ID", "Number", "Type", "Question Text",
      "A", "B", "C", "D", "Answer", "Points"
    ],
    "Attempts": [
      "Attempt ID", "Exam ID", "Student ID", "Start Time", "End Time",
      "Score", "Deduction", "Final Score", "Status"
    ],
    "Answers": [
      "Answer ID", "Attempt ID", "Question ID", "Selected Answer",
      "Time Used", "Submitted At"
    ],
    "Violations": [
      "Violation ID", "Attempt ID", "Type", "Timestamp"
    ]
  };

  Object.entries(schemas).forEach(([sheetName, headers]) => {
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      Logger.log("Created sheet: " + sheetName);
    } else {
      Logger.log("Sheet already exists: " + sheetName);
    }

    // Write headers only if row 1 is completely empty
    const existingHeader = sheet.getRange(1, 1).getValue();
    if (!existingHeader) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      // Style the header row
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground("#4a4a72")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
      Logger.log("Headers written for: " + sheetName);
    }
  });

  // Remove the default "Sheet1" if it's empty and still exists
  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
    Logger.log("Removed default Sheet1");
  }

  SpreadsheetApp.getUi().alert(
    "✅ Setup Complete!\n\nAll 6 sheets have been created:\n• Exams\n• Students\n• Questions\n• Attempts\n• Answers\n• Violations\n\nYou can now deploy this as a Web App."
  );
}

