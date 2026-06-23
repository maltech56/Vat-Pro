import { API_BASE } from "../api/config";

console.log("AUTH SERVICE API_BASE =", API_BASE);

export async function loginUser(email, password) {
  console.log("LOGIN USING API_BASE =", API_BASE);

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Login failed");
  }

  return data;
}