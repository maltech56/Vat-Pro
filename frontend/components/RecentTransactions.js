import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";

import { getToken, getSelectedCompany } from "../src/utils/session";
import {
  formatCurrency,
  formatDate,
  formatTypeLabel,
  formatClassificationLabel,
} from "../src/utils/formatters";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.maltechenterprises.com/api";

export default function RecentTransactions({
  refreshKey,
  startDate,
  endDate,
}) {
  
  const [transactions, setTransactions] = useState([]);
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRecentTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();
      const company = getSelectedCompany();

      if (!token) {
        setError("No token found.");
        setLoading(false);
        return;
      }

      if (!company?.id) {
        setError("No company selected.");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const url = `${API_BASE}/transactions/company/${company.id}/recent?${params.toString()}`;

      console.log("Recent TX URL:", url);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch recent transactions");
      }

      setTransactions(data);
    } catch (err) {
      console.error("Recent transactions error:", err);
      setError(err.message || "Failed to load recent transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentTransactions();
  }, [refreshKey, startDate, endDate]);

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Recent Transactions</Text>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Recent Transactions</Text>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Recent Transactions</Text>

      {safeTransactions.length === 0 ? (
        <Text style={styles.empty}>No transactions yet.</Text>
      ) : (
        <ScrollView horizontal={Platform.OS === "web"}>
          <View style={styles.table}>
            <View style={[styles.row, styles.headerRow]}>
              <Text style={[styles.cell, styles.headerCell, styles.dateCol]}>
                Date
              </Text>
              <Text style={[styles.cell, styles.headerCell, styles.typeCol]}>
                Type
              </Text>
              <Text style={[styles.cell, styles.headerCell, styles.classCol]}>
                VAT Class
              </Text>
              <Text style={[styles.cell, styles.headerCell, styles.descCol]}>
                Description
              </Text>
              <Text style={[styles.cell, styles.headerCell, styles.amountCol]}>
                Amount
              </Text>
              <Text style={[styles.cell, styles.headerCell, styles.vatCol]}>
                VAT
              </Text>
            </View>

              {safeTransactions.map((item) => (
              <View key={item.id} style={styles.row}>
                <Text style={[styles.cell, styles.dateCol]}>
                  {formatDate(item.transaction_date)}
                </Text>

                <Text style={[styles.cell, styles.typeCol]}>
                  {formatTypeLabel(item.type)}
                </Text>

                <Text style={[styles.cell, styles.classCol]}>
                  {formatClassificationLabel(item.vat_classification)}
                </Text>

                <Text
                  style={[styles.cell, styles.descCol]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.description || "-"}
                </Text>

                <Text style={[styles.cell, styles.amountCol, styles.money]}>
                  {formatCurrency(item.amount)}
                </Text>

                <Text style={[styles.cell, styles.vatCol, styles.money]}>
                  {formatCurrency(item.vat_amount)}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 14,
    color: "#111827",
  },
  table: {
    minWidth: 920,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 10,
  },
  headerRow: {
    backgroundColor: "#f8fafc",
    borderBottomColor: "#e5e7eb",
  },
  cell: {
    fontSize: 14,
    color: "#111827",
    paddingRight: 12,
  },
  headerCell: {
    fontWeight: "700",
    color: "#374151",
  },
  dateCol: {
    width: 110,
  },
  typeCol: {
    width: 90,
  },
  classCol: {
    width: 140,
  },
  descCol: {
    width: 260,
  },
  amountCol: {
    width: 140,
    textAlign: "right",
  },
  vatCol: {
    width: 120,
    textAlign: "right",
  },
  money: {
    fontVariant: ["tabular-nums"],
  },
  empty: {
    color: "#6b7280",
    fontSize: 14,
  },
  error: {
    color: "#dc2626",
    fontSize: 14,
  },
});