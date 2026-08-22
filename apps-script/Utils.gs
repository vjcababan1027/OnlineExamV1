/**
 * Google Sheets Database Utilities for Proctor Exam System
 */

// Global Sheet Schemas dictionary
const SHEET_SCHEMAS = {
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

// Helper to response standard CORS JSON format
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Get the spreadsheet (supports both container-bound and standalone scripts)
function getSpreadsheet() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  
  // If standalone script, check if ID was saved in Script Properties
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty("SPREADSHEET_ID");
  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch(e) {
      Logger.log("Failed to open spreadsheet by ID: " + e);
    }
  }
  
  // Create a new database spreadsheet automatically if standalone
  ss = SpreadsheetApp.create("ProctorExam_Database");
  props.setProperty("SPREADSHEET_ID", ss.getId());
  return ss;
}

// Automatically get or create the requested sheet tab with headers on the fly
function getOrCreateSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  const headers = SHEET_SCHEMAS[sheetName] || [];
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  // Ensure headers exist if sheet is empty
  if (headers.length > 0 && (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0)) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#4a4a72")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

// Retrieve rows of a sheet mapped as javascript objects using the schema headers
function getRowsAsObjects(sheetName) {
  const sheet = getOrCreateSheet(sheetName);
  const headers = SHEET_SCHEMAS[sheetName] || [];
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1 || headers.length === 0) return [];
  
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  
  return values.map((row, rowIndex) => {
    const obj = { _rowNum: rowIndex + 2 }; // Store actual Google Sheet row index (1-based, starts at 2)
    headers.forEach((header, colIndex) => {
      obj[header] = row[colIndex];
    });
    return obj;
  });
}

// Insert a row object matching headers
function insertRow(sheetName, dataObj) {
  const sheet = getOrCreateSheet(sheetName);
  const headers = SHEET_SCHEMAS[sheetName] || [];
  
  if (headers.length === 0) return false;
  
  const newRow = headers.map(header => {
    const key = header.toString().trim();
    return (dataObj.hasOwnProperty(key) && dataObj[key] !== undefined) ? dataObj[key] : "";
  });
  
  sheet.appendRow(newRow);
  return true;
}

// Update a row in a sheet matching a criteria (e.g. column value)
function updateRow(sheetName, searchKey, searchValue, updateData) {
  const sheet = getOrCreateSheet(sheetName);
  const headers = SHEET_SCHEMAS[sheetName] || [];
  const rows = getRowsAsObjects(sheetName);
  const matchedRow = rows.find(r => r[searchKey] == searchValue);
  
  if (!matchedRow) return false;
  
  const rowNum = matchedRow._rowNum;
  
  headers.forEach((header, index) => {
    const key = header.toString().trim();
    if (updateData.hasOwnProperty(key) && updateData[key] !== undefined) {
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
 * Manual setup utility function.
 */
function setupSheets() {
  const ss = getSpreadsheet();
  Object.keys(SHEET_SCHEMAS).forEach(name => {
    getOrCreateSheet(name);
  });
  
  // Clean up default Sheet1 if empty
  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }
}
