export const getToken = () => localStorage.getItem("token");

export const getUser = () => {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
};

export const getSelectedCompany = () => {
  const raw = localStorage.getItem("selectedCompany");
  return raw ? JSON.parse(raw) : null;
};

export const setSelectedCompany = (company) => {
  localStorage.setItem("selectedCompany", JSON.stringify(company));
};

export const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("selectedCompany");
};

export const forceLogout = (
  message = "Your session has expired. Please log in again."
) => {
  clearSession();

  alert(message);
  window.location.href = "/";
};

// Company-scoped cache helpers
// Prevents data from one company being reused for another company

export const getCompanyStorageKey = (companyId, key) => {
  if (!companyId || !key) return null;
  return `company_${companyId}_${key}`;
};

export const setCompanyCache = (companyId, key, value) => {
  const storageKey = getCompanyStorageKey(companyId, key);
  if (!storageKey) return;

  localStorage.setItem(storageKey, JSON.stringify(value));
};

export const getCompanyCache = (companyId, key) => {
  const storageKey = getCompanyStorageKey(companyId, key);
  if (!storageKey) return null;

  const value = localStorage.getItem(storageKey);

  try {
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("Failed to parse company cache:", error);
    return null;
  }
};

export const clearCompanyCache = (companyId) => {
  if (!companyId) return;

  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith(`company_${companyId}_`)) {
      localStorage.removeItem(key);
    }
  });
};