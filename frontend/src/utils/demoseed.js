import { getToken } from "./session";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.maltechenterprises.com/api";

export const seedDemoDataIfNeeded = async () => {
  const alreadySeeded = localStorage.getItem("demoSeeded");

  if (alreadySeeded === "true") {
    return null;
  }

  const token = getToken();

  if (!token) {
    return null;
  }

  const response = await fetch(`${API_BASE}/demo/seed`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = response;

  if (!response.ok) {
    throw new Error(data.error || "Failed to create demo data");
  }

  localStorage.setItem("demoSeeded", "true");

  return data;
};