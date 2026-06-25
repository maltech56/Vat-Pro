import { API_BASE } from "../src/api/config";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useCompany } from "../context/CompanyContext";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { getSelectedCompany, getToken } from "../src/utils/session";

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return `$${amount.toFixed(2)}`;
};

const normalizeClassification = (value) => {
  if (!value) return "-";
  return value.replace(/_/g, " ");
};

export default function TransactionsPage() {
  const { selectedCompany, companyReady } = useCompany();
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    if (!companyReady) return;
    if (!selectedCompany?.id) return;

    setTransactions([]);
    setFilteredTransactions([]);
    setPageError("");
    setLoading(false);
  }, [companyReady, selectedCompany?.id]);

  const [summary, setSummary] = useState({
    totalSales: 0,
    totalExpenses: 0,
    outputVAT: 0,
    inputVAT: 0,
    netVATPayable: 0,
  });

  const [vatPeriodType, setVatPeriodType] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [editForm, setEditForm] = useState({
    type: "sale",
    amount: "",
    vatAmount: "",
    classification: "taxable",
    transactionDate: "",
    description: "",
  });

  const calculateVat = (amount, classification) => {
    const numericAmount = Number(amount || 0);
    if (classification === "taxable") {
      return (numericAmount * 0.1).toFixed(2);
    }
    return "0.00";
  };

  const recomputeSummary = (rows) => {
    const totalSales = rows
      .filter((item) => item.type === "sale")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalExpenses = rows
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const outputVAT = rows
      .filter(
        (item) =>
          item.type === "sale" && item.vat_classification === "taxable"
      )
      .reduce((sum, item) => sum + Number(item.vat_amount || 0), 0);

    const inputVAT = rows
      .filter(
        (item) =>
          item.type === "expense" && item.vat_classification === "taxable"
      )
      .reduce((sum, item) => sum + Number(item.vat_amount || 0), 0);

    setSummary({
      totalSales,
      totalExpenses,
      outputVAT,
      inputVAT,
      netVATPayable: outputVAT - inputVAT,
    });
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setPageError("");

      const token = getToken();
      const company = selectedCompany;

      if (!token) {
        throw new Error("No token found. Please log in again.");
      }

      if (!company?.id) {
        throw new Error("No company selected.");
      }

      const response = await fetch(
        `${API_BASE}/transactions/company/${company.id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const contentType = response.headers.get("content-type");
      console.log("Transactions status:", response.status);
      console.log("Transactions content-type:", contentType);

      if (!response.ok) {
        const rawText = await response.text();
        console.error("Transactions non-OK response:", rawText);
        throw new Error(`Failed to fetch transactions (${response.status})`);
      }

      if (!contentType || !contentType.includes("application/json")) {
        const rawText = await response.text();
        console.error("Expected JSON but received:", rawText);
        throw new Error("Server did not return JSON for transactions.");
      }

      const data = await response.json();

      const safeTransactions = Array.isArray(data)
        ? data
        : Array.isArray(data.transactions)
          ? data.transactions
          : [];

      setTransactions(safeTransactions);
      setFilteredTransactions(safeTransactions);
      recomputeSummary(safeTransactions);
    } catch (error) {
      console.error("Transactions page error:", error);
      setPageError(error.message || "Failed to load transactions.");
      setTransactions([]);
      setFilteredTransactions([]);
      setSummary({
        totalSales: 0,
        totalExpenses: 0,
        outputVAT: 0,
        inputVAT: 0,
        netVATPayable: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!companyReady) return;
    if (!selectedCompany?.id) return;

    fetchTransactions();
  }, [companyReady, selectedCompany?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!companyReady || !selectedCompany?.id) return;
      fetchTransactions();
    }, [companyReady, selectedCompany?.id])
  );

  useEffect(() => {
    let result = [...transactions];

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter((item) => {
        return (
          String(item.description || "").toLowerCase().includes(term) ||
          String(item.category || "").toLowerCase().includes(term) ||
          String(item.type || "").toLowerCase().includes(term)
        );
      });
    }

    if (typeFilter !== "all") {
      result = result.filter((item) => item.type === typeFilter);
    }

    if (classificationFilter !== "all") {
      result = result.filter(
        (item) => item.vat_classification === classificationFilter
      );
    }

    setFilteredTransactions(result);
  }, [transactions, search, typeFilter, classificationFilter]);

  const openEditModal = (transaction) => {
    setSelectedTransaction(transaction);
    setEditForm({
      type: transaction.type || "sale",
      amount: String(transaction.amount ?? ""),
      vatAmount: String(transaction.vat_amount ?? ""),
      classification: transaction.vat_classification || "taxable",
      transactionDate: transaction.transaction_date
        ? String(transaction.transaction_date).slice(0, 10)
        : "",
      description: transaction.description || "",
    });
    setEditModalVisible(true);
  };

  const handleEditAmountChange = (value) => {
    const nextVat = calculateVat(value, editForm.classification);
    setEditForm((prev) => ({
      ...prev,
      amount: value,
      vatAmount: nextVat,
    }));
  };

  const handleEditClassificationChange = (value) => {
    const nextVat = calculateVat(editForm.amount, value);
    setEditForm((prev) => ({
      ...prev,
      classification: value,
      vatAmount: nextVat,
    }));
  };

  const handleSaveEdit = async () => {
    try {
      if (!selectedTransaction?.id) {
        Alert.alert("Error", "No transaction selected.");
        return;
      }

      const token = getToken();
      if (!token) {
        Alert.alert("Error", "No token found. Please log in again.");
        return;
      }

      setSavingEdit(true);

      const response = await fetch(
        `${API_BASE}/transactions/${selectedTransaction.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: editForm.type,
            amountExVat: Number(editForm.amount || 0),
            classification: editForm.classification,
            transactionDate: editForm.transactionDate,
            description: editForm.description,
          }),
        }
      );

      const contentType = response.headers.get("content-type");

      if (!response.ok) {
        const rawText = await response.text();
        console.error("Update transaction failed:", rawText);
        throw new Error(`Failed to update transaction (${response.status})`);
      }

      if (!contentType || !contentType.includes("application/json")) {
        const rawText = await response.text();
        console.error("Update returned non-JSON:", rawText);
        throw new Error("Server did not return JSON for update.");
      }

      await response.json();

      setEditModalVisible(false);
      setSelectedTransaction(null);
      await fetchTransactions();
      Alert.alert("Success", "Transaction updated successfully.");
    } catch (error) {
      console.error("Update transaction error:", error);
      Alert.alert("Error", error.message || "Failed to update transaction.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (transactionId) => {
    Alert.alert(
      "Delete Transaction",
      "Are you sure you want to delete this transaction?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = getToken();

              if (!token) {
                Alert.alert("Error", "No token found. Please log in again.");
                return;
              }

              const response = await fetch(
                `${API_BASE}/transactions/${transactionId}`,
                {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              if (!response.ok) {
                const rawText = await response.text();
                console.error("Delete failed:", rawText);
                throw new Error(`Failed to delete transaction (${response.status})`);
              }

              await fetchTransactions();
              Alert.alert("Success", "Transaction deleted successfully.");
            } catch (error) {
              console.error("Delete transaction error:", error);
              Alert.alert("Error", error.message || "Failed to delete transaction.");
            }
          },
        },
      ]
    );
  };

  const getDateRange = () => {
    if (vatPeriodType === "monthly") {
      if (!selectedMonth || !selectedMonth.includes("-")) {
        return { start: "", end: "", filingPeriodLabel: "" };
      }

      const [year, month] = selectedMonth.split("-");
      const start = `${year}-${month}-01`;
      const end = new Date(Number(year), Number(month), 0)
        .toISOString()
        .slice(0, 10);

      return {
        start,
        end,
        filingPeriodLabel: selectedMonth,
      };
    }

    if (vatPeriodType === "quarterly") {
      const q = String(selectedQuarter || "").toUpperCase();
      const year = String(selectedYear || "");

      const ranges = {
        Q1: ["01-01", "03-31"],
        Q2: ["04-01", "06-30"],
        Q3: ["07-01", "09-30"],
        Q4: ["10-01", "12-31"],
      };

      if (!ranges[q] || !year) {
        return { start: "", end: "", filingPeriodLabel: "" };
      }

      const [startSuffix, endSuffix] = ranges[q];

      return {
        start: `${year}-${startSuffix}`,
        end: `${year}-${endSuffix}`,
        filingPeriodLabel: `${q} ${year}`,
      };
    }

    if (vatPeriodType === "custom") {
      if (!startDate || !endDate) {
        return { start: "", end: "", filingPeriodLabel: "" };
      }

      return {
        start: startDate,
        end: endDate,
        filingPeriodLabel: `${startDate} to ${endDate}`,
      };
    }

    return { start: "", end: "", filingPeriodLabel: "" };
  };

  const handleDownloadVatPdf = async () => {
    try {
      const token = getToken();
      const company = selectedCompany;

      if (!token) {
        Alert.alert("Missing token", "Please log in again.");
        return;
      }

      if (!company?.id) {
        Alert.alert("Missing company", "No company selected.");
        return;
      }

      const { start, end, filingPeriodLabel } = getDateRange();

      if (!start || !end) {
        Alert.alert(
          "Missing VAT period",
          "Please complete the VAT period before generating the PDF."
        );
        return;
      }

      const params = new URLSearchParams();
      params.append("startDate", start);
      params.append("endDate", end);
      params.append("filingPeriodLabel", filingPeriodLabel);
      params.append("tin", company?.tin || "");
      params.append("authorizedOfficer", "Authorized Officer");
      params.append("positionTitle", "Manager");

      const url = `${API_BASE}/transactions/company/${company.id}/vat-return-pdf?${params.toString()}`;

      console.log("PDF URL:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const rawText = await response.text();
        console.error("PDF generation failed:", rawText);
        throw new Error(`Failed to generate PDF (${response.status})`);
      }

      const contentType = response.headers.get("content-type");

      if (!contentType || !contentType.includes("application/pdf")) {
        const rawText = await response.text();
        console.error("Expected PDF but got:", rawText);
        throw new Error("Server did not return a PDF file.");
      }

      const blob = await response.blob();
      const fileURL = window.URL.createObjectURL(blob);
      window.open(fileURL, "_blank");
    } catch (error) {
      console.error("Error:", error);
      Alert.alert("PDF generation failed", error.message || "Unknown error.");
    }
  };

  const rows = useMemo(() => filteredTransactions || [], [filteredTransactions]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Transactions</Text>
      <Text style={styles.subTitle}>
        Maltech Digital Archive & Information Services
      </Text>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontWeight: "700", marginBottom: 8 }}>VAT Period</Text>

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          {["monthly", "quarterly", "custom"].map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setVatPeriodType(type)}
              style={{
                padding: 10,
                borderRadius: 8,
                backgroundColor: vatPeriodType === type ? "#1d4ed8" : "#e5e7eb",
              }}
            >
              <Text style={{ color: vatPeriodType === type ? "#fff" : "#000" }}>
                {type.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {vatPeriodType === "monthly" && (
          <TextInput
            placeholder="YYYY-MM"
            value={selectedMonth}
            onChangeText={setSelectedMonth}
            style={{
              borderWidth: 1,
              padding: 10,
              borderRadius: 8,
              marginBottom: 10,
            }}
          />
        )}

        {vatPeriodType === "quarterly" && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              placeholder="Year (2026)"
              value={String(selectedYear)}
              onChangeText={(val) => setSelectedYear(val)}
              style={{ borderWidth: 1, padding: 10, borderRadius: 8, width: 120 }}
            />
            <TextInput
              placeholder="Q1 / Q2 / Q3 / Q4"
              value={selectedQuarter}
              onChangeText={setSelectedQuarter}
              style={{ borderWidth: 1, padding: 10, borderRadius: 8, width: 120 }}
            />
          </View>
        )}

        {vatPeriodType === "custom" && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              placeholder="Start YYYY-MM-DD"
              value={startDate}
              onChangeText={setStartDate}
              style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
            />
            <TextInput
              placeholder="End YYYY-MM-DD"
              value={endDate}
              onChangeText={setEndDate}
              style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
            />
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.pdfButton} onPress={handleDownloadVatPdf}>
        <Text style={styles.pdfButtonText}>Generate VAT PDF</Text>
      </TouchableOpacity>

      {pageError ? <Text style={styles.errorText}>{pageError}</Text> : null}

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Sales</Text>
          <Text style={styles.statValue}>{formatCurrency(summary.totalSales)}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Expenses</Text>
          <Text style={styles.statValue}>{formatCurrency(summary.totalExpenses)}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Output VAT</Text>
          <Text style={styles.statValue}>{formatCurrency(summary.outputVAT)}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Input VAT</Text>
          <Text style={styles.statValue}>{formatCurrency(summary.inputVAT)}</Text>
        </View>

        <View style={[styles.statCard, styles.netVatCard]}>
          <Text style={styles.statLabel}>Net VAT Payable</Text>
          <Text style={[styles.statValue, styles.netVatValue]}>
            {formatCurrency(summary.netVATPayable)}
          </Text>
        </View>
      </View>

      <View style={styles.filterCard}>
        <Text style={styles.sectionTitle}>Filters</Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Search description, category, or type"
          value={search}
          onChangeText={setSearch}
        />

        <View style={styles.filterRow}>
          <View style={styles.filterCol}>
            <Text style={styles.filterLabel}>Type</Text>
            <View style={styles.selectRow}>
              <Pressable
                style={[
                  styles.selectOption,
                  typeFilter === "all" && styles.selectOptionActive,
                ]}
                onPress={() => setTypeFilter("all")}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    typeFilter === "all" && styles.selectOptionTextActive,
                  ]}
                >
                  All
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.selectOption,
                  typeFilter === "sale" && styles.selectOptionActive,
                ]}
                onPress={() => setTypeFilter("sale")}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    typeFilter === "sale" && styles.selectOptionTextActive,
                  ]}
                >
                  Sales
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.selectOption,
                  typeFilter === "expense" && styles.selectOptionActive,
                ]}
                onPress={() => setTypeFilter("expense")}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    typeFilter === "expense" && styles.selectOptionTextActive,
                  ]}
                >
                  Expenses
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.filterCol}>
            <Text style={styles.filterLabel}>VAT Classification</Text>
            <View style={styles.selectRow}>
              <Pressable
                style={[
                  styles.selectOption,
                  classificationFilter === "all" && styles.selectOptionActive,
                ]}
                onPress={() => setClassificationFilter("all")}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    classificationFilter === "all" &&
                    styles.selectOptionTextActive,
                  ]}
                >
                  All
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.selectOption,
                  classificationFilter === "taxable" &&
                  styles.selectOptionActive,
                ]}
                onPress={() => setClassificationFilter("taxable")}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    classificationFilter === "taxable" &&
                    styles.selectOptionTextActive,
                  ]}
                >
                  Taxable
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.selectOption,
                  classificationFilter === "zero_rated" &&
                  styles.selectOptionActive,
                ]}
                onPress={() => setClassificationFilter("zero_rated")}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    classificationFilter === "zero_rated" &&
                    styles.selectOptionTextActive,
                  ]}
                >
                  Zero Rated
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.selectOption,
                  classificationFilter === "exempt" &&
                  styles.selectOptionActive,
                ]}
                onPress={() => setClassificationFilter("exempt")}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    classificationFilter === "exempt" &&
                    styles.selectOptionTextActive,
                  ]}
                >
                  Exempt
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => {
            setSearch("");
            setTypeFilter("all");
            setClassificationFilter("all");
          }}
        >
          <Text style={styles.clearButtonText}>Clear Filters</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tableCard}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>

        {loading ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : rows.length === 0 ? (
          <Text style={styles.emptyText}>No transactions found.</Text>
        ) : (
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, styles.dateCol]}>Date</Text>
              <Text style={[styles.headerCell, styles.typeCol]}>Type</Text>
              <Text style={[styles.headerCell, styles.classCol]}>Class</Text>
              <Text style={[styles.headerCell, styles.descCol]}>Description</Text>
              <Text style={[styles.headerCell, styles.amountCol]}>Amount</Text>
              <Text style={[styles.headerCell, styles.vatCol]}>VAT</Text>
              <Text style={[styles.headerCell, styles.actionCol]}>Actions</Text>
            </View>

            {rows.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.bodyCell, styles.dateCol]}>
                  {item.transaction_date
                    ? String(item.transaction_date).slice(0, 10)
                    : "-"}
                </Text>

                <Text style={[styles.bodyCell, styles.typeCol]}>
                  {item.type || "-"}
                </Text>

                <Text style={[styles.bodyCell, styles.classCol]}>
                  {normalizeClassification(item.vat_classification)}
                </Text>

                <Text style={[styles.bodyCell, styles.descCol]}>
                  {item.description || "-"}
                </Text>

                <Text style={[styles.bodyCell, styles.amountCol]}>
                  {formatCurrency(item.amount)}
                </Text>

                <Text style={[styles.bodyCell, styles.vatCol]}>
                  {formatCurrency(item.vat_amount)}
                </Text>

                <View
                  style={[
                    styles.bodyCell,
                    styles.actionCol,
                    styles.actionWrap,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => openEditModal(item)}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Transaction</Text>

            <Text style={styles.inputLabel}>Type</Text>
            <View style={styles.selectRow}>
              <Pressable
                style={[
                  styles.selectOption,
                  editForm.type === "sale" && styles.selectOptionActive,
                ]}
                onPress={() =>
                  setEditForm((prev) => ({
                    ...prev,
                    type: "sale",
                  }))
                }
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    editForm.type === "sale" && styles.selectOptionTextActive,
                  ]}
                >
                  Sale
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.selectOption,
                  editForm.type === "expense" && styles.selectOptionActive,
                ]}
                onPress={() =>
                  setEditForm((prev) => ({
                    ...prev,
                    type: "expense",
                  }))
                }
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    editForm.type === "expense" &&
                    styles.selectOptionTextActive,
                  ]}
                >
                  Expense
                </Text>
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Amount</Text>
            <TextInput
              style={styles.input}
              value={editForm.amount}
              onChangeText={handleEditAmountChange}
              keyboardType="numeric"
              placeholder="Amount"
            />

            <Text style={styles.inputLabel}>VAT Classification</Text>
            <View style={styles.selectRow}>
              <Pressable
                style={[
                  styles.selectOption,
                  editForm.classification === "taxable" &&
                  styles.selectOptionActive,
                ]}
                onPress={() => handleEditClassificationChange("taxable")}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    editForm.classification === "taxable" &&
                    styles.selectOptionTextActive,
                  ]}
                >
                  Taxable
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.selectOption,
                  editForm.classification === "zero_rated" &&
                  styles.selectOptionActive,
                ]}
                onPress={() => handleEditClassificationChange("zero_rated")}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    editForm.classification === "zero_rated" &&
                    styles.selectOptionTextActive,
                  ]}
                >
                  Zero Rated
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.selectOption,
                  editForm.classification === "exempt" &&
                  styles.selectOptionActive,
                ]}
                onPress={() => handleEditClassificationChange("exempt")}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    editForm.classification === "exempt" &&
                    styles.selectOptionTextActive,
                  ]}
                >
                  Exempt
                </Text>
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>VAT Amount</Text>
            <TextInput
              style={styles.input}
              value={editForm.vatAmount}
              onChangeText={(value) =>
                setEditForm((prev) => ({ ...prev, vatAmount: value }))
              }
              keyboardType="numeric"
              placeholder="VAT Amount"
            />

            <Text style={styles.inputLabel}>Transaction Date</Text>
            <TextInput
              style={styles.input}
              value={editForm.transactionDate}
              onChangeText={(value) =>
                setEditForm((prev) => ({ ...prev, transactionDate: value }))
              }
              placeholder="YYYY-MM-DD"
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editForm.description}
              onChangeText={(value) =>
                setEditForm((prev) => ({ ...prev, description: value }))
              }
              placeholder="Description"
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveEdit}
                disabled={savingEdit}
              >
                <Text style={styles.modalSaveText}>
                  {savingEdit ? "Saving..." : "Save Changes"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  content: {
    padding: 24,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
  },
  subTitle: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 18,
  },
  pdfButton: {
    backgroundColor: "#1d4ed8",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  pdfButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  errorText: {
    color: "#dc2626",
    marginBottom: 14,
    fontSize: 14,
  },
  statsGrid: {
    gap: 16,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statLabel: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  netVatCard: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  netVatValue: {
    color: "#15803d",
  },
  filterCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 20,
  },
  tableCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    marginBottom: 16,
  },
  filterRow: {
    gap: 16,
  },
  filterCol: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  selectRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  selectOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  selectOptionActive: {
    backgroundColor: "#dbeafe",
    borderColor: "#60a5fa",
  },
  selectOptionText: {
    color: "#334155",
    fontWeight: "600",
  },
  selectOptionTextActive: {
    color: "#1d4ed8",
  },
  clearButton: {
    marginTop: 8,
    backgroundColor: "#0f172a",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  clearButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  headerCell: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  bodyCell: {
    color: "#111827",
    fontSize: 12,
  },
  dateCol: {
    width: 90,
  },
  typeCol: {
    width: 70,
    textTransform: "capitalize",
  },
  classCol: {
    width: 95,
  },
  descCol: {
    flex: 1,
    paddingRight: 10,
  },
  amountCol: {
    width: 90,
    textAlign: "right",
  },
  vatCol: {
    width: 80,
    textAlign: "right",
  },
  actionCol: {
    width: 150,
  },
  actionWrap: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  editButton: {
    backgroundColor: "#1d4ed8",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  editButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  deleteButton: {
    backgroundColor: "#dc2626",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  emptyText: {
    color: "#64748b",
    marginTop: 8,
  },
  loader: {
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 650,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 20,
  },
  modalCancelButton: {
    backgroundColor: "#e5e7eb",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalCancelText: {
    color: "#111827",
    fontWeight: "600",
  },
  modalSaveButton: {
    backgroundColor: "#1f53a6",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalSaveText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});