import { API_BASE } from "../api/config";

export async function loginUser(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = response;

  if (!response.ok) {
    throw new Error(data.error || "Login failed");
  }

  return data;
}