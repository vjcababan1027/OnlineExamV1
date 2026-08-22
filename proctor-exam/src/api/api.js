/**
 * API Service wrapper for Google Apps Script Web App
 */

export async function callApi(action, payload = {}) {
  const apiUrl = import.meta.env.VITE_API_URL || localStorage.getItem('PROCTOR_API_URL') || '';
  
  if (!apiUrl) {
    throw new Error("Google Apps Script API URL is not set. Please set VITE_API_URL or configure it in Settings.");
  }
  
  try {
    // To avoid CORS preflight OPTIONS requests (which Apps Script web apps do not support),
    // we make a simple request by letting fetch send it as text/plain or default.
    // Apps Script doPost parses e.postData.contents as JSON anyway.
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: JSON.stringify({ action, ...payload })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check if backend returned a logical error
    if (data.success === false) {
      throw new Error(data.error || "An unknown server error occurred.");
    }
    
    return data;
  } catch (error) {
    console.error("API Call Failed:", error);
    throw error;
  }
}
