import { useCompany } from "../context/CompanyContext";
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
  Platform,
  Modal,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Picker } from "@react-native-picker/picker";
import { getToken } from "../src/utils/session";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.maltechenterprises.com/api";
  
const FILE_BASE =
  (process.env.EXPO_PUBLIC_API_URL ||
    "https://api.maltechenterprises.com/api")
    .replace("/api", "");

const CATEGORY_OPTIONS = [
  "All",
  "General",
  "VAT",
  "Invoice",
  "Receipt",
  "Contract",
  "Report",
  "Other",
];

const formatLinkedTransaction = (doc) => {
  if (!doc.transaction_id) return null;

  const type = doc.type ? doc.type.toUpperCase() : "TXN";
  const amount = Number(doc.amount || 0).toFixed(2);
  const description = (doc.description || "").slice(0, 25);

  return `${type} • $${amount} • ${description}`;
};

function inferCategory(filename = "") {
  const lower = filename.toLowerCase();

  if (lower.includes("vat")) return "VAT";
  if (lower.includes("invoice")) return "Invoice";
  if (lower.includes("receipt")) return "Receipt";
  if (lower.includes("contract")) return "Contract";
  if (lower.includes("report")) return "Report";
  return "General";
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

function formatFileSize(fileSize, fallbackSize) {
  const size = Number(fileSize || fallbackSize || 0);

  if (!size) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function buildFileUrl(filePath) {
  if (!filePath) return null;

  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  return `${FILE_BASE}${filePath}`;
}

function formatTransactionLabel(txn) {
  const amount = Number(txn?.amount || 0).toFixed(2);
  const type = txn?.type || "transaction";
  const description = txn?.description || `#${txn?.id || ""}`;

  return `${type.toUpperCase()} • $${amount} • ${description}`;
}

function getCategoryBadgeStyle(category) {
  switch ((category || "").toLowerCase()) {
    case "vat":
      return { backgroundColor: "#ede9fe", color: "#7c3aed" };
    case "invoice":
      return { backgroundColor: "#dcfce7", color: "#15803d" };
    case "receipt":
      return { backgroundColor: "#fef3c7", color: "#b45309" };
    case "contract":
      return { backgroundColor: "#ffedd5", color: "#c2410c" };
    case "report":
      return { backgroundColor: "#f3e8ff", color: "#7e22ce" };
    default:
      return { backgroundColor: "#dbeafe", color: "#1d4ed8" };
  }
}

function getFileIconLabel(filename = "") {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".pdf")) return "PDF";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "DOC";
  if (
    lower.endsWith(".xls") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".csv")
  ) {
    return "XLS";
  }
  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png")
  ) {
    return "IMG";
  }
  return "FILE";
}

