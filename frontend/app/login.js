import LoginScreen from "../src/screens/LoginScreen";
import { router } from "expo-router";

export default function Login() {
  return (
    <LoginScreen
      onLogin={() => {
        router.replace("/dashboard");
      }}
      onShowRegister={() => {
        router.push("/register");
      }}
    />
  );
}