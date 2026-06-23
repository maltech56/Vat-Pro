import { Stack } from "expo-router";
import { CompanyProvider } from "../context/CompanyContext";

export default function RootLayout() {
  return (
    <CompanyProvider>
      <Stack />
    </CompanyProvider>
  );
}