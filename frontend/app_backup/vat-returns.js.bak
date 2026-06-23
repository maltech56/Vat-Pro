import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { getToken, getSelectedCompany } from "../src/utils/session";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.maltechenterprises.com/api";

export default function VatReturns() {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [summary, setSummary] = useState({
    taxableSales: 0,
    zeroRatedSales: 0,
    exemptSales: 0,
    outputVAT: 0,
    inputVAT: 0,
    netVAT: 0,
  });

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);

      const token = getToken();
      const selected = getSelectedCompany();
      setCompany(selected);

      if (!token) {
        Alert.alert("No token found. Please log in again.");
        return;
      }

      if (!selected || !selected.id) {
        Alert.alert("No company selected.");
        return;
      }

      const query = `?startDate=${fromDate || ""}&endDate=${toDate || ""}`;

      const response = await fetch(
        `${API_BASE}/transactions/company/${selected.id}/vat-summary${query}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = response;

      if (!response.ok) {
        throw new Error(data.message || "Failed to load VAT summary");
      }

      setSummary({
        taxableSales: data.taxable_sales || 0,
        zeroRatedSales: data.zero_rated_sales || 0,
        exemptSales: data.exempt_sales || 0,
        outputVAT: data.output_vat || 0,
        inputVAT: data.input_vat || 0,
        netVAT:
          (data.output_vat || 0) - (data.input_vat || 0),
      });
    } catch (error) {
      console.error(error);
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) =>
    Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>VAT Returns</Text>

      <Text style={styles.company}>
        {company?.name || "No company selected"}
      </Text>

      {/* Filters */}
      <View style={styles.filterRow}>
        <TextInput
          style={styles.input}
          placeholder="From Date (YYYY-MM-DD)"
          value={fromDate}
          onChangeText={setFromDate}
        />

        <TextInput
          style={styles.input}
          placeholder="To Date (YYYY-MM-DD)"
          value={toDate}
          onChangeText={setToDate}
        />

        <TouchableOpacity style={styles.button} onPress={loadSummary}>
          <Text style={styles.buttonText}>Load</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Summary Cards */}
          <View style={styles.card}>
            <Text style={styles.label}>Taxable Sales</Text>
            <Text style={styles.value}>
              {formatCurrency(summary.taxableSales)}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Zero Rated Sales</Text>
            <Text style={styles.value}>
              {formatCurrency(summary.zeroRatedSales)}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Exempt Sales</Text>
            <Text style={styles.value}>
              {formatCurrency(summary.exemptSales)}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Output VAT</Text>
            <Text style={styles.value}>
              {formatCurrency(summary.outputVAT)}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Input VAT</Text>
            <Text style={styles.value}>
              {formatCurrency(summary.inputVAT)}
            </Text>
          </View>

          <View style={[styles.card, styles.highlight]}>
            <Text style={styles.label}>Net VAT Payable</Text>
            <Text style={styles.value}>
              {formatCurrency(summary.netVAT)}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F5F7FB",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 6,
  },
  company: {
    fontSize: 14,
    marginBottom: 16,
    color: "#6B7280",
  },
  filterRow: {
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  highlight: {
    backgroundColor: "#DCFCE7",
  },
  label: {
    fontSize: 14,
    color: "#6B7280",
  },
  value: {
    fontSize: 20,
    fontWeight: "700",
  },
});