export const getToken = () => {
  try {
    return localStorage.getItem("token");
  } catch (error) {
    console.error("getToken error:", error);
    return null;
  }
};

export const getStoredUser = () => {
  try {
    const rawUser = localStorage.getItem("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch (error) {
    console.error("getStoredUser error:", error);
    return null;
  }
};

export const getSelectedCompany = () => {
  try {
    const rawCompany = localStorage.getItem("selectedCompany");
    return rawCompany ? JSON.parse(rawCompany) : null;
  } catch (error) {
    console.error("getSelectedCompany error:", error);
    return null;
  }
};

export const clearSession = () => {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("selectedCompany");
  } catch (error) {
    console.error("clearSession error:", error);
  }
};

export const handleSessionExpired = (
  message = "Session expired. Please log in again."
) => {
  clearSession();

  try {
    alert(message);
  } catch (error) {
    console.error("alert error:", error);
  }

  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
};