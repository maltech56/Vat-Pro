import React, { useEffect, useState, useMemo } from "react";
import { getToken } from "../src/utils/session";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useCompany } from "../context/CompanyContext";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.maltechenterprises.com/api";

const REPORT_TABS = [
  { key: "summary", label: "Summary" },
  { key: "sales", label: "Sales" },
  { key: "purchases", label: "Purchases" },
  { key: "transactions", label: "Transactions" },
];

const CLASSIFICATION_OPTIONS = ["all", "taxable", "zero_rated", "exempt"];
const TYPE_OPTIONS = ["all", "sale", "expense"];

function formatCurrency(value, currency = "BSD") {
  return new Intl.NumberFormat("en-BS", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-BS", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatClassification(value) {
  if (!value || value === "all") return "All";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeApiDate(value) {
  if (!value) return "";

  const cleaned = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^\d{8}$/.test(cleaned)) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
  }

  return cleaned;
}

export default function ReportsScreen() {
  const { selectedCompany, companyReady } = useCompany();
  const [activeTab, setActiveTab] = useState("summary");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [classification, setClassification] = useState("all");
  const [type, setType] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [reportError, setReportError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exportMessage, setExportMessage] = useState("");

  // ✅ PART 1 — CLEAR DATA ON COMPANY CHANGE ONLY
  useEffect(() => {
    if (!companyReady) return;

    // 🔥 FULL RESET on company change

    setSummary(null);
    setRows([]);

    setError("");
    setReportError("");
    setExportMessage("");

    setLoading(false);
    setExporting(false);
    setRefreshing(false);

    // 🔥 Reset filters (CRITICAL)
    setStartDate("");
    setEndDate("");
    setSearch("");
    setClassification("all");
    setType("all");

    // Optional UX reset
    setActiveTab("summary");

  }, [companyReady, selectedCompany?.id]);
  // ✅ PART 2 — FETCH DATA (ALL FILTERS + TAB CHANGES)
  useEffect(() => {
    if (!companyReady) return;
    if (!selectedCompany?.id) return;

    if (activeTab === "summary") {
      fetchSummary();
    } else {
      fetchRows();
    }
  }, [
    companyReady,
    selectedCompany?.id,
    activeTab,
    startDate,
    endDate,
    search,
    classification,
    type,
  ]);

  const buildQuery = () => {
    const params = new URLSearchParams();

    const normalizedStartDate = normalizeApiDate(startDate);
    const normalizedEndDate = normalizeApiDate(endDate);

    if (normalizedStartDate) params.append("startDate", normalizedStartDate);
    if (normalizedEndDate) params.append("endDate", normalizedEndDate);
    if (search.trim()) params.append("search", search.trim());

    if (classification !== "all") {
      params.append("classification", classification);
    }

    if (activeTab === "transactions" && type !== "all") {
      params.append("type", type);
    }

    return params.toString();
  };

  const validateDateRange = () => {
    const normalizedStartDate = normalizeApiDate(startDate);
    const normalizedEndDate = normalizeApiDate(endDate);

    if (normalizedStartDate && Number.isNaN(new Date(normalizedStartDate).getTime())) {
      setReportError("Start date must be a valid date in YYYY-MM-DD format.");
      return false;
    }

    if (normalizedEndDate && Number.isNaN(new Date(normalizedEndDate).getTime())) {
      setReportError("End date must be a valid date in YYYY-MM-DD format.");
      return false;
    }

    if (
      normalizedStartDate &&
      normalizedEndDate &&
      new Date(normalizedStartDate) > new Date(normalizedEndDate)
    ) {
      setReportError("Start date cannot be after end date.");
      return false;
    }

    setReportError("");
    return true;
  };

  const fetchSummary = async () => {
    try {
      setLoading(true);

      const token = getToken();
      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");
        return;
      }

      const query = buildQuery();
      const url = `${API_BASE}/reports/company/${selectedCompany.id}/summary${query ? `?${query}` : ""
        }`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response;

      if (!response.ok) {
        throw new Error(data.error || "Failed to load summary");
      }

      setSummary(data);
    } catch (error) {
      console.error("fetchSummary error:", error);
      Alert.alert("Error", error.message || "Failed to load report summary.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRows = async () => {
    try {
      setLoading(true);

      const token = getToken();
      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");
        return;
      }

      const query = buildQuery();

      let endpoint = "transactions";
      if (activeTab === "sales") endpoint = "sales";
      if (activeTab === "purchases") endpoint = "purchases";

      const url = `${API_BASE}/reports/company/${selectedCompany.id}/${endpoint}${query ? `?${query}` : ""
        }`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response;

      if (!response.ok) {
        throw new Error(data.error || "Failed to load report rows");
      }

      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("fetchRows error:", error);
      Alert.alert("Error", error.message || "Failed to load report.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshReports = async () => {
    if (!validateDateRange()) return;

    try {
      setRefreshing(true);
      setReportError("");
      setError("");

      if (!selectedCompany?.id) {
        setReportError("Please select a company before refreshing reports.");
        return;
      }

      if (activeTab === "summary") {
        await fetchSummary();
      } else {
        await fetchRows();
      }
    } catch (error) {
      console.error("handleRefreshReports error:", error);

      const message = error.message || "Failed to refresh reports.";
      setReportError(message);
      setError(message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerateVatPdf = async () => {
    console.log("Generate VAT PDFs clicked");

    try {
      if (!selectedCompany?.id) {
        Alert.alert("No Company", "Please select a company first.");
        return;
      }

      const normalizedStartDate = normalizeApiDate(startDate);
      const normalizedEndDate = normalizeApiDate(endDate);

      if (!normalizedStartDate || !normalizedEndDate) {
        Alert.alert("Missing Dates", "Please select a start date and end date.");
        return;
      }

      const token = getToken();
      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");
        return;
      }

      const response = await fetch(
        `${API_BASE}/transactions/company/${selectedCompany.id}/vat-return-pdf?startDate=${normalizedStartDate}&endDate=${normalizedEndDate}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        console.error("VAT PDF export failed:", response.status, errorText);

        Alert.alert(
          "VAT PDF Error",
          `Status: ${response.status}\n${errorText}`
        );

        return;
      }

      const blob = await response.blob();

      if (typeof window === "undefined" || typeof document === "undefined") {
        Alert.alert(
          "Download Ready",
          "PDF generation is only available in the web browser."
        );
        return;
      }

      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `VAT_Return_${(
        selectedCompany.name ||
        selectedCompany.company_name ||
        "company"
      ).replace(/\s+/g, "_")}_${normalizedStartDate}_to_${normalizedEndDate}.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("handleGenerateVatPdf error:", error);
      Alert.alert("Error", "Failed to generate VAT PDF.");
    }
  };

  const handleExportCsv = async () => {
    if (!validateDateRange()) return;

    try {
      setExporting(true);
      setExportMessage("");
      setError("");
      setReportError("");

      const token = getToken();

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");
        return;
      }

      if (!selectedCompany?.id) {
        setReportError("Please select a company before exporting.");
        Alert.alert("No Company", "Please select a company first.");
        return;
      }

      const query = buildQuery();
      const url = `${API_BASE}/reports/company/${selectedCompany.id}/export/csv${query ? `?${query}` : ""
        }`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();

        console.error("CSV export failed:", response.status, errorText);

        const message =
          errorText || `CSV export failed with status ${response.status}.`;

        setReportError(message);

        Alert.alert("CSV Export Error", message);
        return;
      }

      const blob = await response.blob();

      if (typeof window === "undefined" || typeof document === "undefined") {
        setReportError("CSV export is only available in the web browser.");
        Alert.alert(
          "Export Ready",
          "CSV export is only available in the web browser."
        );
        return;
      }

      const safeCompanyName = String(
        selectedCompany.name || selectedCompany.company_name || "company"
      ).replace(/\s+/g, "_");

      const fileName = `VAT_Report_${safeCompanyName}_${normalizeApiDate(startDate) || "all"
        }_to_${normalizeApiDate(endDate) || "all"}.csv`;

      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(downloadUrl);

      setExportMessage("CSV report exported successfully.");
    } catch (error) {
      console.error("handleExportCsv error:", error);

      const message = error.message || "Failed to export CSV.";

      setReportError(message);
      setError(message);
      Alert.alert("Error", message);
    } finally {
      setExporting(false);
    }
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.amount += Number(row.amount || 0);
        acc.vat += Number(row.vat_amount || 0);
        return acc;
      },
      { amount: 0, vat: 0 }
    );
  }, [rows]);

  if (companyReady && !selectedCompany?.id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No company selected.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.companyCard}>
        <Text style={styles.companyLabel}>Selected Company</Text>
        <Text style={styles.companyName}>
          {selectedCompany.name ||
            selectedCompany.company_name ||
            `Company #${selectedCompany.id}`}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsRow}
      >
        {REPORT_TABS.map((tab) => {
          const active = activeTab === tab.key;

          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, active && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.filtersCard}>
        <Text style={styles.sectionTitle}>Filters</Text>

        <View style={styles.filtersRow}>
          <TextInput
            style={styles.input}
            placeholder="Start Date (YYYY-MM-DD)"
            value={startDate}
            onChangeText={(value) => setStartDate(normalizeApiDate(value))}
          />
          <TextInput
            style={styles.input}
            placeholder="End Date (YYYY-MM-DD)"
            value={endDate}
            onChangeText={(value) => setEndDate(normalizeApiDate(value))}
          />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Search description..."
          value={search}
          onChangeText={setSearch}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillRow}
        >
          {CLASSIFICATION_OPTIONS.map((option) => {
            const active = classification === option;

            return (
              <TouchableOpacity
                key={option}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setClassification(option)}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {formatClassification(option)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activeTab === "transactions" && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillRow}
          >
            {TYPE_OPTIONS.map((option) => {
              const active = type === option;

              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setType(option)}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {option === "all"
                      ? "All"
                      : option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <TouchableOpacity
          style={[
            styles.exportButton,
            (exporting || !selectedCompany?.id) && styles.exportButtonDisabled,
          ]}
          onPress={handleExportCsv}
          disabled={exporting || !selectedCompany?.id}
        >
          <Text style={styles.exportButtonText}>
            {exporting ? "Exporting..." : "Export CSV"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.refreshButton,
            (refreshing || !selectedCompany?.id) && styles.exportButtonDisabled,
          ]}
          onPress={handleRefreshReports}
          disabled={refreshing || !selectedCompany?.id}
        >
          <Text style={styles.refreshButtonText}>
            {refreshing ? "Refreshing..." : "Refresh Reports"}
          </Text>
        </TouchableOpacity>

        {exportMessage ? (
          <Text style={styles.successText}>{exportMessage}</Text>
        ) : null}

        {(error || reportError) ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {reportError || error}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.generatePdfButton}
          onPress={handleGenerateVatPdf}
        >
          <Text style={styles.generatePdfButtonText}>Generate VAT PDF</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centeredBlock}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>Loading report...</Text>
        </View>
      ) : activeTab === "summary" ? (
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {formatCurrency(summary?.totalSales)}
            </Text>
            <Text style={styles.summaryLabel}>Total Sales</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {formatCurrency(summary?.totalExpenses)}
            </Text>
            <Text style={styles.summaryLabel}>Total Expenses</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {formatCurrency(summary?.outputVAT)}
            </Text>
            <Text style={styles.summaryLabel}>Output VAT</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {formatCurrency(summary?.inputVAT)}
            </Text>
            <Text style={styles.summaryLabel}>Input VAT</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {formatCurrency(summary?.netVATPayable)}
            </Text>
            <Text style={styles.summaryLabel}>Net VAT Payable</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {summary?.transactionCount || 0}
            </Text>
            <Text style={styles.summaryLabel}>Transactions</Text>
          </View>
        </View>
      ) : (
        <View style={styles.tableCard}>
          <View style={styles.totalBar}>
            <Text style={styles.totalText}>Rows: {rows.length}</Text>
            <Text style={styles.totalText}>
              Amount: {formatCurrency(totals.amount)}
            </Text>
            <Text style={styles.totalText}>
              VAT: {formatCurrency(totals.vat)}
            </Text>
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.dateCell]}>Date</Text>
            <Text style={[styles.headerCell, styles.typeCell]}>Type</Text>
            <Text style={[styles.headerCell, styles.classCell]}>Class</Text>
            <Text style={[styles.headerCell, styles.amountCell]}>Amount</Text>
            <Text style={[styles.headerCell, styles.vatCell]}>VAT</Text>
            <Text style={[styles.headerCell, styles.descCell]}>Description</Text>
          </View>

          {rows.length === 0 ? (
            <View style={styles.centeredBlock}>
              <Text style={styles.emptyText}>No report rows found.</Text>
            </View>
          ) : (
            rows.map((row) => (
              <View key={row.id} style={styles.tableRow}>
                <Text style={styles.dateCell}>
                  {formatDate(row.transaction_date)}
                </Text>
                <Text style={styles.typeCell}>{row.type}</Text>
                <Text style={styles.classCell}>
                  {formatClassification(row.classification)}
                </Text>
                <Text style={styles.amountCell}>
                  {formatCurrency(row.amount)}
                </Text>
                <Text style={styles.vatCell}>
                  {formatCurrency(row.vat_amount)}
                </Text>
                <Text style={styles.descCell}>{row.description || "-"}</Text>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#f8fafc",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centeredBlock: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    marginTop: 16,
  },
  companyCard: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  companyLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  companyName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  tabsRow: {
    marginBottom: 16,
  },
  tabButton: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 10,
  },
  tabButtonActive: {
    backgroundColor: "#0f172a",
  },
  tabText: {
    color: "#334155",
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  filtersCard: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  pillRow: {
    marginBottom: 12,
  },
  pill: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 10,
  },
  pillActive: {
    backgroundColor: "#0f172a",
  },
  pillText: {
    color: "#334155",
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#ffffff",
  },
  exportButton: {
    backgroundColor: "#0f172a",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  exportButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  generatePdfButton: {
    backgroundColor: "#DC2626",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  generatePdfButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  errorBox: {
    padding: 16,
    backgroundColor: "#fff1f0",
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#ffccc7",
  },
  errorText: {
    color: "#a8071a",
    fontSize: 14,
    fontWeight: "600",
  },
  successText: {
    color: "#15803d",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  exportButtonDisabled: {
    opacity: 0.45,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  refreshButton: {
    backgroundColor: "#334155",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  refreshButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    minWidth: 180,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  summaryLabel: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748b",
  },
  tableCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    overflow: "hidden",
  },
  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
  },
  totalText: {
    fontWeight: "600",
    color: "#0f172a",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  headerCell: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  dateCell: {
    flex: 1.2,
    color: "#0f172a",
  },
  typeCell: {
    flex: 1,
    color: "#0f172a",
  },
  classCell: {
    flex: 1.4,
    color: "#0f172a",
  },
  amountCell: {
    flex: 1.2,
    color: "#0f172a",
  },
  vatCell: {
    flex: 1.2,
    color: "#0f172a",
  },
  descCell: {
    flex: 2,
    color: "#0f172a",
  },
  loadingText: {
    marginTop: 10,
    color: "#64748b",
  },
});