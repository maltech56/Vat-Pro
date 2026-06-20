import { useEffect } from "react";
import { CompanyProvider } from "../context/CompanyContext";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
    }
  }, []);

 return (
  <ThemeProvider
    value={colorScheme === "dark"
      ? DarkTheme
      : DefaultTheme}
  >
    <Stack initialRouteName="index">
      ...
    </Stack>
    <StatusBar style="auto" />
  </ThemeProvider>
);
}