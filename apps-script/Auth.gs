/**
 * Teacher Authentication and Token Management
 */

// Helper to get passcode, initializing default if not set
function getTeacherPasscode() {
  const props = PropertiesService.getScriptProperties();
  let passcode = props.getProperty("TEACHER_PASSCODE");
  if (!passcode) {
    passcode = "102799"; // Default passcode from design guidelines
    props.setProperty("TEACHER_PASSCODE", passcode);
  }
  return passcode;
}

// Handler for teacher login action
function handleTeacherLogin(body) {
  const passcode = body.passcode;
  const storedPasscode = getTeacherPasscode();
  
  if (passcode === storedPasscode) {
    // Generate a fresh session token
    const token = generateUUID();
    PropertiesService.getScriptProperties().setProperty("TEACHER_TOKEN", token);
    return { success: true, token: token };
  }
  
  return { success: false, error: "Incorrect passcode. Please try again." };
}

// Handler for changing teacher passcode
function handleChangePasscode(body) {
  const token = body.token;
  if (!verifyTeacherToken(token)) {
    return { success: false, error: "Unauthorized access" };
  }
  
  const newPasscode = body.newPasscode;
  if (!newPasscode || newPasscode.toString().trim().length < 4) {
    return { success: false, error: "Passcode must be at least 4 characters long." };
  }
  
  PropertiesService.getScriptProperties().setProperty("TEACHER_PASSCODE", newPasscode.toString().trim());
  return { success: true };
}

// Verify that the provided token matches the active session token
function verifyTeacherToken(token) {
  if (!token) return false;
  const storedToken = PropertiesService.getScriptProperties().getProperty("TEACHER_TOKEN");
  return token === storedToken;
}
