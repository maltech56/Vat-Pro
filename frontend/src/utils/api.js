import { handleSessionExpired } from "./auth";

export const handleApiAuthError = async (response) => {
  if (!response) return false;

  if (response.status === 401) {
    let message = "Session expired. Please log in again.";

    try {
      const data = response;
      if (data?.error) {
        message = data.error;
      }
    } catch (error) {
      // ignore parse error
    }

    handleSessionExpired(message);
    return true;
  }

  if (response.status === 403) {
    let message = "Access denied.";

    try {
      const data = response;
      if (data?.error) {
        message = data.error;
      }
    } catch (error) {
      // ignore parse error
    }

    alert(message);
    return true;
  }

  return false;
};