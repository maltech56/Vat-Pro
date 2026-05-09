const hasLocalStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const getToken = () => {
  if (!hasLocalStorage()) return null;
  return window.localStorage.getItem("token");
};

export const getUser = () => {
  try {
    if (!hasLocalStorage()) return null;

    const user = window.localStorage.getItem("user");

    if (!user || user === "undefined" || user === "null") {
      return null;
    }

    return JSON.parse(user);
  } catch (error) {
    console.error("Error parsing user from session:", error);

    if (hasLocalStorage()) {
      window.localStorage.removeItem("user");
    }

    return null;
  }
};

export const getSelectedCompany = () => {
  try {
    if (!hasLocalStorage()) return null;

    const raw = window.localStorage.getItem("selectedCompany");
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("Error parsing selected company:", error);
    return null;
  }
};

export const setSelectedCompany = (company) => {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem("selectedCompany", JSON.stringify(company));
};

export const clearSession = () => {
  if (!hasLocalStorage()) return;

  window.localStorage.removeItem("token");
  window.localStorage.removeItem("user");
  window.localStorage.removeItem("selectedCompany");
};

export const forceLogout = (
  message = "Your session has expired. Please log in again."
) => {
  clearSession();

  if (typeof window !== "undefined") {
    alert(message);
    window.location.href = "/";
  }
};

export const getCompanyStorageKey = (companyId, key) => {
  if (!companyId || !key) return null;
  return `company_${companyId}_${key}`;
};

export const setCompanyCache = (companyId, key, value) => {
  if (!hasLocalStorage()) return;

  const storageKey = getCompanyStorageKey(companyId, key);
  if (!storageKey) return;

  window.localStorage.setItem(storageKey, JSON.stringify(value));
};

export const getCompanyCache = (companyId, key) => {
  try {
    if (!hasLocalStorage()) return null;

    const storageKey = getCompanyStorageKey(companyId, key);
    if (!storageKey) return null;

    const value = window.localStorage.getItem(storageKey);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("Failed to parse company cache:", error);
    return null;
  }
};

export const clearCompanyCache = (companyId) => {
  if (!hasLocalStorage() || !companyId) return;

  Object.keys(window.localStorage).forEach((key) => {
    if (key.startsWith(`company_${companyId}_`)) {
      window.localStorage.removeItem(key);
    }
  });
};