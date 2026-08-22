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
    throw error;
  }
}
