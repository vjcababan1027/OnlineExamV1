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
  
  if (passcode && passcode.toString().trim() === storedPasscode.toString().trim()) {
    // Generate a fresh session token
    const token = generateUUID();
    const props = PropertiesService.getScriptProperties();
    
    // Store in multi-session tokens list
    let tokens = [];
    try {
      tokens = JSON.parse(props.getProperty("TEACHER_TOKENS") || "[]");
    } catch (e) {
      tokens = [];
    }
    if (!Array.isArray(tokens)) tokens = [];
    tokens.push(token);
    if (tokens.length > 20) tokens = tokens.slice(-20);
    
    props.setProperty("TEACHER_TOKENS", JSON.stringify(tokens));
    props.setProperty("TEACHER_TOKEN", token); // Backward compatibility
    
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

// Verify that the provided token matches an active session token
function verifyTeacherToken(token) {
  if (!token) return false;
  const props = PropertiesService.getScriptProperties();
  const tokenStr = token.toString().trim();
  
  // 1. Check legacy single token
  const legacyToken = props.getProperty("TEACHER_TOKEN");
  if (tokenStr === legacyToken) return true;
  
  // 2. Check multi-session tokens array
  try {
    const tokens = JSON.parse(props.getProperty("TEACHER_TOKENS") || "[]");
    if (Array.isArray(tokens) && tokens.indexOf(tokenStr) !== -1) {
      return true;
    }
  } catch(e) {}
  
  // 3. Allow current passcode as master authentication key
  const storedPasscode = getTeacherPasscode();
  if (tokenStr === storedPasscode) return true;
  
  return false;
}

