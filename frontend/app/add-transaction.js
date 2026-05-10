import React, { useState, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { calculateVAT } from "../src/utils/vat";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { getToken, getSelectedCompany } from "../src/utils/session";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.maltechdigital.com/api";

export default function AddTransaction({ defaultType = "sale", onSaved }) {
  const [form, setForm] = useState({
    type: defaultType,
    amountExVat: "",
    vatAmount: "",
    classification: "taxable",
    transactionDate: "",
    description: "",
  });

  const isPurchaseMode = defaultType === "expense";

  const updateFormField = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === "amountExVat" || field === "classification") {
        const vatAmount = calculateVAT(
          updated.amountExVat,
          updated.classification
        );

        updated.vatAmount = String(vatAmount);
      }

      return updated;
    });
  };

  const handleSubmit = async () => {
    try {
      const token = getToken();
      const company = getSelectedCompany();

      if (!token) {
        alert("No token found. Please log in again.");
        return;
      }

      if (!company || !company.id) {
        alert("No company selected.");
        return;
      }

      const payload = {
        companyId: company.id,
        type: form.type,
        amountExVat: parseFloat(form.amountExVat) || 0,
        classification: form.classification,
        transactionDate:
          form.transactionDate || new Date().toISOString().split("T")[0],
        description: form.description,
      };

      console.log("Submitting transaction payload:", payload);

      const res = await fetch(`${API_BASE}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const rawText = await res.text();
      console.log("Transaction response:", rawText);

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        throw new Error(`Server returned non-JSON response: ${rawText}`);
      }

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to save transaction");
      }

      alert("Transaction saved successfully");

      if (onSaved) onSaved();

      setForm({
        type: defaultType,
        amountExVat: "",
        vatAmount: "",
        classification: "taxable",
        transactionDate: "",
        description: "",
      });

    } catch (error) {
      console.error("Add transaction error:", error);
      alert(error.message || "Something went wrong");
    }
  };


  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {isPurchaseMode ? "Add Purchase" : "Add Transaction"}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Amount (Ex VAT)"
        value={form.amountExVat}
        keyboardType="numeric"
        onChangeText={(text) => updateFormField("amountExVat", text)}
      />

      <TextInput
        style={styles.input}
        placeholder="VAT Amount"
        value={form.vatAmount}
        editable={false}
      />

      <TextInput
        style={styles.input}
        placeholder="Description"
        value={form.description}
        onChangeText={(text) => updateFormField("description", text)}
      />

      {/* ✅ TYPE */}
      <Text style={styles.label}>Type</Text>

      {isPurchaseMode ? (
        <TextInput
          style={styles.input}
          value="Expense"
          editable={false}
        />
      ) : (
        <View style={styles.selectWrap}>
          <TouchableOpacity onPress={() => updateFormField("type", "sale")}>
            <Text style={styles.selectOption}>Sale</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => updateFormField("type", "expense")}>
            <Text style={styles.selectOption}>Expense</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* ✅ CLASSIFICATION */}
      <Text style={styles.label}>VAT Classification</Text>
      <View style={styles.selectWrap}>
        <TouchableOpacity onPress={() => updateFormField("classification", "taxable")}>
          <Text style={styles.selectOption}>Taxable</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => updateFormField("classification", "zero_rated")}>
          <Text style={styles.selectOption}>Zero-rated</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => updateFormField("classification", "exempt")}>
          <Text style={styles.selectOption}>Exempt</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Transaction Date (YYYY-MM-DD)"
        value={form.transactionDate}
        onChangeText={(text) => updateFormField("transactionDate", text)}
      />

      <Button
        title={isPurchaseMode ? "Save Purchase" : "Save Transaction"}
        onPress={handleSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#0f172a",
  },
  title: {
    fontSize: 24,
    color: "white",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  label: {
    color: "white",
    marginBottom: 6,
    fontWeight: "600",
  },
  selectWrap: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  selectOption: {
    backgroundColor: "#E2E8F0",
    padding: 10,
    borderRadius: 8,
    fontWeight: "600",
  },
});