import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";

import { getToken } from "../src/utils/session";
import { useCompany } from "../context/CompanyContext";

const API_BASE = "https://vat-pro-backend.onrender.com/api";

export default function AuditDashboardScreen() {
  const { selectedCompany, companyReady } = useCompany();

  const [loading, setLoading] = useState(true);
  const [auditData, setAuditData] = useState(null);

  const fetchAuditDashboard = async () => {
    try {
      if (!selectedCompany?.id) {
        setAuditData(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const token = getToken();

      if (!token) {
        Alert.alert("Session Error", "No token found. Please log in again.");
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${API_BASE}/audit/company/${selectedCompany.id}/dashboard`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = response;

      if (!response.ok) {
        throw new Error(data.error || "Failed to load audit dashboard");
      }

      setAuditData(data);
    } catch (error) {
      console.error("Audit dashboard error:", error);
      Alert.alert(
        "Audit Dashboard Error",
        error.message || "Unable to load audit dashboard"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!companyReady) return;

    setAuditData(null);

    if (!selectedCompany?.id) {
      setLoading(false);
      return;
    }

    fetchAuditDashboard();
  }, [companyReady, selectedCompany?.id]);

  const getRiskLabel = () => {
    if (!auditData) return "Unknown";

    if (auditData.auditScore >= 85) return "Low Risk";
    if (auditData.auditScore >= 70) return "Needs Review";
    return "High Risk";
  };

  const getScoreMessage = () => {
    if (!auditData) return "";

    if (auditData.auditScore >= 85) {
      return "Strong audit readiness. Records are well supported.";
    }

    if (auditData.auditScore >= 70) {
      return "Some records need review before filing or audit submission.";
    }

    return "High-risk status. Missing document support should be resolved before submission.";
  };

  if (!companyReady || loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading audit dashboard...</Text>
      </View>
    );
  }

  if (!selectedCompany?.id) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Audit Dashboard</Text>
        <Text style={styles.emptyText}>No company selected.</Text>
      </View>
    );
  }

  if (!auditData) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Audit Dashboard</Text>
        <Text style={styles.emptyText}>No audit data available.</Text>

        <TouchableOpacity style={styles.refreshButton} onPress={fetchAuditDashboard}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stats = auditData.stats || {};
  const filings = auditData.filings || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Audit Dashboard</Text>
          <Text style={styles.subtitle}>
            Company-wide document support and VAT filing readiness
          </Text>
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={fetchAuditDashboard}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Audit Readiness Score</Text>
        <Text style={styles.scoreValue}>{auditData.auditScore}%</Text>
        <Text style={styles.riskText}>{getRiskLabel()}</Text>
        <Text style={styles.scoreMessage}>{getScoreMessage()}</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Transactions</Text>
          <Text style={styles.kpiValue}>{stats.totalTransactions || 0}</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Linked Transactions</Text>
          <Text style={styles.kpiValue}>{stats.linkedTransactions || 0}</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Missing Documents</Text>
          <Text style={styles.kpiValue}>{stats.missingDocuments || 0}</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Unlinked Documents</Text>
          <Text style={styles.kpiValue}>{stats.unlinkedDocuments || 0}</Text>
        </View>
      </View>

      <View style={styles.alertCard}>
        <Text style={styles.sectionTitle}>Action Alerts</Text>

        {(stats.missingDocuments || 0) > 0 ? (
          <Text style={styles.alertText}>
            {"• "}{stats.missingDocuments} transaction(s) are missing supporting documents.
          </Text>
        ) : (
          <Text style={styles.goodText}>
            {"• "}All transactions currently have document support.
          </Text>
        )}

        {(stats.unlinkedDocuments || 0) > 0 ? (
          <Text style={styles.alertText}>
            {"• "}{stats.unlinkedDocuments} uploaded document(s) are not linked to transactions.
          </Text>
        ) : (
          <Text style={styles.goodText}>
           {"• "} No unlinked uploaded documents detected.
          </Text>
        )}

        {auditData.auditScore < 70 ? (
          <Text style={styles.dangerText}>
           {"• "} Filing submission may be blocked until audit readiness improves.
          </Text>
        ) : null}
      </View>

      <View style={styles.tableCard}>
        <Text style={styles.sectionTitle}>Recent Filing Readiness</Text>

        {filings.length === 0 ? (
          <Text style={styles.emptyText}>No recent filings found.</Text>
        ) : (
          filings.map((filing) => (
            <View key={filing.id} style={styles.filingRow}>
              <View>
                <Text style={styles.filingTitle}>Filing #{filing.id}</Text>
                <Text style={styles.filingPeriod}>
                  {formatDate(filing.start_date)} - {formatDate(filing.end_date)}
                </Text>
              </View>

              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  {filing.status || "draft"}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
    padding: 20,
  },
  content: {
    paddingBottom: 30,
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
  },
  header: {
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
  },
  refreshButton: {
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  refreshButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  scoreCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 18,
  },
  scoreLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: "900",
    color: "#111827",
    marginTop: 8,
  },
  riskText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginTop: 4,
  },
  scoreMessage: {
    marginTop: 10,
    fontSize: 14,
    color: "#4B5563",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 18,
  },
  kpiCard: {
    flexGrow: 1,
    minWidth: 220,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  kpiLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "700",
  },
  kpiValue: {
    fontSize: 30,
    fontWeight: "900",
    color: "#111827",
    marginTop: 6,
  },
  alertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },
  alertText: {
    fontSize: 14,
    color: "#92400E",
    marginBottom: 8,
  },
  dangerText: {
    fontSize: 14,
    color: "#991B1B",
    fontWeight: "700",
    marginBottom: 8,
  },
  goodText: {
    fontSize: 14,
    color: "#065F46",
    marginBottom: 8,
  },
  tableCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filingRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filingTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  filingPeriod: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 3,
  },
  statusBadge: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    textTransform: "capitalize",
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
  },
});