import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";

const API_BASE = "https://api.maltechenterprises.com/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    try {
      console.log("Trying login...");

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      console.log("HTTP status:", res.status);

      const data = await res.json();
      console.log("LOGIN RESPONSE:", data);

      if (data.token) {
        localStorage.setItem("token", data.token);

        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
        } else {
          localStorage.removeItem("user");
        }
        global.token = data.token;
        global.user = data.user;
        router.push("/dashboard");
      } else {
        alert(data.error || data.message || "Login failed");
      }
    } catch (err) {
      console.error("LOGIN FETCH ERROR:", err);
      alert("Failed to fetch. Check backend/CORS.");
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.leftPanel}>
        <Text style={styles.brand}>MALTECH</Text>
        <Text style={styles.product}>VAT PRO</Text>

        <Text style={styles.headline}>
          Audit-ready VAT compliance for modern businesses.
        </Text>

        <Text style={styles.subtext}>
          Track VAT, link supporting documents, and generate filing packs with confidence.
        </Text>
      </View>

      <View style={styles.rightPanel}>
        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>Welcome back</Text>
          <Text style={styles.loginSubtitle}>
            Sign in to continue to VAT Pro
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.loginButton} onPress={login}>
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            VAT Pro by Maltech Digital
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F3F6FB",
  },
  leftPanel: {
    flex: 1,
    backgroundColor: "#0F3D91",
    padding: 56,
    justifyContent: "center",
  },
  brand: {
    fontSize: 36,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  product: {
    fontSize: 16,
    fontWeight: "800",
    color: "#DBEAFE",
    letterSpacing: 1.4,
    marginBottom: 48,
  },
  headline: {
    fontSize: 42,
    fontWeight: "900",
    color: "#FFFFFF",
    lineHeight: 50,
    maxWidth: 560,
    marginBottom: 20,
  },
  subtext: {
    fontSize: 17,
    color: "#DBEAFE",
    lineHeight: 26,
    maxWidth: 520,
  },
  rightPanel: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loginCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 34,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  loginTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 15,
    color: "#64748B",
    marginBottom: 28,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: "#F8FAFC",
    marginBottom: 14,
  },
  loginButton: {
    height: 52,
    backgroundColor: "#0F3D91",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  footerText: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 22,
  },
});