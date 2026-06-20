import { useEffect } from "react";
import { CompanyProvider } from "../context/CompanyContext";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";


import { useColorScheme } from "@/hooks/use-color-scheme";

export default function RootLayout() {
 return (
  <Stack initialRouteName="index">
    <Stack.Screen
      name="index"
      options={{ headerShown: false }}
    />

    <Stack.Screen
      name="dashboard"
      options={{ headerShown: false }}
    />
  </Stack>
);
}