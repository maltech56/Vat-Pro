import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import { getToken } from "../src/utils/session";
import { useCompany } from "../context/CompanyContext";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const API_BASE = "http://localhost:5000/api";

export default function VatFilingHistory() {
  const [filings, setFilings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingPackId, setDownloadingPackId] = useState(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState("desc");
  const { selectedCompany, companyReady } = useCompany();
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedFiling, setSelectedFiling] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [auditScores, setAuditScores] = useState({});
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });


  useEffect(() => {
    if (!companyReady) return;

    setFilings([]);
    setSelectedFiling(null);
    setDetailsVisible(false);
    setLoading(true);

    if (!selectedCompany?.id) {
      setLoading(false);
      return;
    }

    fetchFilings({
      companyId: selectedCompany.id,
      page: 1,
      limit: pageSize,
      search: searchTerm,
      sortField,
      sortDirection,
    });
  }, [companyReady, selectedCompany?.id]);

  const fetchFilings = async ({
    companyId,
    page = currentPage,
    limit = pageSize,
    search = searchTerm,
    sortField: requestSortField = sortField,
    sortDirection: requestSortDirection = sortDirection,
    fromDate: requestFromDate,
    toDate: requestToDate,
  }) => {
    try {
      setLoading(true);

      const token = getToken();
      if (!token) {
        Alert.alert("No token found. Please log in again.");
        setLoading(false);
        return;
      }

      const effectiveFromDate =
        typeof requestFromDate === "string" ? requestFromDate : fromDate;
      const effectiveToDate =
        typeof requestToDate === "string" ? requestToDate : toDate;

      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("limit", String(limit));
      params.append("sortField", requestSortField);
      params.append("sortDirection", requestSortDirection);

      if (search) params.append("search", search);
      if (effectiveFromDate) params.append("fromDate", effectiveFromDate);
      if (effectiveToDate) params.append("toDate", effectiveToDate);

      const url = `${API_BASE}/vat-filings/company/${companyId}?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch filings");
      }

      console.log("FILINGS RESPONSE:", data);

      const filingRows = Array.isArray(data) ? data : [];

      setFilings(filingRows);
      setPagination({
        page: 1,
        limit: filingRows.length,
        totalItems: filingRows.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
      setCurrentPage(1);

      const scoreEntries = await Promise.all(
        filingRows.map(async (filing) => {
          try {
            const token = getToken();

            const res = await fetch(
              `${API_BASE}/vat-filings/${filing.id}/filing-pack-summary`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            const data = await res.json();

            if (!res.ok) return [filing.id, null];

            return [
              filing.id,
              {
                auditScore: Number(data.audit?.auditScore || 0),
                missing: Number(data.stats?.missingDocumentCount || 0),
              },
            ];
          } catch {
            return [filing.id, null];
          }
        })
      );

      setAuditScores(Object.fromEntries(scoreEntries));

    } catch (error) {
      console.error("Fetch filings error:", error);
      Alert.alert("Error", error.message || "Failed to fetch filings");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = async () => {
    if (!selectedCompany?.id) return;

    setCurrentPage(1);

    await fetchFilings({
      companyId: selectedCompany.id,
      page: 1,
      limit: pageSize,
      search: searchTerm,
      sortField,
      sortDirection,
    });
  };

  const handleClearFilters = async () => {
    if (!selectedCompany?.id) return;

    setFromDate("");
    setToDate("");
    setSearchTerm("");
    setSortField("createdAt");
    setSortDirection("desc");
    setCurrentPage(1);

    await fetchFilings({
      companyId: selectedCompany.id,
      page: 1,
      limit: pageSize,
      search: "",
      sortField: "createdAt",
      sortDirection: "desc",
      fromDate: "",
      toDate: "",
    });
  };

  const handlePageSizeChange = async (size) => {
    if (!selectedCompany?.id) return;

    setPageSize(size);
    setCurrentPage(1);

    await fetchFilings({
      companyId: selectedCompany.id,
      page: 1,
      limit: size,
      search: searchTerm,
      sortField,
      sortDirection,
    });
  };

  const handlePageChange = async (newPage) => {
    if (!selectedCompany?.id) return;

    await fetchFilings({
      companyId: selectedCompany.id,
      page: newPage,
      limit: pageSize,
      search: searchTerm,
      sortField,
      sortDirection,
    });
  };

  const handleViewDetails = async (filingId) => {
    try {
      const token = getToken();

      if (!token) {
        Alert.alert("No token found. Please log in again.");
        return;
      }

      const response = await fetch(`${API_BASE}/vat-filings/${filingId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch filing details");
      }

      setSelectedFiling(data);
      setDetailsVisible(true);
    } catch (error) {
      console.error("View details error:", error);
      Alert.alert("Error", error.message || "Failed to load filing details");
    }
  };

  const handleProtectedSubmit = (filingId) => {
    const score = auditScores[filingId]?.auditScore ?? 0;
    const missing = auditScores[filingId]?.missing ?? 0;

    // 🔒 HARD BLOCK (below 80)
    if (score < 80) {
      Alert.alert(
        "Submission Blocked",
        `Audit Score: ${score}%\n\nThis filing cannot be submitted until the audit score is at least 80%.`
      );
      return;
    }

    // ⚠️ WARNING (80–99 or missing docs)
    if (score < 100 || missing > 0) {
      Alert.alert(
        "Audit Warning",
        `Audit Score: ${score}%\nMissing Documents: ${missing}\n\nThis filing may be incomplete. Continue anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            onPress: () => handleSubmitFiling(filingId),
          },
        ]
      );
      return;
    }

    // ✅ PERFECT
    handleSubmitFiling(filingId);
  };

  const handleSubmitFiling = (filingId) => {
    Alert.alert(
      "Submit Filing",
      "Mark this filing as submitted? The system will check audit readiness before allowing submission.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            try {
              const token = getToken();

              const response = await fetch(
                `${API_BASE}/vat-filings/${filingId}/status`,
                {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ status: "submitted" }),
                }
              );

              const data = await response.json();

              if (!response.ok) {
                if (data.auditScore !== undefined) {
                  throw new Error(
                    `${data.error}\n\nAudit Score: ${data.auditScore}%\nMissing Documents: ${data.missingDocumentCount}`
                  );
                }

                throw new Error(data.error || "Failed to submit filing");
              }

              Alert.alert("Success", "Filing marked as submitted");

              if (selectedCompany?.id) {
                await fetchFilings({
                  companyId: selectedCompany.id,
                  page: currentPage,
                  limit: pageSize,
                  search: searchTerm,
                  sortField,
                  sortDirection,
                });
              }

              if (selectedFiling?.id === filingId) {
                setSelectedFiling((prev) =>
                  prev ? { ...prev, status: "submitted" } : prev
                );
              }
            } catch (error) {
              console.error("Submit filing error:", error);
              Alert.alert(
                "Submission Blocked",
                error.message ||
                "This filing cannot be submitted until audit readiness issues are resolved."
              );
            }
          },
        },
      ]
    );
  };

  const handleDelete = (filingId) => {
    Alert.alert(
      "Delete Filing",
      "Are you sure you want to delete this filing?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = getToken();

              const response = await fetch(
                `${API_BASE}/vat-filings/${filingId}`,
                {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              const data = await response.json();

              if (!response.ok) {
                throw new Error(data.error || "Delete failed");
              }

              Alert.alert("Success", "Filing deleted");

              if (selectedFiling?.id === filingId) {
                setDetailsVisible(false);
                setSelectedFiling(null);
              }

              if (selectedCompany?.id) {
                const targetPage =
                  filings.length === 1 && currentPage > 1
                    ? currentPage - 1
                    : currentPage;

                await fetchFilings({
                  companyId: selectedCompany.id,
                  page: targetPage,
                  limit: pageSize,
                  search: searchTerm,
                  sortField,
                  sortDirection,
                });
              }
            } catch (error) {
              console.error("Delete error:", error);
              Alert.alert("Error", error.message || "Failed to delete filing");
            }
          },
        },
      ]
    );
  };

  const handleOpenPdf = async (filingId) => {
    try {
      const token = getToken();

      if (!token) {
        Alert.alert("No token found. Please log in again.");
        return;
      }

      const url = `${API_BASE}/vat-filings/${filingId}/pdf`;

      if (Platform.OS === "web") {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          let errorMessage = "Failed to open PDF";

          try {
            const data = await response.json();
            errorMessage = data.error || errorMessage;
          } catch {
            // ignore JSON parse error
          }

          throw new Error(errorMessage);
        }

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.target = "_blank";
        link.download = `vat_filing_${filingId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.URL.revokeObjectURL(blobUrl);
      } else {
        Alert.alert(
          "PDF",
          "Mobile/native PDF opening with auth headers is not supported directly. Please use the Filing Pack button to download and share the document."
        );
      }
    } catch (error) {
      console.error("PDF error:", error);
      Alert.alert("Error", error.message || "Failed to open PDF");
    }
  };

  const confirmAndDownloadFilingPack = (filingId) => {
    if (!filingId) {
      Alert.alert("Filing Pack", "Invalid filing ID.");
      return;
    }

    if (downloadingPackId === filingId) {
      return;
    }

    const audit = auditScores[filingId];

    if (!audit) {
      Alert.alert(
        "Audit Check Unavailable",
        "The audit score could not be loaded for this filing. You can still generate the filing pack, but it may not reflect audit readiness.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            onPress: () => handleDownloadFilingPack(filingId),
          },
        ]
      );
      return;
    }

    const score = Number(audit.auditScore || 0);
    const missing = Number(audit.missing || 0);

    if (score < 80 || missing > 0) {
      const message =
        `Audit Score: ${score}%\n` +
        `Missing Documents: ${missing}\n\n` +
        "This filing pack may be incomplete. Continue anyway?";

      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        typeof window.confirm === "function"
      ) {
        const confirmed = window.confirm(message);
        if (confirmed) {
          handleDownloadFilingPack(filingId);
        }
        return;
      }

      Alert.alert("Audit Warning", message, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => handleDownloadFilingPack(filingId),
        },
      ]);

      return;
    }

    handleDownloadFilingPack(filingId);
  };


  const handleDownloadFilingPack = async (filingId) => {
    try {
      const token = getToken();

      if (!token) {
        Alert.alert("No token found. Please log in again.");
        return;
      }

      if (!filingId) {
        Alert.alert("Error", "Invalid filing ID");
        return;
      }

      setDownloadingPackId(filingId);

      const response = await fetch(
        `${API_BASE}/vat-filings/${filingId}/filing-pack`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const rawText = await response.text();
        console.error("Filing pack failed:", response.status, rawText);

        let errorMessage = `Failed to generate filing pack (${response.status})`;

        try {
          const data = JSON.parse(rawText);
          errorMessage = data.details
            ? `${data.error}: ${data.details}`
            : data.error || errorMessage;
        } catch {
          errorMessage = rawText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type");

      if (!contentType || !contentType.includes("application/pdf")) {
        throw new Error("Invalid filing pack response");
      }

      if (Platform.OS === "web") {
        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `vat_filing_pack_${filingId}.pdf`;
        link.target = "_blank";

        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }, 1000);
      } else {
        const fileName = `vat_filing_pack_${filingId}.pdf`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

        const downloadResult = await FileSystem.downloadAsync(
          `${API_BASE}/vat-filings/${filingId}/filing-pack`,
          fileUri,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (downloadResult.status !== 200) {
          throw new Error(`Mobile download failed (${downloadResult.status})`);
        }

        const sharingAvailable = await Sharing.isAvailableAsync();

        if (!sharingAvailable) {
          Alert.alert(
            "Filing Pack Saved",
            `The filing pack was saved inside the app as ${fileName}, but sharing is not available on this device.`
          );
          return;
        }

        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: "application/pdf",
          dialogTitle: "Save or share VAT Filing Pack",
          UTI: "com.adobe.pdf",
        });
      }
    } catch (error) {
      console.error("Filing Pack error:", error);
      Alert.alert(
        "Filing Pack Failed",
        error.message || "Unable to generate filing pack"
      );
    } finally {
      setDownloadingPackId(null);
    }
  };

  const formatCurrency = (value) =>
    Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatDate = (value) =>
    value ? new Date(value).toLocaleDateString() : "-";

  const formatDateTime = (value) =>
    value ? new Date(value).toLocaleString() : "-";

  const getStatusStyle = (status) => {
    const normalized = status || "draft";

    if (normalized === "submitted") {
      return [styles.statusBadge, styles.statusSubmitted];
    }

    if (normalized === "locked") {
      return [styles.statusBadge, styles.statusLocked];
    }

    return [styles.statusBadge, styles.statusDraft];
  };

  const toggleSort = async (field) => {
    if (!selectedCompany?.id) return;

    const nextDirection =
      sortField === field
        ? sortDirection === "asc"
          ? "desc"
          : "asc"
        : "asc";

    setSortField(field);
    setSortDirection(nextDirection);
    setCurrentPage(1);

    await fetchFilings({
      companyId: selectedCompany.id,
      page: 1,
      limit: pageSize,
      search: searchTerm,
      sortField: field,
      sortDirection: nextDirection,
    });
  };

  const getSortIndicator = (field) => {
    if (sortField !== field) return "";
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  const handleExportCsv = async () => {
    try {
      if (Platform.OS !== "web") {
        Alert.alert(
          "CSV Export",
          "CSV export is currently enabled for web. Native/mobile export can be added with a file-save flow."
        );
        return;
      }

      if (!selectedCompany?.id) {
        Alert.alert("CSV Export", "No company selected.");
        return;
      }

      const token = getToken();

      if (!token) {
        Alert.alert("No token found. Please log in again.");
        return;
      }

      const params = new URLSearchParams();
      params.append("sortField", sortField);
      params.append("sortDirection", sortDirection);

      if (searchTerm) params.append("search", searchTerm);
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);

      const url = `${API_BASE}/vat-filings/company/${selectedCompany.id}/export-csv?${params.toString()}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let errorMessage = "Failed to export CSV";

        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // ignore JSON parse error
        }

        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      const companyName = (selectedCompany?.name || "company")
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "");

      link.href = blobUrl;
      link.download = `vat_filing_history_full_${companyName || "company"}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("CSV export error:", error);
      Alert.alert("Error", error.message || "Failed to export CSV");
    }
  };

  const normalizeStatus = (status) =>
    String(status || "").toLowerCase().trim();

  const canSubmitFiling = (filing) =>
    normalizeStatus(filing?.status) === "draft";

  const canLockFiling = (filing) =>
    normalizeStatus(filing?.status) === "submitted";

  const canDeleteFiling = (filing) =>
    normalizeStatus(filing?.status) === "draft";

  if (!companyReady) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator />
          <Text style={styles.emptyText}>Loading filing history...</Text>
        </View>
      </View>
    );
  }

  if (!selectedCompany?.id) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>VAT Filing History</Text>
          <Text style={styles.emptyText}>No company selected.</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>VAT Filing History</Text>
            <Text style={styles.subtitle}>
              Server-side search, sort, pagination, export, and filing controls
            </Text>
          </View>
        </View>

        <View style={styles.filterCard}>
          <View style={styles.filterHeader}>
            <Text style={styles.sectionTitle}>Filters</Text>
            <Text style={styles.companyText}>
              {selectedCompany?.name || "No company selected"}
            </Text>
          </View>

          <View style={styles.filterRow}>
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

            <View style={styles.filterField}>
              <Text style={styles.label}>Search</Text>
              <TextInput
                style={styles.input}
                placeholder="Search filing #, period, or status"
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
            </View>

            <View style={styles.filterFieldSmall}>
              <Text style={styles.label}>Rows</Text>
              <View style={styles.pageSizeRow}>
                {[10, 25, 50].map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.pageSizeButton,
                      pageSize === size && styles.pageSizeButtonActive,
                    ]}
                    onPress={() => handlePageSizeChange(size)}
                  >
                    <Text
                      style={[
                        styles.pageSizeButtonText,
                        pageSize === size && styles.pageSizeButtonTextActive,
                      ]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleApplyFilters}
              >
                <Text style={styles.primaryButtonText}>Apply</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleClearFilters}
              >
                <Text style={styles.secondaryButtonText}>Clear</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportButton}
                onPress={handleExportCsv}
              >
                <Text style={styles.exportButtonText}>Export CSV</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.tableCard}>
          <View style={styles.tableTop}>
            <Text style={styles.sectionTitle}>Saved Filings</Text>
            <Text style={styles.countText}>
              {pagination.totalItems === 0
                ? "0 filings"
                : `Showing page ${pagination.page} of ${pagination.totalPages} • ${pagination.totalItems} total`}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" />
            </View>
          ) : filings.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No filings found</Text>
              <Text style={styles.emptyText}>
                Try adjusting the filters, search text, or save a new VAT filing.
              </Text>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  <View style={styles.tableHeader}>
                    <TouchableOpacity
                      style={[styles.sortHeaderCell, styles.colId]}
                      onPress={() => toggleSort("id")}
                    >
                      <Text style={styles.headerCell}>
                        Filing #{getSortIndicator("id")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.sortHeaderCell, styles.colPeriod]}
                      onPress={() => toggleSort("startDate")}
                    >
                      <Text style={styles.headerCell}>
                        Period{getSortIndicator("startDate")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.sortHeaderCell, styles.colAmount]}
                      onPress={() => toggleSort("outputVat")}
                    >
                      <Text style={[styles.headerCell, styles.alignRight]}>
                        Output VAT{getSortIndicator("outputVat")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.sortHeaderCell, styles.colAmount]}
                      onPress={() => toggleSort("inputVat")}
                    >
                      <Text style={[styles.headerCell, styles.alignRight]}>
                        Input VAT{getSortIndicator("inputVat")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.sortHeaderCell, styles.colAmount]}
                      onPress={() => toggleSort("netVat")}
                    >
                      <Text style={[styles.headerCell, styles.alignRight]}>
                        Net VAT{getSortIndicator("netVat")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.sortHeaderCell, styles.colStatus]}
                      onPress={() => toggleSort("status")}
                    >
                      <Text style={styles.headerCell}>
                        Status{getSortIndicator("status")}
                      </Text>
                    </TouchableOpacity>

                    <View style={[styles.sortHeaderCell, styles.colAudit]}>
                      <Text style={styles.headerCell}>Audit</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.sortHeaderCell, styles.colCreated]}
                      onPress={() => toggleSort("createdAt")}
                    >
                      <Text style={styles.headerCell}>
                        Created{getSortIndicator("createdAt")}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.colActions}>
                      <Text style={styles.headerCell}>Actions</Text>
                    </View>
                  </View>

                  {filings.map((f, index) => (
                    <View
                      key={f.id}
                      style={[
                        styles.tableRow,
                        index % 2 === 0 ? styles.rowEven : styles.rowOdd,
                      ]}
                    >
                      <Text style={[styles.bodyCell, styles.colId]}>{f.id}</Text>

                      <View style={styles.colPeriod}>
                        <Text style={styles.periodText}>
                          {formatDate(f.startDate)} - {formatDate(f.endDate)}
                        </Text>
                      </View>

                      <Text
                        style={[styles.bodyCell, styles.colAmount, styles.alignRight]}
                      >
                        {formatCurrency(f.outputVat)}
                      </Text>

                      <Text
                        style={[styles.bodyCell, styles.colAmount, styles.alignRight]}
                      >
                        {formatCurrency(f.inputVat)}
                      </Text>

                      <Text
                        style={[
                          styles.bodyCell,
                          styles.colAmount,
                          styles.netText,
                          styles.alignRight,
                        ]}
                      >
                        {formatCurrency(f.netVat)}
                      </Text>

                      <View style={styles.colStatus}>
                        <View style={getStatusStyle(f.status)}>
                          <Text style={styles.statusText}>
                            {f.status || "draft"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.colAudit}>
                        <Text style={{ fontWeight: "700" }}>
                          {auditScores[f.id]
                            ? `${auditScores[f.id].auditScore}%`
                            : "..."}
                        </Text>
                      </View>

                      <Text style={[styles.bodyCell, styles.colCreated]}>
                        {formatDateTime(f.createdAt)}
                      </Text>

                      <View style={[styles.colActions, styles.actionsWrap]}>
                        <TouchableOpacity
                          style={styles.actionSlate}
                          onPress={() => handleViewDetails(f.id)}
                        >
                          <Text style={styles.actionText}>View</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.actionBlue}
                          onPress={() => handleOpenPdf(f.id)}
                        >
                          <Text style={styles.actionText}>PDF</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.actionSlate,
                            downloadingPackId === f.id && styles.buttonDisabled,
                          ]}
                          onPress={() => confirmAndDownloadFilingPack(f.id)}
                          disabled={downloadingPackId === f.id}
                        >
                          <Text style={styles.actionText}>
                            {downloadingPackId === f.id ? "Generating..." : "Filing Pack"}
                          </Text>
                        </TouchableOpacity>

                        {f.status === "draft" || !f.status ? (<TouchableOpacity
                          style={[
                            styles.actionGreen,
                            auditScores[f.id] &&
                            auditScores[f.id].auditScore < 80 &&
                            styles.buttonDisabled
                          ]}
                          onPress={() => handleProtectedSubmit(f.id)}
                        >
                          <Text style={styles.actionText}>
                            {auditScores[f.id] && auditScores[f.id].auditScore < 80
                              ? "Blocked"
                              : "Submit"}
                          </Text>
                        </TouchableOpacity>
                        ) : (
                          <View style={styles.actionGray}>
                            <Text style={styles.actionText}>
                              {f.status === "locked" ? "Locked" : "Submitted"}
                            </Text>
                          </View>
                        )}

                        {f.status === "draft" || !f.status ? (
                          <TouchableOpacity
                            style={styles.actionRed}
                            onPress={() => handleDelete(f.id)}
                          >
                            <Text style={styles.actionText}>Delete</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.actionGray}>
                            <Text style={styles.actionText}>Protected</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.paginationBar}>
                <Text style={styles.paginationText}>
                  Page {pagination.page} of {pagination.totalPages}
                </Text>

                <View style={styles.paginationButtons}>
                  <TouchableOpacity
                    style={[
                      styles.pageNavButton,
                      !pagination.hasPreviousPage && styles.pageNavButtonDisabled,
                    ]}
                    onPress={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPreviousPage}
                  >
                    <Text
                      style={[
                        styles.pageNavButtonText,
                        !pagination.hasPreviousPage &&
                        styles.pageNavButtonTextDisabled,
                      ]}
                    >
                      Previous
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.pageNavButton,
                      !pagination.hasNextPage && styles.pageNavButtonDisabled,
                    ]}
                    onPress={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNextPage}
                  >
                    <Text
                      style={[
                        styles.pageNavButtonText,
                        !pagination.hasNextPage &&
                        styles.pageNavButtonTextDisabled,
                      ]}
                    >
                      Next
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

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
                  Filing #{selectedFiling?.id || "-"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Detailed filing information
                </Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setDetailsVisible(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            {selectedFiling ? (
              <ScrollView showsVerticalScrollIndicator>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Company</Text>
                    <Text style={styles.detailValue}>
                      {selectedFiling.company_name || selectedCompany?.name || "-"}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View style={getStatusStyle(selectedFiling.status)}>
                      <Text style={styles.statusText}>
                        {selectedFiling.status || "draft"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Period Start</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedFiling.startDate)}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Period End</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedFiling.endDate)}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Total Sales</Text>
                    <Text style={styles.detailValue}>
                      {formatCurrency(selectedFiling.totalSales)}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Taxable Sales</Text>
                    <Text style={styles.detailValue}>
                      {formatCurrency(selectedFiling.taxableSales)}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Zero Rated Sales</Text>
                    <Text style={styles.detailValue}>
                      {formatCurrency(selectedFiling.zeroRatedSales)}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Exempt Sales</Text>
                    <Text style={styles.detailValue}>
                      {formatCurrency(selectedFiling.exemptSales)}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Output VAT</Text>
                    <Text style={styles.detailValue}>
                      {formatCurrency(selectedFiling.outputVat)}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Input VAT</Text>
                    <Text style={styles.detailValue}>
                      {formatCurrency(selectedFiling.inputVat)}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Net VAT Payable</Text>
                    <Text style={styles.detailValueStrong}>
                      {formatCurrency(selectedFiling.netVat)}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Created At</Text>
                    <Text style={styles.detailValue}>
                      {formatDateTime(selectedFiling.createdAt)}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.actionBlue}
                    onPress={() => handleOpenPdf(selectedFiling.id)}
                  >
                    <Text style={styles.actionText}>Open PDF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionSlate,
                      downloadingPackId === selectedFiling.id && styles.buttonDisabled,
                    ]}
                    onPress={() => confirmAndDownloadFilingPack(selectedFiling.id)}
                    disabled={downloadingPackId === selectedFiling.id}
                  >
                    <Text style={styles.actionText}>
                      {downloadingPackId === selectedFiling.id
                        ? "Generating..."
                        : "Filing Pack"}
                    </Text>
                  </TouchableOpacity>

                  {(selectedFiling.status === "draft" || !selectedFiling.status) && (
                    <TouchableOpacity
                      style={styles.actionGreen}
                      onPress={() => handleProtectedSubmit(selectedFiling.id)}
                    >
                      <Text style={styles.actionText}>Submit Filing</Text>
                    </TouchableOpacity>
                  )}

                  {(selectedFiling.status === "draft" || !selectedFiling.status) && (
                    <TouchableOpacity
                      style={styles.actionRed}
                      onPress={() => handleDelete(selectedFiling.id)}
                    >
                      <Text style={styles.actionText}>Delete Filing</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>No filing selected.</Text>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  content: {
    padding: 20,
  },
  headerRow: {
    marginBottom: 18,
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
  filterCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  companyText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
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
  filterFieldSmall: {
    minWidth: 160,
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
  pageSizeRow: {
    flexDirection: "row",
    gap: 8,
  },
  pageSizeButton: {
    minWidth: 44,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  pageSizeButtonActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  pageSizeButtonText: {
    fontWeight: "700",
    color: "#111827",
  },
  pageSizeButtonTextActive: {
    color: "#FFFFFF",
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
  secondaryButton: {
    backgroundColor: "#E5E7EB",
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  exportButton: {
    backgroundColor: "#0F766E",
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
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "700",
  },
  exportButtonText: {
    color: "#FFFFFF",
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
  sortHeaderCell: {
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 14,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    minHeight: 76,
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
    width: 90,
  },
  colPeriod: {
    width: 220,
    paddingHorizontal: 14,
  },
  colAmount: {
    width: 150,
  },
  colStatus: {
    width: 130,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  colAudit: {
    width: 90,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  colCreated: {
    width: 190,
    paddingHorizontal: 14,
  },
  colActions: {
    width: 420,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  alignRight: {
    textAlign: "right",
  },
  periodText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
  },
  netText: {
    fontWeight: "700",
    color: "#111827",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusDraft: {
    backgroundColor: "#E5E7EB",
  },
  statusSubmitted: {
    backgroundColor: "#DBEAFE",
  },
  statusLocked: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    textTransform: "capitalize",
  },
  actionsWrap: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  actionSlate: {
    backgroundColor: "#475569",
    minWidth: 76,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionBlue: {
    backgroundColor: "#2563EB",
    minWidth: 76,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionGreen: {
    backgroundColor: "#059669",
    minWidth: 88,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionRed: {
    backgroundColor: "#DC2626",
    minWidth: 82,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionGray: {
    backgroundColor: "#9CA3AF",
    minWidth: 92,
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
  paginationBar: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  paginationText: {
    fontSize: 14,
    color: "#4B5563",
    fontWeight: "600",
  },
  paginationButtons: {
    flexDirection: "row",
    gap: 10,
  },
  pageNavButton: {
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  pageNavButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  pageNavButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  pageNavButtonTextDisabled: {
    color: "#9CA3AF",
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
    maxWidth: 760,
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 22,
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


});