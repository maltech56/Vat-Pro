const isLocalhost =
  typeof window !== "undefined" &&
  window.location.hostname === "localhost";

export const API_BASE = isLocalhost
  ? "http://localhost:5000/api"
  : "https://api.maltechenterprises.com/api";   