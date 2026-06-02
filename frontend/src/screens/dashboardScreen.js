import React, { useEffect, useState } from "react";
import { useCompany } from "../context/CompanyContext";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from "react-native";
import {
  fetchOverview,
  fetchMonthlyVAT,
  fetchClassificationBreakdown,
  fetchCompanyTransactions,
  fetchVatSummary,
} from "../services/dashboardService";

export default function DashboardScreen({ token }) {
  const [overview, setOverview] = useState(null);
  const [monthlyVAT, setMonthlyVAT] = useState([]);
  const [classification, setClassification] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [vatSummary, setVatSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyReady) return;

    setOverview(null);
    setMonthlyVAT([]);
    setClassification(null);
    setTransactions([]);

    if (!selectedCompany?.id) {
      setLoading(false);
      return;
    }

    loadDashboard(selectedCompany.id);
  }, [companyReady, selectedCompany?.id]);

  const { selectedCompany, companyReady } = useCompany();

  const loadDashboard = async (companyId) => {
    try {
      const [
        overviewData,
        monthlyData,
        classData,
        txData,
        vatData,
      ] = await Promise.all([
        fetchOverview(companyId, token),
        fetchMonthlyVAT(companyId, token),
        fetchClassificationBreakdown(companyId, token),
        fetchCompanyTransactions(companyId, token),
        fetchVatSummary(companyId, token),
      ]);

      setOverview(overviewData);
      setMonthlyVAT(monthlyData);
      setClassification(classData);
      setTransactions(txData);
      setVatSummary(vatData);
    } catch (error) {
      console.error("Dashboard error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>

        <Text style={styles.header}>
          VAT Pro Dashboard
        </Text>

        {vatSummary && (
          <View style={styles.card}>

            <Text style={styles.cardTitle}>
              VAT Summary
            </Text>

            <Text>
              Sales Transactions:
              {" "}
              {vatSummary.salesTransactions}
            </Text>

            <Text>
              Purchase Transactions:
              {" "}
              {vatSummary.purchaseTransactions}
            </Text>

            <Text>
              Total Sales:
              $
              {Number(
                vatSummary.totalSales
              ).toFixed(2)}
            </Text>

            <Text>
              Total Purchases:
              $
              {Number(
                vatSummary.totalPurchases
              ).toFixed(2)}
            </Text>

            <Text>
              Output VAT:
              $
              {Number(
                vatSummary.outputVat
              ).toFixed(2)}
            </Text>

            <Text>
              Input VAT:
              $
              {Number(
                vatSummary.inputVat
              ).toFixed(2)}
            </Text>

            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                marginTop: 12,
              }}
            >
              VAT Payable:
              $
              {Number(
                vatSummary.vatPayable
              ).toFixed(2)}
            </Text>

          </View>
        )}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },

  content: {
    padding: 24,
    paddingBottom: 80,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
});