export default function DocumentsScreen({ pageOptions = {} }) {
  const { selectedCompany, companyReady } = useCompany();

  const [documents, setDocuments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("list");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pageOptions?.focus === "unlinked") {
      setSearch("unlinked");
      setSelectedCategory("All");
      setSortBy("newest");
      setViewMode("list");
    }
  }, [pageOptions]);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [linkingId, setLinkingId] = useState(null);
  const [userRole, setUserRole] = useState("admin");

  // minimum document linking UI
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [auditReadiness, setAuditReadiness] = useState(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState("");
  const [autoOpenedUnlinked, setAutoOpenedUnlinked] = useState(false);

  const filteredDocuments = useMemo(() => {
    let result = [...documents];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((doc) => {
        const linkedStatus = doc.transaction_id ? "linked" : "unlinked";

        return [
          doc.original_name,
          doc.file_name,
          doc.category,
          doc.status,
          linkedStatus,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      });
    }

    if (selectedCategory !== "All") {
      result = result.filter((doc) => doc.category === selectedCategory);
    }

    result.sort((a, b) => {
      if (sortBy === "oldest") {
        return new Date(a.created_at) - new Date(b.created_at);
      }

      if (sortBy === "name") {
        const aName = a.original_name || a.file_name || "";
        const bName = b.original_name || b.file_name || "";
        return aName.localeCompare(bName);
      }

      return new Date(b.created_at) - new Date(a.created_at);
    });

    return result;
  }, [documents, search, selectedCategory, sortBy]);

  const summary = useMemo(() => {
    return {
      total: documents.length,
      vat: documents.filter((d) => d.category === "VAT").length,
      invoices: documents.filter((d) => d.category === "Invoice").length,
      reports: documents.filter((d) => d.category === "Report").length,
    };
  }, [documents]);

  const canEditDocuments = ["admin", "staff"].includes(userRole);
  const canDeleteDocuments = userRole === "admin";

  const fetchDocuments = async () => {
    try {
      if (!selectedCompany?.id) {
        setDocuments([]);
        return;
      }

      setLoading(true);

      const token = getToken();

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");
        return;
      }

      const response = await fetch(
        `${API_BASE}/documents/company/${selectedCompany.id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const contentType = response.headers.get("content-type");

      if (!contentType || !contentType.includes("application/json")) {
        const rawText = await response.text();
        console.error("fetchDocuments expected JSON but received:", rawText);
        throw new Error("Documents API did not return JSON.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch documents");
      }

      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("fetchDocuments error:", error);
      Alert.alert("Error", error.message || "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const token = getToken();

      if (!token || !selectedCompany?.id) return;

      const response = await fetch(
        `${API_BASE}/transactions/company/${selectedCompany.id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = response;

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch transactions");
      }

      setTransactions(Array.isArray(data) ? data : data.transactions || []);
    } catch (error) {
      console.error("fetchTransactions error:", error);
    }
  };
  const fetchAuditReadiness = async () => {
    if (!selectedCompany?.id) return;

    try {
      const token = getToken();   // ✅ ADD THIS LINE

      if (!token) return;

      const response = await fetch(
        `${API_BASE}/documents/company/${selectedCompany.id}/audit-readiness`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = response;

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch audit readiness");
      }

      setAuditReadiness(data);
    } catch (error) {
      console.error("fetchAuditReadiness error:", error);
      setAuditReadiness(null);
    }
  };

  useEffect(() => {
    if (!companyReady) return;

    // ✅ stop any previous loading immediately
    setLoading(false);

    // ✅ clear ALL state
    setDocuments([]);
    setTransactions([]);
    setAuditReadiness(null);
    setSelectedDocument(null);
    setSelectedTransactionId("");
    setShowLinkModal(false);
    setSelectedFile(null);
    setAutoOpenedUnlinked(false);

    // 🔥 Reset UI state (CRITICAL)
    setSearch("");
    setSelectedCategory("All");
    setSortBy("newest");
    setViewMode("list");

    setUploading(false);
    setDeletingId(null);
    setLinkingId(null);

    if (!selectedCompany?.id) {
      return;
    }

    // ✅ start fresh loading for new company
    setLoading(true);

    fetchDocuments();
    fetchTransactions();
    fetchAuditReadiness();
  }, [companyReady, selectedCompany?.id]);

  const openLinkModal = (document) => {
    if (!document?.id) return;

    if (!selectedCompany?.id || Number(document.company_id) !== Number(selectedCompany.id)) {
      Alert.alert("Invalid state", "Please refresh and try again.");
      return;
    }

    setSelectedDocument(document || null);
    setSelectedTransactionId(
      document?.transaction_id != null
        ? String(document.transaction_id)
        : ""
    );
    setShowLinkModal(true);
  };

  useEffect(() => {
    if (pageOptions?.focus !== "unlinked") return;
    if (autoOpenedUnlinked) return;
    if (loading) return;
    if (!filteredDocuments.length) return;

    const firstUnlinked = filteredDocuments.find((doc) => !doc.transaction_id);

    if (!firstUnlinked) return;

    setAutoOpenedUnlinked(true);
    openLinkModal(firstUnlinked);
  }, [pageOptions, autoOpenedUnlinked, loading, filteredDocuments]);

  const handleLinkDocument = async () => {
    try {
      if (!selectedDocument?.id) {
        Alert.alert("Missing document", "Please choose a document again.");
        return;
      }
      if (
        !selectedCompany?.id ||
        Number(selectedDocument.company_id) !== Number(selectedCompany.id)
      ) {
        Alert.alert("Invalid state", "Please reopen the link dialog.");
        return;
      }

      if (
        selectedTransactionId === "" ||
        selectedTransactionId === null ||
        selectedTransactionId === undefined
      ) {
        Alert.alert("Missing transaction", "Please select a transaction.");
        return;
      }

      const token = getToken();

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");
        return;
      }

      const numericTransactionId = Number(selectedTransactionId);

      if (!Number.isFinite(numericTransactionId) || numericTransactionId <= 0) {
        Alert.alert("Invalid transaction", "Please select a valid transaction.");
        return;
      }

      setLinkingId(selectedDocument.id);

      const response = await fetch(
        `${API_BASE}/documents/${selectedDocument.id}/link-transaction`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            transactionId: numericTransactionId,
          }),
        }
      );

      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to link document");
      }

      Alert.alert("Success", "Document linked successfully.");

      setShowLinkModal(false);
      setSelectedDocument(null);
      setSelectedTransactionId("");
      fetchDocuments();
      fetchAuditReadiness();
    } catch (error) {
      console.error("handleLinkDocument error:", error);
      Alert.alert("Error", error.message || "Could not link document.");
    } finally {
      setLinkingId(null);
    }
  };
  const handleUnlinkDocument = async (documentId) => {
    try {
      const token = getToken();

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");
        return;
      }

      setLinkingId(documentId);

      const response = await fetch(
        `${API_BASE}/documents/${documentId}/unlink-transaction`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = response;

      if (!response.ok) {
        throw new Error(data.error || "Failed to unlink document");
      }

      Alert.alert("Success", "Document unlinked successfully.");
      fetchDocuments();
      fetchAuditReadiness();
    } catch (error) {
      console.error("handleUnlinkDocument error:", error);
      Alert.alert("Error", error.message || "Could not unlink document.");
    } finally {
      setLinkingId(null);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];
      if (!file) return;

      setSelectedFile(file);
    } catch (error) {
      console.error("pickDocument error:", error);
      Alert.alert("Error", "Failed to pick document.");
    }
  };

  const handleUploadDocument = async () => {
    try {
      if (!selectedCompany?.id) {
        Alert.alert("Missing Company", "Please select a company first.");
        return;
      }

      if (!selectedFile) {
        Alert.alert("No File", "Please select a file first.");
        return;
      }

      setUploading(true);

      const token = getToken();

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");
        return;
      }

      const formData = new FormData();

      if (selectedFile.file) {
        formData.append("file", selectedFile.file);
      } else {
        formData.append("file", {
          uri: selectedFile.uri,
          name: selectedFile.name || "document",
          type:
            selectedFile.mimeType ||
            selectedFile.type ||
            "application/octet-stream",
        });
      }

      formData.append("companyId", selectedCompany.id);
      formData.append("category", inferCategory(selectedFile.name || ""));
      formData.append("status", "Active");

      const response = await fetch(`${API_BASE}/documents/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = response;

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      Alert.alert("Success", "Document uploaded successfully.");

      setSelectedFile(null);
      fetchDocuments();
      fetchAuditReadiness();
    } catch (error) {
      console.error("handleUploadDocument error:", error);
      Alert.alert("Upload Failed", error.message || "Could not upload document.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    try {
      const token = getToken();

      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");
        return;
      }

      setDeletingId(documentId);

      const response = await fetch(`${API_BASE}/documents/${documentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response;

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete document");
      }

      Alert.alert("Deleted", "Document deleted successfully.");

      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      fetchAuditReadiness();
    } catch (error) {
      console.error("handleDeleteDocument error:", error);
      Alert.alert("Delete Failed", error.message || "Could not delete document.");
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (documentId) => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Are you sure you want to delete this document?"
      );

      if (confirmed) {
        handleDeleteDocument(documentId);
      }

      return;
    }

    Alert.alert(
      "Delete Document",
      "Are you sure you want to delete this document?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDeleteDocument(documentId),
        },
      ]
    );
  };

  const handleOpenDocument = async (filePath) => {
    try {
      const url = buildFileUrl(filePath);

      if (!url) {
        Alert.alert("Error", "Invalid file path.");
        return;
      }

      if (Platform.OS === "web") {
        window.open(url, "_blank");
        return;
      }

      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert("Error", "Cannot open this document.");
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error("handleOpenDocument error:", error);
      Alert.alert("Error", "Failed to open document.");
    }
  };

  if (companyReady && !selectedCompany?.id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No company selected.</Text>
      </View>
    );
  }

  const handleOpenLinkedTransaction = (doc) => {
    if (!doc?.transaction_id) return;

    if (typeof window !== "undefined") {
      const url = `/dashboard?transactionId=${doc.transaction_id}&view=transactions`;
      window.location.href = url;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.shell}>
        <View style={styles.leftRail}>
          <View style={styles.logoTile}>
            <Text style={styles.logoTileText}>MD</Text>
          </View>

          <Text style={styles.leftRailTitle}>DOCUMENTS</Text>

          <TouchableOpacity
            style={[styles.sideNavItem, styles.sideNavItemActive]}
          >
            <Text style={[styles.sideNavText, styles.sideNavTextActive]}>
              All Documents
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sideNavItem}>
            <Text style={styles.sideNavText}>VAT Documents</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sideNavItem}>
            <Text style={styles.sideNavText}>Invoices</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sideNavItem}>
            <Text style={styles.sideNavText}>Receipts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sideNavItem}>
            <Text style={styles.sideNavText}>Contracts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sideNavItem}>
            <Text style={styles.sideNavText}>Reports</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sideNavItem}>
            <Text style={styles.sideNavText}>Other</Text>
          </TouchableOpacity>

          <View style={styles.storageCard}>
            <Text style={styles.storageCardText}>
              YOU ARE USING 4.5GB / 140GB
            </Text>
          </View>
        </View>

        <View style={styles.mainPanel}>
          <View style={styles.topBar}>
            <View style={styles.searchWrap}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search documents..."
                style={styles.searchInputModern}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.uploadPrimary,
                !selectedCompany?.id && styles.buttonDisabled,
              ]}
              onPress={pickDocument}
              disabled={!selectedCompany?.id}
            >
              <Text style={styles.uploadPrimaryText}>
                {selectedFile ? "FILE SELECTED" : "UPLOAD A NEW FILE"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.uploadPrimary,
                (uploading || !selectedCompany?.id) && styles.buttonDisabled,
              ]}
              onPress={handleUploadDocument}
              disabled={uploading || !selectedCompany?.id}
            >
              <Text style={styles.uploadPrimaryText}>
                {uploading ? "UPLOADING..." : "UPLOAD"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.pageTitle}>YOUR DOCUMENTS</Text>

          {auditReadiness !== null && auditReadiness !== undefined && typeof auditReadiness === "object" && (
            <View style={styles.auditCard}>
              <View style={styles.auditHeaderRow}>
                <Text style={styles.auditTitle}>Audit Readiness</Text>

                <View
                  style={[
                    styles.auditBadge,
                    auditReadiness.auditColor === "green" && styles.auditGreen,
                    auditReadiness.auditColor === "amber" && styles.auditAmber,
                    auditReadiness.auditColor === "red" && styles.auditRed,
                    auditReadiness.auditColor === "gray" && styles.auditGray,
                  ]}
                >
                  <Text style={styles.auditBadgeText}>
                    {auditReadiness.auditStatus}
                  </Text>
                </View>
              </View>

              <Text style={styles.auditScore}>{auditReadiness.auditScore}%</Text>

              <Text style={styles.auditSubtext}>
                {auditReadiness.linkedTransactions} of{" "}
                {auditReadiness.totalTransactions} transactions have supporting documents.
              </Text>

              <View style={styles.auditStatsRow}>
                <View style={styles.auditStatBox}>
                  <Text style={styles.auditStatNumber}>
                    {auditReadiness.unlinkedTransactions}
                  </Text>
                  <Text style={styles.auditStatLabel}>Unlinked Transactions</Text>
                </View>

                <View style={styles.auditStatBox}>
                  <Text style={styles.auditStatNumber}>
                    {auditReadiness.unlinkedDocuments}
                  </Text>
                  <Text style={styles.auditStatLabel}>Unlinked Documents</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.summaryGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricNumber}>{summary.total}</Text>
              <Text style={styles.metricLabel}>Total Documents</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricNumber}>{summary.vat}</Text>
              <Text style={styles.metricLabel}>VAT Documents</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricNumber}>{summary.invoices}</Text>
              <Text style={styles.metricLabel}>Invoices</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricNumber}>{summary.reports}</Text>
              <Text style={styles.metricLabel}>Reports</Text>
            </View>
          </View>

          <View style={styles.tabRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.tabInner}>
                {CATEGORY_OPTIONS.map((category) => {
                  const active = selectedCategory === category;

                  return (
                    <TouchableOpacity
                      key={category}
                      style={[styles.tabPill, active && styles.tabPillActive]}
                      onPress={() => setSelectedCategory(category)}
                    >
                      <Text
                        style={[
                          styles.tabPillText,
                          active && styles.tabPillTextActive,
                        ]}
                      >
                        {category.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.tabActions}>
              <TouchableOpacity
                style={styles.sortButton}
                onPress={() =>
                  setSortBy((prev) =>
                    prev === "newest"
                      ? "oldest"
                      : prev === "oldest"
                        ? "name"
                        : "newest"
                  )
                }
              >
                <Text style={styles.sortButtonText}>
                  SORT BY: {sortBy.toUpperCase()}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.viewModeButton}
                onPress={() =>
                  setViewMode((prev) => (prev === "list" ? "grid" : "list"))
                }
              >
                <Text style={styles.viewModeText}>
                  {viewMode === "list" ? "LIST" : "GRID"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={styles.listScrollContent}
          >
            <View style={styles.listCard}>
              <View style={styles.listHeader}>
                <Text style={[styles.listHeaderText, styles.colDocument]}>
                  DOCUMENT
                </Text>
                <Text style={[styles.listHeaderText, styles.colCategory]}>
                  CATEGORY
                </Text>
                <Text style={[styles.listHeaderText, styles.colSize]}>SIZE</Text>
                <Text style={[styles.listHeaderText, styles.colUploaded]}>
                  UPLOADED
                </Text>
                <Text style={[styles.listHeaderText, styles.colActions]}>
                  ACTIONS
                </Text>
              </View>

              {loading ? (
                <View style={styles.centeredTable}>
                  <ActivityIndicator size="small" />
                  <Text style={styles.loadingText}>Loading documents...</Text>
                </View>
              ) : filteredDocuments.length === 0 ? (
                <View style={styles.centeredTable}>
                  <Text style={styles.emptyText}>No documents found.</Text>
                </View>
              ) : (
                filteredDocuments.map((doc) => {
                  const badge = getCategoryBadgeStyle(doc.category);
                  const fileLabel = getFileIconLabel(
                    doc.original_name || doc.file_name || ""
                  );

                  return (
                    <View
                      key={doc.id}
                      style={[
                        styles.documentRowModern,
                        !doc.transaction_id &&
                        pageOptions?.focus === "unlinked" &&
                        styles.unlinkedFocusRow,
                      ]}
                    >
                      <View style={styles.colDocument}>
                        <View style={styles.fileInfoWrap}>
                          <View style={styles.fileIconBox}>
                            <Text style={styles.fileIconText}>{fileLabel}</Text>
                          </View>

                          <View style={styles.fileTextBlock}>
                            <Text
                              style={styles.documentNameModern}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {doc.original_name || doc.file_name}
                            </Text>

                            {doc.transaction_id ? (
                              <TouchableOpacity onPress={() => handleOpenLinkedTransaction(doc)}>
                                <Text
                                  style={[
                                    styles.documentMetaModern,
                                    styles.linkedMetaText,
                                    styles.linkedTransactionLink,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {formatLinkedTransaction(doc)}
                                </Text>
                              </TouchableOpacity>
                            ) : (
                              <Text style={[styles.documentMetaModern, styles.unlinkedMetaText]}>
                                Unlinked
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>

                      <View style={styles.colCategory}>
                        <View
                          style={[
                            styles.categoryBadgeModern,
                            { backgroundColor: badge.backgroundColor },
                          ]}
                        >
                          <Text
                            style={[
                              styles.categoryBadgeTextModern,
                              { color: badge.color },
                            ]}
                          >
                            {doc.category || "General"}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.rowCellText, styles.colSize]}>
                        {formatFileSize(doc.file_size)}
                      </Text>

                      <Text style={[styles.rowCellText, styles.colUploaded]}>
                        {formatDate(doc.created_at)}
                      </Text>

                      <View style={styles.colActions}>
                        <TouchableOpacity
                          style={styles.actionOpenButton}
                          onPress={() => handleOpenDocument(doc.file_path)}
                        >
                          <Text style={styles.actionOpenButtonText}>Open</Text>
                        </TouchableOpacity>

                        {canEditDocuments ? (
                          <TouchableOpacity
                            style={[
                              styles.rowLinkButton,
                              linkingId === doc.id && styles.buttonDisabled,
                            ]}
                            onPress={() => openLinkModal(doc)}
                            disabled={linkingId === doc.id}
                          >
                            <Text style={styles.rowLinkButtonText}>
                              {doc.transaction_id ? "Change Link" : "Link"}
                            </Text>
                          </TouchableOpacity>
                        ) : null}

                        {canEditDocuments && doc.transaction_id ? (
                          <TouchableOpacity
                            style={[
                              styles.rowUnlinkButton,
                              linkingId === doc.id && styles.buttonDisabled,
                            ]}
                            onPress={() => handleUnlinkDocument(doc.id)}
                            disabled={linkingId === doc.id}
                          >
                            <Text style={styles.rowUnlinkButtonText}>
                              {linkingId === doc.id ? "..." : "Unlink"}
                            </Text>
                          </TouchableOpacity>
                        ) : null}

                        {canDeleteDocuments ? (
                          <TouchableOpacity
                            style={[
                              styles.rowDeleteButton,
                              deletingId === doc.id && styles.buttonDisabled,
                            ]}
                            onPress={() => confirmDelete(doc.id)}
                            disabled={deletingId === doc.id}
                          >
                            <Text style={styles.rowDeleteButtonText}>
                              {deletingId === doc.id ? "..." : "Delete"}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>

          <View style={styles.footerBar}>
            <Text style={styles.footerText}>
              Showing 1 to {Math.min(filteredDocuments.length, 6)} of{" "}
              {filteredDocuments.length} documents
            </Text>

            <View style={styles.paginationWrap}>
              <TouchableOpacity style={styles.pageButton}>
                <Text style={styles.pageButtonText}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pageButton, styles.pageButtonActive]}
              >
                <Text
                  style={[styles.pageButtonText, styles.pageButtonTextActive]}
                >
                  1
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pageButton}>
                <Text style={styles.pageButtonText}>2</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pageButton}>
                <Text style={styles.pageButtonText}>3</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <Modal
        visible={showLinkModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLinkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Link Document to Transaction</Text>

            {selectedDocument ? (
              <Text style={styles.modalSubtext} numberOfLines={1}>
                {selectedDocument.file_name}
              </Text>
            ) : null}

            <Text style={styles.modalLabel}>Select Transaction</Text>

            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedTransactionId}
                onValueChange={(value) => {
                  console.log("Selected transaction:", value);
                  setSelectedTransactionId(value ? String(value) : "");
                }}
              >
                <Picker.Item label="Choose a transaction..." value="" />
                {transactions.map((txn) => (
                  <Picker.Item
                    key={txn.id}
                    label={formatTransactionLabel(txn)}
                    value={String(txn.id)}
                  />
                ))}
              </Picker>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowLinkModal(false);
                  setSelectedDocument(null);
                  setSelectedTransactionId("");
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  (
                    selectedTransactionId === "" ||
                    !!linkingId ||
                    !selectedDocument
                  ) && styles.buttonDisabled,
                ]}
                onPress={handleLinkDocument}
                disabled={
                  !!linkingId ||
                  selectedTransactionId === "" ||
                  !selectedDocument
                }
              >
                <Text style={styles.modalConfirmText}>
                  {linkingId ? "Saving..." : "Save Link"}
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
    padding: 16,
    backgroundColor: "#0f46ea",
    minHeight: "100%",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centeredTable: {
    paddingVertical: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  shell: {
    backgroundColor: "#f8f8f9",
    borderRadius: 14,
    overflow: "hidden",
    flexDirection: "row",
    minHeight: 720,
  },
  leftRail: {
    width: 190,
    backgroundColor: "#f3f3f4",
    padding: 16,
    borderRightWidth: 1,
    borderRightColor: "#e7e7ea",
  },
  logoTile: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#1640f2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  logoTileText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
  leftRailTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#151923",
    marginBottom: 14,
  },
  sideNavItem: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  sideNavItemActive: {
    backgroundColor: "#e5ebff",
  },
  sideNavText: {
    color: "#4f5b73",
    fontSize: 12,
    fontWeight: "600",
  },
  sideNavTextActive: {
    color: "#1540f2",
  },
  storageCard: {
    marginTop: "auto",
    backgroundColor: "#1640f2",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  storageCardText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },
  mainPanel: {
    flex: 1,
    padding: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  searchWrap: {
    flex: 1,
  },
  searchInputModern: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e7ea",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: "#1b2230",
  },
  uploadPrimary: {
    backgroundColor: "#1640f2",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadPrimaryText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 11,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#171c27",
    marginBottom: 14,
  },

  auditCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  auditHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  auditTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  auditBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },

  auditGreen: {
    backgroundColor: "#dcfce7",
  },

  auditAmber: {
    backgroundColor: "#fef3c7",
  },

  auditRed: {
    backgroundColor: "#fee2e2",
  },

  auditGray: {
    backgroundColor: "#e5e7eb",
  },

  auditBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },

  auditScore: {
    fontSize: 42,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },

  auditSubtext: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 14,
  },

  auditStatsRow: {
    flexDirection: "row",
    gap: 12,
  },

  auditStatBox: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
  },

  auditStatNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },

  auditStatLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e7ea",
    borderRadius: 10,
    padding: 12,
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: "#151923",
  },
  metricLabel: {
    marginTop: 4,
    color: "#647084",
    fontSize: 11,
    fontWeight: "600",
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  tabInner: {
    flexDirection: "row",
    gap: 6,
  },
  tabPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  tabPillActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#1640f2",
    borderRadius: 0,
  },
  tabPillText: {
    color: "#6a7387",
    fontSize: 11,
    fontWeight: "700",
  },
  tabPillTextActive: {
    color: "#1640f2",
  },
  tabActions: {
    flexDirection: "row",
    gap: 10,
  },
  sortButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d7dbe5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sortButtonText: {
    color: "#202633",
    fontWeight: "700",
    fontSize: 11,
  },
  viewModeButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d7dbe5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewModeText: {
    color: "#202633",
    fontWeight: "700",
    fontSize: 11,
  },
  listScrollContent: {
    minWidth: 1020,
  },
  listCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e7ea",
    borderRadius: 14,
    overflow: "hidden",
  },
  listHeader: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#ececf0",
  },
  listHeaderText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#666",
  },
  documentRowModern: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f1f4",
  },
  unlinkedFocusRow: {
    backgroundColor: "#FFF7ED",
    borderLeftWidth: 4,
    borderLeftColor: "#F97316",
  },

  colDocument: {
    width: 180,
    paddingRight: 8,
  },
  colCategory: {
    width: 85,
    paddingRight: 10,
  },
  colSize: {
    width: 65,
    paddingRight: 10,
  },
  colUploaded: {
    width: 90,
    paddingRight: 10,
  },
  colActions: {
    width: 240,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fileInfoWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  fileIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#1640f2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  fileIconText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 9,
  },
  fileTextBlock: {
    flexShrink: 1,
    maxWidth: 140,
  },
  documentNameModern: {
    color: "#171c27",
    fontWeight: "600",
    fontSize: 10,
    marginBottom: 2,
  },
  documentMetaModern: {
    fontSize: 10,
    fontWeight: "600",
  },
  linkedMetaText: {
    color: "#18794e",
  },
  linkedTransactionLink: {
    textDecorationLine: "underline",
  },
  unlinkedMetaText: {
    color: "#c0362c",
  },
  categoryBadgeModern: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  categoryBadgeTextModern: {
    fontWeight: "700",
    fontSize: 10,
  },
  rowCellText: {
    color: "#1d2431",
    fontSize: 11,
    fontWeight: "500",
  },
  actionOpenButton: {
    backgroundColor: "#edf1f7",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  actionOpenButtonText: {
    color: "#22304a",
    fontWeight: "700",
    fontSize: 8,
  },
  rowLinkButton: {
    backgroundColor: "#132f87",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLinkButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 10,
  },
  rowUnlinkButton: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowUnlinkButtonText: {
    color: "#374151",
    fontWeight: "800",
    fontSize: 10,
  },
  rowDeleteButton: {
    backgroundColor: "#ff2f2f",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowDeleteButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 10,
  },
  footerBar: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    color: "#6a7387",
    fontSize: 14,
    fontWeight: "500",
  },
  paginationWrap: {
    flexDirection: "row",
    gap: 8,
  },
  pageButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dfe3ea",
    justifyContent: "center",
    alignItems: "center",
  },
  pageButtonActive: {
    backgroundColor: "#1640f2",
    borderColor: "#1640f2",
  },
  pageButtonText: {
    color: "#1f2633",
    fontWeight: "700",
  },
  pageButtonTextActive: {
    color: "#fff",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingText: {
    marginTop: 10,
    color: "#64748b",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#13294b",
    marginBottom: 8,
  },
  modalSubtext: {
    fontSize: 12,
    color: "#647084",
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4b5b73",
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d8dfeb",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancelButton: {
    backgroundColor: "#eef2f7",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalCancelText: {
    color: "#4b5b73",
    fontWeight: "700",
  },
  modalConfirmButton: {
    backgroundColor: "#13294b",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalConfirmText: {
    color: "#fff",
    fontWeight: "700",
  },
});