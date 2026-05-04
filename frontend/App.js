import React, { useState } from "react";
import LoginScreen from "./src/screens/loginScreen";
import DashboardScreen from "./src/screens/dashBoardScreen";

export default function App() {
  const [token, setToken] = useState(null);

  if (!token) {
    return <LoginScreen onLogin={setToken} />;
  }

  return <dataashboardScreen token={token} />;
}