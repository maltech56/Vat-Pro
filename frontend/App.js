import React, { useState } from "react";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import DashboardScreen from "./src/screens/DashBoardScreen";

export default function App() {
  const [token, setToken] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  if (!token) {
    return showRegister ? (
      <RegisterScreen
        onBackToLogin={() => setShowRegister(false)}
      />
    ) : (
      <LoginScreen
        onLogin={setToken}
        onShowRegister={() => setShowRegister(true)}
      />
    );
  }

  return <DashboardScreen token={token} />;
}