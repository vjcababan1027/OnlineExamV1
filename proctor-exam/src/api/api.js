/**
 * API Service wrapper for Google Apps Script Web App
 */

export async function callApi(action, payload = {}) {
  // Always read from localStorage at call time so a freshly-saved URL is used immediately
  const apiUrl = import.meta.env.VITE_API_URL || localStorage.getItem('PROCTOR_API_URL') || '';

  if (!apiUrl) {
    throw new Error("Google Apps Script API URL is not configured. Please log in as a teacher and set it up.");
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ action, ...payload }),
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success === false) {
      throw new Error(data.error || "An unknown server error occurred.");
    }

    return data;
  } catch (error) {
    console.error("API Call Failed:", error);
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(
        "Failed to fetch from Google Apps Script. Please verify:\n" +
        "1. Web App 'Who has access' is set to 'Anyone' (NOT 'Only myself').\n" +
        "2. Web App 'Execute as' is set to 'Me'.\n" +
        "3. You are using the '/exec' deployment URL (not '/dev').\n" +
        "4. You have authorized the script permissions in Apps Script editor."
      );
    }
    throw error;
  }
}
