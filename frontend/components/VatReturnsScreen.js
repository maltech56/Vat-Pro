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
import { formatCurrency } from "../src/utils/formatters";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.maltechdigital.com/api";

export default function VatReturnsScreen() {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [summary, setSummary] = useState({
    taxableSales: 0,
    zeroRatedSales: 0,
    exemptSales: 0,
    outputVAT: 0,
    inputVAT: 0,
    netVATPayable: 0,
  });

  useEffect(() => {
    const selected = getSelectedCompany();
    setCompany(selected || null);
  }, []);

  const loadVatSummary = async () => {
    try {
      setLoading(true);

      const token = getToken();
      const selected = getSelectedCompany();

      setCompany(selected || null);

      if (!token) {
        Alert.alert("Error", "No token found. Please log in again.");
        return;
      }

      if (!selected || !selected.id) {
        Alert.alert("Error", "No company selected.");
        return;
      }

      if (!startDate || !endDate) {
        Alert.alert("Error", "Start date and end date are required.");
        return;
      }

      const response = await fetch(
        `${API_BASE}/transactions/company/${selected.id}/vat-summary?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = response;

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to load VAT summary");
      }

      setSummary({
        taxableSales: Number(data.taxableSales || 0),
        zeroRatedSales: Number(data.zeroRatedSales || 0),
        exemptSales: Number(data.exemptSales || 0),
        outputVAT: Number(data.outputVAT || 0),
        inputVAT: Number(data.inputVAT || 0),
        netVATPayable: Number(data.netVATPayable || 0),
      });
    } catch (error) {
      console.error("VAT summary load error:", error);
      Alert.alert("Error", error.message || "Failed to load VAT summary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>vat returns</Text>
      </View>

      <ScrollView
        style={styles.contentArea}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>VAT Returns</Text>
          <Text style={styles.headerSubtitle}>
            Review VAT totals for the selected filing period.
          </Text>

          <Text style={styles.companyLabel}>Selected Company</Text>
          <Text style={styles.companyValue}>
            {company?.name || company?.company_name || "No company selected"}
          </Text>
        </View>

        <View style={styles.filterCard}>
          <Text style={styles.sectionTitle}>Filing Period</Text>

          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.label}>Start Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>

            <View style={styles.filterField}>
              <Text style={styles.label}>End Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.primaryButton} onPress={loadVatSummary}>
                <Text style={styles.primaryButtonText}>
                  {loading ? "Loading..." : "Load VAT Return"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <>
            <View style={styles.cardsRow}>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Taxable Sales</Text>
                <Text style={styles.cardValue}>
                  {formatCurrency(summary.taxableSales)}
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>Zero Rated Sales</Text>
                <Text style={styles.cardValue}>
                  {formatCurrency(summary.zeroRatedSales)}
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>Exempt Sales</Text>
                <Text style={styles.cardValue}>
                  {formatCurrency(summary.exemptSales)}
                </Text>
              </View>
            </View>

            <View style={styles.cardsRow}>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Output VAT</Text>
                <Text style={styles.cardValue}>
                  {formatCurrency(summary.outputVAT)}
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>Input VAT</Text>
                <Text style={styles.cardValue}>
                  {formatCurrency(summary.inputVAT)}
                </Text>
              </View>

              <View style={[styles.card, styles.netVatCard]}>
                <Text style={styles.netVatLabel}>Net VAT Payable</Text>
                <Text style={styles.netVatValue}>
                  {formatCurrency(summary.netVATPayable)}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 82,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#dfe5ee",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    textTransform: "lowercase",
  },
  contentArea: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },
  contentContainer: {
    padding: 28,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#dfe5ee",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#13294b",
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#4b5b73",
    marginBottom: 18,
  },
  companyLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  companyValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  filterCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#dfe5ee",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    color: "#13294b",
  },
  filterRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  filterField: {
    minWidth: 220,
    flexGrow: 1,
  },
  label: {
    fontSize: 13,
    color: "#4B5563",
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    fontSize: 14,
  },
  filterActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryButton: {
    backgroundColor: "#111827",
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  loadingWrap: {
    paddingVertical: 40,
  },
  cardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 16,
  },
  card: {
    flexBasis: "31.8%",
    minWidth: 220,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfe5ee",
    borderRadius: 22,
    padding: 22,
    minHeight: 138,
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#13294b",
    marginBottom: 18,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#13294b",
  },
  netVatCard: {
    backgroundColor: "#f4a03d",
    borderColor: "#f4a03d",
  },
  netVatLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 18,
  },
  netVatValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
  },
});