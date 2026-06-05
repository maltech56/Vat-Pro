import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";

const API_BASE =
  process.env.NODE_ENV === "development"
    ? "http://localhost:5000/api"
    : "https://api.maltechenterprises.com/api";

import { useRouter } from "expo-router";

export default function Register() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const handleRegister = async () => {
    console.log("HANDLE REGISTER STARTED");

    console.log("FORM VALUES:", {
      companyName,
      email,
      phone,
      passwordLength: password.length,
      confirmPasswordLength: confirmPassword.length,
    });

    if (password !== confirmPassword) {
      console.log("PASSWORDS DO NOT MATCH");

      Alert.alert(
        "Error",
        "Passwords do not match"
      );

      return;
    }

    try {
      console.log("ABOUT TO CALL FETCH");

      const response = await fetch(
        `${API_BASE}/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            companyName,
            email,
            password,
            phone,
          }),
        }
      );

      console.log(
        "RESPONSE STATUS:",
        response.status
      );

      const data = await response.json();

      console.log(
        "REGISTER RESPONSE:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Registration failed"
        );
      }

      setRegistrationComplete(true);

    } catch (error) {

      console.error(
        "REGISTER ERROR:",
        error
      );

      Alert.alert(
        "Registration Failed",
        error.message
      );
    }
  };

  if (registrationComplete) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <Text
          style={{
            fontSize: 26,
            fontWeight: "bold",
            color: "green",
            marginBottom: 20,
          }}
        >
          ✓ Trial Account Created Successfully
        </Text>

        <Text
          style={{
            textAlign: "center",
            fontSize: 16,
            marginBottom: 30,
          }}
        >
          Your 14-day Maltech VAT Pro trial is now active.
          {"\n\n"}
          Please sign in using your email and password.
        </Text>

        <TouchableOpacity
          onPress={() => router.replace("/")}
          style={{
            backgroundColor: "#2563eb",
            paddingVertical: 14,
            paddingHorizontal: 30,
            borderRadius: 10,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontWeight: "bold",
            }}
          >
            Go To Login
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Start Free Trial
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Company Name"
        value={companyName}
        onChangeText={setCompanyName}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Phone"
        value={phone}
        onChangeText={setPhone}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          console.log("BUTTON CLICKED");
          handleRegister();
        }}
      >
        <Text style={styles.buttonText}>
          Activate 14-Day Trial
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push("/")}
      >
        <Text style={styles.backText}>
          Back to Login
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F7F8FA",
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
    textAlign: "center",
  },

  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#ddd",
  },

  button: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },

  backButton: {
    marginTop: 16,
    alignItems: "center",
  },

  backText: {
    color: "#2563EB",
    fontWeight: "600",
  },
});