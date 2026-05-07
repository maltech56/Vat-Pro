import { handleSessionExpired } from "./auth";

export const handleApiAuthError = async (response) => {
  if (!response) return false;

  if (response.status === 401) {
    let message = "Session expired. Please log in again.";

    try {
      const data = await response.clone().json();

      if (data?.error || data?.message) {
        message = data.error || data.message;
      }
    } catch (error) {
      // Ignore parse error and use default message
    }

    handleSessionExpired(message);
    return true;
  }

  if (response.status === 403) {
    let message = "Access denied.";

    try {
      const data = await response.clone().json();

      if (data?.error || data?.message) {
        message = data.error || data.message;
      }
    } catch (error) {
      // Ignore parse error and use default message
    }

    alert(message);
    return true;
  }

  return false;
};