import { API_BASE } from "../src/api/config";
import React, { useEffect, useMemo, useState } from "react";
import AddTransaction from "./add-transaction";
import { calculateVAT } from "../src/utils/vat";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { getToken, getSelectedCompany } from "../src/utils/session";

export default function Purchases() {
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);

  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  const [editVisible, setEditVisible] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    type: "expense",
    amount: "",
    vatAmount: "",
    classification: "taxable",
    transactionDate: "",
    description: "",
  });

  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadPurchases();
  }, []);

  const getClassification = (item) =>
    item?.vat_classification || item?.classification || "taxable";

  const getVatAmount = (item) => item?.vat_amount ?? item?.vatAmount ?? 0;

  const getDateString = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  };

  const loadPurchases = async () => {
    try {
      setLoading(true);

      const token = getToken();
      const company = getSelectedCompany();

      setSelectedCompany(company);

      if (!token) {
        Alert.alert("No token found. Please log in again.");
        return;
      }

      if (!company || !company.id) {
        Alert.alert("No company selected.");
        return;
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to load purchases");
      }

      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data.transactions)
          ? data.transactions
          : [];

      setPurchases(rows);
    } catch (error) {
      console.error("Load purchases error:", error);
      Alert.alert("Error", error.message || "Failed to load purchases");
    } finally {
      setLoading(false);
    }
  };

  const filteredPurchases = useMemo(() => {
    return purchases.filter((item) => {
      const type = String(item.type || "").toLowerCase();
      const isPurchaseLike = type === "expense" || type === "purchase";

      if (!isPurchaseLike) return false;

      const description = String(item.description || "").toLowerCase();
      const classification = String(getClassification(item)).toLowerCase();
      const search = searchTerm.trim().toLowerCase();

      const transactionDate = item.transaction_date
        ? new Date(item.transaction_date)
        : null;

      const matchesSearch =
        !search ||
        description.includes(search) ||
        classification.includes(search) ||
        String(item.id || "").includes(search);

      const matchesFromDate =
        !fromDate ||
        (transactionDate &&
          transactionDate >= new Date(`${fromDate}T00:00:00`));

      const matchesToDate =
        !toDate ||
        (transactionDate &&
          transactionDate <= new Date(`${toDate}T23:59:59`));

      return matchesSearch && matchesFromDate && matchesToDate;
    });
  }, [purchases, searchTerm, fromDate, toDate]);

  const summary = useMemo(() => {
    const totalPurchases = filteredPurchases.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const totalInputVAT = filteredPurchases.reduce(
      (sum, item) => sum + Number(getVatAmount(item) || 0),
      0
    );

    return {
      totalPurchases,
      totalInputVAT,
      count: filteredPurchases.length,
    };
  }, [filteredPurchases]);

  const formatCurrency = (value) =>
    Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatDate = (value) =>
    value ? new Date(value).toLocaleDateString() : "-";

  const getClassificationStyle = (classification) => {
    const value = String(classification || "taxable").toLowerCase();

    if (value === "zero_rated") {
      return [styles.badge, styles.badgeBlue];
    }

    if (value === "exempt") {
      return [styles.badge, styles.badgeGray];
    }

    return [styles.badge, styles.badgeGreen];
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setFromDate("");
    setToDate("");
  };

  const handleViewPurchase = (purchase) => {
    setSelectedPurchase(purchase);
    setDetailsVisible(true);
  };

  const openEditModal = (purchase) => {
    setEditForm({
      id: purchase.id,
      type: "expense",
      amount: String(purchase.amount ?? ""),
      vatAmount: String(getVatAmount(purchase) ?? ""),
      classification: getClassification(purchase),
      transactionDate: getDateString(purchase.transaction_date),
      description: purchase.description || "",
    });

    setSelectedPurchase(purchase);
    setEditVisible(true);
  };

  const updateEditField = (field, value) => {
    setEditForm((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === "amount" || field === "classification") {
        updated.vatAmount = String(
          calculateVAT(updated.amount, updated.classification)
        );
      }

      return updated;
    });
  };

  const handleSaveEdit = async () => {
    try {
      if (!editForm.id) {
        Alert.alert("Error", "No purchase selected for editing.");
        return;
      }

      const token = getToken();

      if (!token) {
        Alert.alert("No token found. Please log in again.");
        return;
      }

      setSavingEdit(true);

      const payload = {
        type: "expense",
        amount: parseFloat(editForm.amount) || 0,
        vatAmount: parseFloat(editForm.vatAmount) || 0,
        classification: editForm.classification,
        transactionDate:
          editForm.transactionDate || new Date().toISOString().slice(0, 10),
        description: editForm.description,
      };

      const response = await fetch(
        `${API_BASE}/transactions/${editForm.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to update purchase");
      }

      Alert.alert("Success", "Purchase updated successfully.");
      setEditVisible(false);

      if (selectedPurchase?.id === editForm.id) {
        setSelectedPurchase(data);
      }

      await loadPurchases();
    } catch (error) {
      console.error("Update purchase error:", error);
      Alert.alert("Error", error.message || "Failed to update purchase");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePurchase = (purchase) => {
    Alert.alert(
      "Delete Purchase",
      `Are you sure you want to delete purchase #${purchase.id}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = getToken();

              if (!token) {
                Alert.alert("No token found. Please log in again.");
                return;
              }

              setDeletingId(purchase.id);

              const response = await fetch(
                `${API_BASE}/transactions/${purchase.id}`,
                {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              const data = await response.json();

              if (!response.ok) {
                throw new Error(
                  data.error || data.message || "Failed to delete purchase"
                );
              }

              Alert.alert("Success", "Purchase deleted successfully.");

              if (selectedPurchase?.id === purchase.id) {
                setSelectedPurchase(null);
                setDetailsVisible(false);
              }

              if (editForm?.id === purchase.id) {
                setEditVisible(false);
              }

              await loadPurchases();
            } catch (error) {
              console.error("Delete purchase error:", error);
              Alert.alert("Error", error.message || "Failed to delete purchase");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const AddTransactionWrapper = ({ onClose, onSaved }) => {
    return (
      <View style={{ flex: 1 }}>
        <AddTransaction defaultType="expense" onSaved={onSaved} />

        <TouchableOpacity
          style={{ marginTop: 10, alignSelf: "center" }}
          onPress={onClose}
        >
          <Text style={{ color: "#2563EB", fontWeight: "600" }}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Purchases</Text>
          <Text style={styles.subtitle}>
            Track expenses, input VAT, and purchase-side records
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.primaryButtonText}>Add Purchase</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.companyCard}>
        <Text style={styles.companyLabel}>Selected Company</Text>
        <Text style={styles.companyValue}>
          {selectedCompany?.name || "No company selected"}
        </Text>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Purchases</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency(summary.totalPurchases)}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Input VAT</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency(summary.totalInputVAT)}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Purchase Count</Text>
          <Text style={styles.summaryValue}>{summary.count}</Text>
        </View>
      </View>

      <View style={styles.filterCard}>
        <View style={styles.filterHeader}>
          <Text style={styles.sectionTitle}>Filters</Text>
        </View>

        <View style={styles.filterRow}>
          <View style={styles.filterField}>
            <Text style={styles.label}>Search</Text>
            <TextInput
              style={styles.input}
              placeholder="Search description, classification, or ID"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>

          <View style={styles.filterField}>
            <Text style={styles.label}>From Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={fromDate}
              onChangeText={setFromDate}
            />
          </View>

          <View style={styles.filterField}>
            <Text style={styles.label}>To Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={toDate}
              onChangeText={setToDate}
            />
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleClearFilters}
            >
              <Text style={styles.secondaryButtonText}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.outlineButton}
              onPress={loadPurchases}
            >
              <Text style={styles.outlineButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.tableCard}>
        <View style={styles.tableTop}>
          <Text style={styles.sectionTitle}>Purchase Records</Text>
          <Text style={styles.countText}>
            {loading
              ? "Loading..."
              : `${filteredPurchases.length} purchase${filteredPurchases.length === 1 ? "" : "s"
              }`}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" />
          </View>
        ) : filteredPurchases.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No purchases found</Text>
            <Text style={styles.emptyText}>
              Try changing the filters or add your first purchase record.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, styles.colId]}>ID</Text>
                <Text style={[styles.headerCell, styles.colDate]}>Date</Text>
                <Text style={[styles.headerCell, styles.colDesc]}>
                  Description
                </Text>
                <Text style={[styles.headerCell, styles.colClass]}>
                  Classification
                </Text>
                <Text style={[styles.headerCell, styles.colAmountRight]}>
                  Amount
                </Text>
                <Text style={[styles.headerCell, styles.colAmountRight]}>
                  Input VAT
                </Text>
                <Text style={[styles.headerCell, styles.colActions]}>
                  Actions
                </Text>
              </View>

              {filteredPurchases.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.tableRow,
                    index % 2 === 0 ? styles.rowEven : styles.rowOdd,
                  ]}
                >
                  <Text style={[styles.bodyCell, styles.colId]}>
                    {item.id || "-"}
                  </Text>

                  <Text style={[styles.bodyCell, styles.colDate]}>
                    {formatDate(item.transaction_date)}
                  </Text>

                  <Text style={[styles.bodyCell, styles.colDesc]}>
                    {item.description || "-"}
                  </Text>

                  <View style={styles.colClass}>
                    <View style={getClassificationStyle(getClassification(item))}>
                      <Text style={styles.badgeText}>
                        {getClassification(item)}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.bodyCell,
                      styles.colAmountRight,
                      styles.alignRight,
                    ]}
                  >
                    {formatCurrency(item.amount)}
                  </Text>

                  <Text
                    style={[
                      styles.bodyCell,
                      styles.colAmountRight,
                      styles.alignRight,
                    ]}
                  >
                    {formatCurrency(getVatAmount(item))}
                  </Text>

                  <View style={styles.colActions}>
                    <TouchableOpacity
                      style={styles.actionBlue}
                      onPress={() => handleViewPurchase(item)}
                    >
                      <Text style={styles.actionText}>View</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionGray}
                      onPress={() => openEditModal(item)}
                    >
                      <Text style={styles.actionText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionRed}
                      onPress={() => handleDeletePurchase(item)}
                      disabled={deletingId === item.id}
                    >
                      <Text style={styles.actionText}>
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <AddTransactionWrapper
              onClose={() => setShowAddModal(false)}
              onSaved={() => {
                setShowAddModal(false);
                loadPurchases();
              }}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={detailsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Purchase #{selectedPurchase?.id || "-"}
                </Text>
                <Text style={styles.modalSubtitle}>Purchase details</Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setDetailsVisible(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            {selectedPurchase ? (
              <>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Company</Text>
                    <Text style={styles.detailValue}>
                      {selectedCompany?.name || "No company selected"}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Purchase ID</Text>
                    <Text style={styles.detailValue}>
                      {selectedPurchase.id || "-"}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Transaction Date</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedPurchase.transaction_date)}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Type</Text>
                    <Text style={styles.detailValue}>
                      {selectedPurchase.type || "expense"}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailValue}>
                      {selectedPurchase.description || "-"}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Classification</Text>
                    <Text style={styles.detailValue}>
                      {getClassification(selectedPurchase)}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Amount</Text>
                    <Text style={styles.detailValue}>
                      {formatCurrency(selectedPurchase.amount)}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Input VAT</Text>
                    <Text style={styles.detailValueStrong}>
                      {formatCurrency(getVatAmount(selectedPurchase))}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.actionGray}
                    onPress={() => {
                      setDetailsVisible(false);
                      openEditModal(selectedPurchase);
                    }}
                  >
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionRed}
                    onPress={() => handleDeletePurchase(selectedPurchase)}
                  >
                    <Text style={styles.actionText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={styles.emptyText}>No purchase selected.</Text>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={editVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Edit Purchase #{editForm.id || "-"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Update purchase details
                </Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setEditVisible(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.labelDark}>Amount</Text>
            <TextInput
              style={styles.inputLight}
              placeholder="Amount"
              value={editForm.amount}
              keyboardType="numeric"
              onChangeText={(text) => updateEditField("amount", text)}
            />

            <Text style={styles.labelDark}>Input VAT</Text>
            <TextInput
              style={styles.inputLight}
              placeholder="VAT Amount"
              value={editForm.vatAmount}
              editable={false}
            />

            <Text style={styles.labelDark}>Description</Text>
            <TextInput
              style={styles.inputLight}
              placeholder="Description"
              value={editForm.description}
              onChangeText={(text) => updateEditField("description", text)}
            />

            <Text style={styles.labelDark}>Type</Text>
            <TextInput
              style={styles.inputLight}
              value="Expense"
              editable={false}
            />

            <Text style={styles.labelDark}>VAT Classification</Text>
            <View style={styles.inlineOptionRow}>
              {["taxable", "zero_rated", "exempt"].map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.inlineOption,
                    editForm.classification === value &&
                    styles.inlineOptionActive,
                  ]}
                  onPress={() => updateEditField("classification", value)}
                >
                  <Text
                    style={[
                      styles.inlineOptionText,
                      editForm.classification === value &&
                      styles.inlineOptionTextActive,
                    ]}
                  >
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.labelDark}>Transaction Date</Text>
            <TextInput
              style={styles.inputLight}
              placeholder="YYYY-MM-DD"
              value={editForm.transactionDate}
              onChangeText={(text) => updateEditField("transactionDate", text)}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.actionGray}
                onPress={() => setEditVisible(false)}
              >
                <Text style={styles.actionText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionGreen}
                onPress={handleSaveEdit}
                disabled={savingEdit}
              >
                <Text style={styles.actionText}>
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
    backgroundColor: "#f5f7fb",
  },
  content: {
    padding: 20,
  },
  headerRow: {
    marginBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
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
  companyCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
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
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 20,
  },
  summaryCard: {
    flexGrow: 1,
    minWidth: 220,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 18,
  },
  summaryLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  filterCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  filterHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
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
  labelDark: {
    fontSize: 13,
    color: "#111827",
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
  inputLight: {
    height: 42,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  filterActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  secondaryButton: {
    backgroundColor: "#E5E7EB",
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "700",
  },
  outlineButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  outlineButtonText: {
    color: "#111827",
    fontWeight: "700",
  },
  tableCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 0,
    overflow: "hidden",
  },
  tableTop: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  countText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },
  loadingWrap: {
    paddingVertical: 40,
  },
  emptyState: {
    padding: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    minHeight: 52,
    alignItems: "center",
  },
  headerCell: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingHorizontal: 14,
  },
  tableRow: {
    flexDirection: "row",
    minHeight: 72,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  rowEven: {
    backgroundColor: "#FFFFFF",
  },
  rowOdd: {
    backgroundColor: "#FCFCFD",
  },
  bodyCell: {
    fontSize: 14,
    color: "#111827",
    paddingHorizontal: 14,
    fontWeight: "500",
  },
  colId: {
    width: 80,
  },
  colDate: {
    width: 130,
  },
  colDesc: {
    width: 300,
  },
  colClass: {
    width: 140,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  colAmountRight: {
    width: 140,
  },
  colActions: {
    width: 240,
    paddingHorizontal: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  alignRight: {
    textAlign: "right",
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeGreen: {
    backgroundColor: "#DCFCE7",
  },
  badgeBlue: {
    backgroundColor: "#DBEAFE",
  },
  badgeGray: {
    backgroundColor: "#E5E7EB",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    textTransform: "capitalize",
  },
  actionBlue: {
    backgroundColor: "#2563EB",
    minWidth: 64,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionGray: {
    backgroundColor: "#6B7280",
    minWidth: 64,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionGreen: {
    backgroundColor: "#059669",
    minWidth: 110,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionRed: {
    backgroundColor: "#DC2626",
    minWidth: 72,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
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
    maxWidth: 560,
    maxHeight: "88%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  closeButton: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  closeButtonText: {
    fontWeight: "700",
    color: "#111827",
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  detailItem: {
    width: "48%",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
  },
  detailLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
  },
  detailValueStrong: {
    fontSize: 18,
    color: "#111827",
    fontWeight: "800",
  },
  modalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
  },
  inlineOptionRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  inlineOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
  },
  inlineOptionActive: {
    backgroundColor: "#1D4ED8",
  },
  inlineOptionText: {
    color: "#111827",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  inlineOptionTextActive: {
    color: "#FFFFFF",
  },
});