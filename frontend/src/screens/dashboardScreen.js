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
} from "../services/dashboardService";

export default function DashboardScreen({ token }) {
  const [overview, setOverview] = useState(null);
  const [monthlyVAT, setMonthlyVAT] = useState([]);
  const [classification, setClassification] = useState(null);
  const [transactions, setTransactions] = useState([]);
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
      const [overviewData, monthlyData, classData, txData] = await Promise.all([
        fetchOverview(companyId, token),
        fetchMonthlyVAT(companyId, token),
        fetchClassificationBreakdown(companyId, token),
        fetchCompanyTransactions(companyId, token),
      ]);

      setOverview(overviewData);
      setMonthlyVAT(monthlyData);
      setClassification(classData);
      setTransactions(txData);
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
      <Text style={styles.header}>VAT Pro Dashboard</Text>
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
});