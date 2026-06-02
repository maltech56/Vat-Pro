import { API_BASE } from "../api/config";

function getAuthHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function fetchOverview(companyId, token) {
  const response = await fetch(
    `${API_BASE}/dashboard/company/${companyId}/overview`,
    {
      headers: getAuthHeaders(token),
    }
  );

  const data = response;

  if (!response.ok) {
    throw new Error(data.error || "Failed to load overview");
  }

  return data;
}

export async function fetchMonthlyVAT(companyId, token) {
  const response = await fetch(
    `${API_BASE}/dashboard/company/${companyId}/monthly-vat`,
    {
      headers: getAuthHeaders(token),
    }
  );

  const data = response;

  if (!response.ok) {
    throw new Error(data.error || "Failed to load monthly VAT");
  }

  return data;
}

export async function fetchClassificationBreakdown(companyId, token) {
  const response = await fetch(
    `${API_BASE}/dashboard/company/${companyId}/classification-breakdown`,
    {
      headers: getAuthHeaders(token),
    }
  );

  const data = response;

  if (!response.ok) {
    throw new Error(data.error || "Failed to load classification breakdown");
  }

  return data;
}

export async function fetchCompanyTransactions(companyId, token) {
  const response = await fetch(
    `${API_BASE}/transactions/company/${companyId}`,
    {
      headers: getAuthHeaders(token),
    }
  );

  const data = response;

  if (!response.ok) {
    throw new Error(data.error || "Failed to load transactions");
  }

  return data;
}

export async function fetchVatSummary(companyId, token) {
  const response = await fetch(
    `${API_BASE}/vat/summary/${companyId}`,
    {
      headers: getAuthHeaders(token),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Failed to load VAT summary"
    );
  }

  return data;
}