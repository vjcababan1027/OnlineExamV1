/**
 * API Service wrapper for Google Apps Script Web App with Automatic Network Retry Loop
 */

export async function callApi(action, payload = {}, options = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1500,
    critical = false, // Critical calls (submitAnswer, finishAttempt) will keep retrying until online/success
    onRetry = null    // Callback for UI updates: onRetry(attemptNum, message)
  } = options;

  // Always read from localStorage at call time so a freshly-saved URL is used immediately
  const apiUrl = import.meta.env.VITE_API_URL || localStorage.getItem('PROCTOR_API_URL') || '';

  if (!apiUrl) {
    throw new Error("Google Apps Script API URL is not configured. Please log in as a teacher and set it up.");
  }

  const isOnline = () => (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true);

  let attempt = 0;
  const effectiveMaxRetries = critical ? Infinity : maxRetries;

  while (true) {
    attempt++;

    // 1. If device is currently offline, wait until internet connection returns
    while (!isOnline()) {
      if (onRetry) onRetry(attempt, "Waiting for internet connection...");
      await new Promise(resolve => setTimeout(resolve, retryDelay));
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

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        // If Google Apps Script returned an HTML error page (e.g. doPost not found or busy)
        if (text.includes("doPost") || text.includes("Exception:")) {
          const match = text.match(/<div[^>]*>([^<]+)<\/div>/i);
          const errText = match ? match[1] : "Script error in Google Apps Script";
          throw new Error(errText);
        }
        throw new Error("Invalid response from server. Please verify Google Apps Script deployment.");
      }

      if (data.success === false) {
        // If it's a permanent validation error (e.g., incorrect password, invalid token), do not retry
        if (data.error && (data.error.includes("passcode") || data.error.includes("Unauthorized") || data.error.includes("not found"))) {
          throw new Error(data.error);
        }
        throw new Error(data.error || "An unknown server error occurred.");
      }

      return data;
    } catch (error) {
      console.warn(`API [${action}] Attempt ${attempt} failed:`, error.message);

      // Check if we should stop retrying
      const isPermanentError = error.message.includes("passcode") || 
                               error.message.includes("Unauthorized") || 
                               error.message.includes("not found");

      if (isPermanentError || (!critical && attempt >= effectiveMaxRetries)) {
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

      // Notify UI about retry status
      if (onRetry) {
        onRetry(attempt, `Network issue, retrying (${attempt})...`);
      }

      // Wait before next retry attempt (with slight backoff up to 5 seconds)
      const waitTime = Math.min(retryDelay * (1 + (attempt - 1) * 0.5), 5000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

