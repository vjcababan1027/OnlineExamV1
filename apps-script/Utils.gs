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
