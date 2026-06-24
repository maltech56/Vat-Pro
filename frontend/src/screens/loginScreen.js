import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { loginUser } from "../services/authService";

export default function LoginScreen({
  onLogin,
  onShowRegister,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);

      const data = await loginUser(
        email.trim(),
        password
      );

      localStorage.setItem(
        "token",
        data.token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      onLogin(data.token);
    } catch (error) {
      Alert.alert(
        "Login Failed",
        error.message || "Unable to sign in."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.leftPanel}>
        <Text style={styles.brand}>
          MALTECH
        </Text>

        <Text style={styles.product}>
          VAT PRO
        </Text>

        <Text style={styles.headline}>
          Audit-ready VAT compliance for modern businesses.
        </Text>

        <Text style={styles.subtext}>
          Track VAT transactions, link supporting
          documents, prepare VAT returns, generate
          filing packs, and stay audit-ready with
          confidence.
        </Text>

        <View style={styles.featureList}>
          <Text style={styles.feature}>
            ✓ Multi-Company Management
          </Text>

          <Text style={styles.feature}>
            ✓ VAT Return Preparation
          </Text>

          <Text style={styles.feature}>
            ✓ Audit Readiness Dashboard
          </Text>

          <Text style={styles.feature}>
            ✓ Document Management
          </Text>

          <Text style={styles.feature}>
            ✓ Filing Pack Generation
          </Text>

          <Text style={styles.feature}>
            ✓ QuickBooks Integration
          </Text>
        </View>
      </View>

      <View style={styles.rightPanel}>
        <ScrollView
          contentContainerStyle={
            styles.scrollContainer
          }
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>
              Welcome Back
            </Text>

            <Text style={styles.loginSubtitle}>
              Sign in to continue to VAT Pro
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Email Address"
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

            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.loginButtonText}>
                {loading
                  ? "Signing In..."
                  : "Sign In"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.trialButton}
              onPress={onShowRegister}
            >
              <Text style={styles.trialButtonText}>
                Start Free 14-Day Trial
              </Text>
            </TouchableOpacity>

            <Text style={styles.footerText}>
              VAT Pro by Maltech Digital
            </Text>
          </View>
        </ScrollView>
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
    fontSize: 42,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 4,
  },

  product: {
    fontSize: 18,
    fontWeight: "800",
    color: "#DBEAFE",
    letterSpacing: 2,
    marginBottom: 48,
  },

  headline: {
    fontSize: 42,
    fontWeight: "900",
    color: "#FFFFFF",
    lineHeight: 50,
    marginBottom: 20,
    maxWidth: 560,
  },

  subtext: {
    fontSize: 17,
    color: "#DBEAFE",
    lineHeight: 28,
    maxWidth: 520,
    marginBottom: 32,
  },

  featureList: {
    marginTop: 10,
  },

  feature: {
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 12,
    fontWeight: "600",
  },

  rightPanel: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },

  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    width: "100%",
  },

  loginCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 34,
    borderWidth: 1,
    borderColor: "#E2E8F0",

    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },

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
    height: 52,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: "#F8FAFC",
    marginBottom: 14,
  },

  loginButton: {
    height: 54,
    backgroundColor: "#0F3D91",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  trialButton: {
    marginTop: 18,
    alignItems: "center",
  },

  trialButtonText: {
    color: "#0F3D91",
    fontSize: 15,
    fontWeight: "800",
  },

  footerText: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 24,
  },
});