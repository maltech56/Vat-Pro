import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCompany } from "../context/CompanyContext";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { getToken } from "../src/utils/session";
import { formatCurrency } from "../src/utils/formatters";
import {
  pickImportDocument,
  parseImportedAsset,
} from "../src/utils/importParsers";

const API_BASE = "https://vat-pro-backend.onrender.com/api";

const fetchWithTimeout = async (url, options = {}, timeout = 15000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

export default function ImportsScreen() {
  const { selectedCompany, companyReady } = useCompany();

  const scrollRef = useRef(null);
  const [batchDetailsY, setBatchDetailsY] = useState(0);

  const [parsedRows, setParsedRows] = useState([]);
  const [columns, setColumns] = useState([]);

  const [selectedSource, setSelectedSource] = useState("CSV");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [reviewRows, setReviewRows] = useState([]);
  const [previewBatchId, setPreviewBatchId] = useState(null);
  const [rawRowCount, setRawRowCount] = useState(0);
  const [importMessage, setImportMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocrWarnings, setOcrWarnings] = useState([]);
  const [ocrRequiresReview, setOcrRequiresReview] = useState(false);
  const [ocrLowConfidenceRows, setOcrLowConfidenceRows] = useState(0);
  const [ocrReviewed, setOcrReviewed] = useState(false);

  const [importHistory, setImportHistory] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedBatchItems, setSelectedBatchItems] = useState([]);
  const [lastImportBatch, setLastImportBatch] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [undoingBatchId, setUndoingBatchId] = useState(null);

  const [columnMapping, setColumnMapping] = useState({
    amount: "",
    transactionDate: "",
    description: "",
    classification: "",
    type: "",
  });

  const [templates, setTemplates] = useState([]);
  const [matchedTemplate, setMatchedTemplate] = useState(null);
  const [matchedTemplateScore, setMatchedTemplateScore] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [autoImporting, setAutoImporting] = useState(false);

  useEffect(() => {
    if (!companyReady) return;

    // ✅ CLEAR EVERYTHING
    setParsedRows([]);
    setColumns([]);
    setReviewRows([]);
    setPreviewBatchId(null);
    setSelectedFile(null);
    setImportMessage("");
    setOcrWarnings([]);
    setOcrRequiresReview(false);
    setOcrLowConfidenceRows(0);
    setOcrReviewed(false);
    setTemplates([]);
    setMatchedTemplate(null);
    setMatchedTemplateScore(null);
    setImportHistory([]);
    setSelectedBatch(null);
    setSelectedBatchItems([]);
    setLastImportBatch(null);

    if (!selectedCompany?.id) {
      setLoading(false);
      return;
    }

    // ✅ RELOAD DATA
    fetchTemplates();
    fetchImportHistory();
  }, [companyReady, selectedCompany?.id, selectedSource]);

  useEffect(() => {
    setSelectedTemplateId("");
    setMatchedTemplate(null);
    setMatchedTemplateScore(null);
  }, [selectedCompany?.id, selectedSource]);

  useEffect(() => {
    if (!selectedCompany?.id) return;
    fetchImportHistory();
  }, [selectedCompany?.id]);

  useEffect(() => {
    if (!selectedBatch && selectedBatchItems.length === 0) return;
    if (!batchDetailsY) return;

    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(batchDetailsY - 20, 0),
        animated: true,
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [selectedBatch, selectedBatchItems, batchDetailsY]);

  const getAuthToken = () => {
    const token = getToken();
    return token || null;
  };

  const getAuthHeaders = (includeJson = false) => {
    const token = getAuthToken();
    const headers = {};

    if (includeJson) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  };

  const fetchTemplates = async () => {
    try {
      const token = getAuthToken();
      if (!token || !selectedCompany?.id) return;

      const sourceType = encodeURIComponent(selectedSource);

      const candidateUrls = [
        `${API_BASE}/import-templates?companyId=${selectedCompany.id}&sourceType=${sourceType}`,
        `${API_BASE}/import-templates/company/${selectedCompany.id}?sourceType=${sourceType}`,
      ];

      let resolved = null;
      let lastError = null;

      for (const url of candidateUrls) {
        try {
          const response = await fetch(url, {
            headers: getAuthHeaders(),
          });

          const data = await response.json().catch(() => []);

          if (!response.ok) {
            lastError = new Error(data?.error || "Failed to load templates");
            continue;
          }

          resolved = Array.isArray(data) ? data : [];
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!resolved) {
        throw lastError || new Error("Failed to load templates");
      }

      setTemplates(resolved);
    } catch (error) {
      console.error("fetchTemplates error:", error);
      setTemplates([]);
    }
  };

  const fetchImportHistory = async () => {
    try {
      const token = getAuthToken();
      if (!token || !selectedCompany?.id) return;

      setHistoryLoading(true);

      const response = await fetch(
        `${API_BASE}/import-batches/company/${selectedCompany.id}`,
        {
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load import history");
      }

      const history = Array.isArray(data) ? data : [];
      setImportHistory(history);

      if (lastImportBatch?.id) {
        const refreshedSelected = history.find(
          (item) => String(item.id) === String(lastImportBatch.id)
        );

        if (refreshedSelected) {
          setLastImportBatch(refreshedSelected);
        }
      }
    } catch (error) {
      console.error("fetchImportHistory error:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadBatchDetails = async (batchId) => {
    try {
      const token = getToken();

      const response = await fetch(
        `${API_BASE}/import-batches/${batchId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch batch details");
      }

      const data = await response.json();


      setSelectedBatch(data.batch);
      setSelectedBatchItems(data.items);

    } catch (error) {
      console.error("loadBatchDetails error:", error);
    }
  };

  const handleUndoBatch = async (batchId) => {
    try {
      const token = getAuthToken();

      if (!token) {
        Alert.alert("Authentication Error", "Please log in again.");
        return;
      }

      setUndoingBatchId(batchId);

      const response = await fetch(
        `${API_BASE}/import-batches/${batchId}/undo`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Undo failed");
      }

      await fetchImportHistory();

    } catch (error) {
      Alert.alert("Undo Error", error.message || "Failed to undo batch.");
    } finally {
      setUndoingBatchId(null);
    }
  };

  const saveTemplateToBackend = async ({ name, makeDefault = false }) => {
    try {
      const token = getAuthToken();

      if (!token) {
        Alert.alert("Authentication Error", "Please log in again.");
        return;
      }

      if (!selectedCompany?.id) {
        Alert.alert("No Company", "Please select a company first.");
        return;
      }

      if (!name.trim()) {
        Alert.alert("Template Name", "Please enter a template name.");
        return;
      }

      const response = await fetch(`${API_BASE}/import-templates`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          companyId: selectedCompany.id,
          sourceType: selectedSource,
          templateName: name.trim(),
          mapping: columnMapping,
          columnSignature: columns,
          isDefault: makeDefault,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save template");
      }

      Alert.alert("Saved", "Import template saved successfully.");
      setTemplateName("");
      setSelectedTemplateId(String(data.id || ""));
      await fetchTemplates();
    } catch (error) {
      Alert.alert("Save Error", error.message || "Failed to save template.");
    }
  };

  const detectTemplateForColumns = async (detectedColumns) => {
    try {
      const token = getAuthToken();
      if (!token || !selectedCompany?.id || !detectedColumns?.length) return null;

      const response = await fetch(`${API_BASE}/import-templates/detect`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          companyId: selectedCompany.id,
          sourceType: selectedSource,
          columns: detectedColumns,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Template detection failed");
      }

      if (data?.matched && data?.template) {
        return data.template;
      }

      return null;
    } catch (error) {
      console.error("detectTemplateForColumns error:", error);
      return null;
    }
  };

  const applyTemplateMapping = (template) => {
    if (!template?.mapping) return;

    setMatchedTemplate(template);
    setMatchedTemplateScore(
      typeof template.score === "number" ? template.score : null
    );
    setSelectedTemplateId(String(template.id || ""));

    setColumnMapping({
      amount: template.mapping.amount || "",
      transactionDate: template.mapping.transactionDate || "",
      description: template.mapping.description || "",
      classification: template.mapping.classification || "",
      type: template.mapping.type || "",
    });
  };

  const handleApplySelectedTemplate = () => {
    if (!selectedTemplateId) {
      Alert.alert("No Template", "Please select a template first.");
      return;
    }

    const template = templates.find(
      (item) => String(item.id) === String(selectedTemplateId)
    );

    if (!template) {
      Alert.alert("Template Not Found");
      return;
    }

    applyTemplateMapping(template);
    Alert.alert("Template Applied", template.template_name);
  };

  const handleDeleteSelectedTemplate = async () => {
    try {
      const token = getAuthToken();

      if (!token) {
        Alert.alert("Authentication Error", "Please log in again.");
        return;
      }

      if (!selectedTemplateId) {
        Alert.alert("No Template Selected");
        return;
      }

      const response = await fetch(
        `${API_BASE}/import-templates/${selectedTemplateId}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Delete failed");
      }

      Alert.alert("Deleted", "Template removed successfully.");
      setSelectedTemplateId("");
      setMatchedTemplate(null);
      setMatchedTemplateScore(null);
      await fetchTemplates();
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to delete template.");
    }
  };

  const normalizeType = (value) => {
    const lower = String(value || "").trim().toLowerCase();

    if (["sale", "sales", "income", "revenue"].includes(lower)) return "sale";
    if (["expense", "purchase", "purchases", "cost"].includes(lower)) {
      return "expense";
    }

    return "sale";
  };

  const normalizeClassification = (value) => {
    const lower = String(value || "").trim().toLowerCase();

    if (["taxable", "standard", "standard rated"].includes(lower)) {
      return "taxable";
    }
    if (["zero", "zero rated", "zero_rated", "zero-rated"].includes(lower)) {
      return "zero_rated";
    }
    if (["exempt"].includes(lower)) return "exempt";

    return "taxable";
  };
  const normalizeMoney = (value) => {
    if (value === null || value === undefined || value === "") return null;

    const cleaned = String(value)
      .replace(/,/g, "")
      .replace(/BSD/gi, "")
      .replace(/\$/g, "")
      .trim();

    const number = Number(cleaned);

    return Number.isNaN(number) ? null : number;
  };

  const normalizeDate = (value) => {
    if (value === null || value === undefined || value === "") return "";

    // Handle Excel serial dates like 46113
    if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value).trim())) {
      const numericValue = Number(value);

      if (!Number.isNaN(numericValue) && numericValue > 0) {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const jsDate = new Date(excelEpoch.getTime() + numericValue * 86400000);

        const year = jsDate.getUTCFullYear();
        const month = String(jsDate.getUTCMonth() + 1).padStart(2, "0");
        const day = String(jsDate.getUTCDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
      }
    }

    // Handle already formatted ISO dates
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    // Handle normal date strings
    const jsDate = new Date(raw);
    if (Number.isNaN(jsDate.getTime())) return "";

    const year = jsDate.getFullYear();
    const month = String(jsDate.getMonth() + 1).padStart(2, "0");
    const day = String(jsDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const submitRowsDirectly = async (rowsToSubmit) => {
    const token = getAuthToken();

    if (!token) {
      throw new Error("Please log in again.");
    }

    if (!selectedCompany?.id) {
      throw new Error("Please select a company.");
    }

    const promises = rowsToSubmit.map(async (row, index) => {
      const amountExVat = normalizeMoney(row.amount);

      if (amountExVat === null || Number.isNaN(amountExVat)) {
        return {
          ok: false,
          rowIndex: index,
          error: "Invalid amount",
        };
      }

      const payload = {
        companyId: selectedCompany.id,
        type: row.type,
        amountExVat,
        vatAmount: Number(row.vatAmount || 0),
        classification: row.classification,
        transactionDate: row.transactionDate,
        description: row.description,
      };

      console.log("FINAL PAYLOAD SENT:", payload);
      try {
        console.log("IMPORT PAYLOAD:", payload);

        const response = await fetchWithTimeout(
          `${API_BASE}/transactions`,
          {
            method: "POST",
            headers: getAuthHeaders(true),
            body: JSON.stringify(payload),
          },
          15000
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          return {
            ok: false,
            rowIndex: index,
            description: row.description,
            amount: row.amount,
            transactionDate: row.transactionDate,
            type: row.type,
            classification: row.classification,
            error:
              data?.error ||
              data?.message ||
              `Transaction import failed with status ${response.status}`,
          };
        }

        return {
          ok: true,
          rowIndex: index,
          transactionId: data?.transaction?.id || data?.id || null,
          description: row.description,
          amount: row.amount,
          transactionDate: row.transactionDate,
          type: row.type,
          classification: row.classification,
        };
      } catch (error) {
        let errorMessage = "Network error while importing row";

        if (error?.name === "AbortError") {
          errorMessage = "Request timed out while importing row";
        } else if (error?.message) {
          errorMessage = error.message;
        }

        return {
          ok: false,
          rowIndex: index,
          description: row.description,
          amount: row.amount,
          transactionDate: row.transactionDate,
          type: row.type,
          classification: row.classification,
          error: errorMessage,
        };
      }
    });

    return Promise.all(promises);
  };

  const saveImportBatch = async (results, template) => {
    const token = getAuthToken();

    if (!token) {
      throw new Error("Please log in again.");
    }

    const successRows = results.filter((item) => item.ok).length;
    const failedRows = results.filter((item) => !item.ok).length;

    const response = await fetch(`${API_BASE}/import-batches`, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        companyId: selectedCompany.id,
        sourceType: selectedSource,
        templateId: template?.id || null,
        fileName: selectedFile?.name || null,
        totalRows: results.length,
        successRows,
        failedRows,
        status: "imported",

        rows: results.map((item, index) => ({
          rowIndex: index,
          transactionId: item.transactionId || null,
          description: item.description || "",
          amount: item.amount ?? null,
          transactionDate: item.transactionDate || null,
          type: item.type || "sale",
          classification: item.classification || "taxable",
          status: item.ok ? "imported" : "failed",
          error: item.error || null,
        })),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.error ||
        data?.message ||
        `Failed to save import batch (status ${response.status})`
      );
    }

    return data;
  };

  const autoImportWithTemplate = async (template, sourceRows = parsedRows) => {
    try {

      if (!selectedCompany?.id) {
        Alert.alert("No Company", "Please select a company first.");
        return;
      }

      if (!template?.mapping) {
        Alert.alert("Template Error", "No template mapping was found.");
        return;
      }

      const mapping = template.mapping || {};

      if (!mapping.amount || !mapping.transactionDate || !mapping.description) {
        Alert.alert(
          "Template Incomplete",
          "This template must include Amount, Date, and Description."
        );
        return;
      }

      const mappedRows = (Array.isArray(sourceRows) ? sourceRows : []).map(
        (row, index) => {

          const amountRaw = row[mapping.amount];
          const amount = normalizeMoney(amountRaw);

          const transactionDate = normalizeDate(row[mapping.transactionDate]);
          const description = String(row[mapping.description] || "").trim();

          const type = mapping.type
            ? normalizeType(row[mapping.type])
            : "sale";

          const classification = mapping.classification
            ? normalizeClassification(row[mapping.classification])
            : "taxable";

          const vatAmount =
            classification === "taxable"
              ? Number((amount * 0.1).toFixed(2))
              : 0;

          const errors = [];
          if (amount === null || Number.isNaN(amount)) {
            errors.push("Missing amount");
          }
          if (!transactionDate) errors.push("Missing or invalid date");
          if (!description) errors.push("Missing description");

          return {
            id: `auto-${index + 1}`,
            selected: errors.length === 0,
            description,
            transactionDate,
            amount,
            vatAmount,
            type,
            classification,
            status: errors.length ? "Needs Review" : "Ready",
            errors,
            sourceRow: row,
          };
        }
      );

      setReviewRows(mappedRows);

      const readyRows = mappedRows.filter(
        (row) => row.selected && row.status === "Ready"
      );

      if (!readyRows.length) {
        Alert.alert(
          "No Ready Rows",
          "Template matched, but no valid rows were ready for auto import."
        );
        return;
      }

      const results = await submitRowsDirectly(readyRows);
      console.log("IMPORT RESULTS:", results);

      const savedBatch = await saveImportBatch(results, template);

      setLastImportBatch(savedBatch);
      setMatchedTemplate(template);
      setMatchedTemplateScore(
        typeof template.score === "number" ? template.score : null
      );

      await fetchImportHistory();

      const successCount = results.filter((item) => item.ok).length;
      const failCount = results.filter((item) => !item.ok).length;

      setImportMessage(
        `Auto import complete. Imported ${successCount} row(s)${failCount ? `, ${failCount} failed` : ""
        }.`
      );

      Alert.alert(
        "Auto Import Complete",
        `Imported ${successCount} row(s).${failCount ? ` ${failCount} failed.` : ""
        }`
      );

      setReviewRows((current) =>
        current.map((row, index) => {
          const matched = results.find(
            (r) => r.rowIndex === index && r.ok
          );

          return matched ? { ...row, selected: false, status: "Imported" } : row;
        })
      );
    } catch (error) {
      Alert.alert(
        "Auto Import Error",
        error.message || "Failed to complete auto import."
      );
    } finally {
      setAutoImporting(false);
    }
  };

  const getMappingStorageKey = () => {
    if (!selectedCompany?.id) return null;
    return `vatpro_import_mapping_${selectedCompany.id}_${selectedSource}`;
  };

  const saveMappingTemplate = () => {
    try {
      const key = getMappingStorageKey();
      if (!key) {
        Alert.alert("No Company", "Select a company first.");
        return;
      }

      if (typeof localStorage === "undefined") {
        Alert.alert("Unsupported", "Saved mapping is only available in web mode.");
        return;
      }

      localStorage.setItem(key, JSON.stringify(columnMapping));
      Alert.alert("Saved", "Mapping saved successfully.");
    } catch (error) {
      console.error("saveMappingTemplate error:", error);
      Alert.alert("Error", "Failed to save mapping.");
    }
  };

  const loadSavedMappingTemplate = () => {
    try {
      const key = getMappingStorageKey();
      if (!key || typeof localStorage === "undefined") return;

      const raw = localStorage.getItem(key);
      if (!raw) {
        Alert.alert("No Saved Mapping", "No saved mapping was found.");
        return;
      }

      const parsed = JSON.parse(raw);

      setColumnMapping({
        amount: parsed.amount || "",
        transactionDate: parsed.transactionDate || "",
        description: parsed.description || "",
        classification: parsed.classification || "",
        type: parsed.type || "",
      });

      Alert.alert("Loaded", "Saved mapping applied.");
    } catch (error) {
      console.error("loadSavedMappingTemplate error:", error);
    }
  };

  const clearSavedMappingTemplate = () => {
    try {
      const key = getMappingStorageKey();
      if (!key || typeof localStorage === "undefined") return;

      localStorage.removeItem(key);

      setColumnMapping({
        amount: "",
        transactionDate: "",
        description: "",
        classification: "",
        type: "",
      });

      Alert.alert("Cleared", "Saved mapping removed.");
    } catch (error) {
      console.error("clearSavedMappingTemplate error:", error);
    }
  };

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return reviewRows;

    return reviewRows.filter((row) => {
      return (
        String(row.description || "").toLowerCase().includes(query) ||
        String(row.type || "").toLowerCase().includes(query) ||
        String(row.classification || "").toLowerCase().includes(query) ||
        String(row.status || "").toLowerCase().includes(query)
      );
    });
  }, [reviewRows, searchTerm]);

  const summary = useMemo(() => {
    const readyRows = reviewRows.filter((row) => row.selected && !row.errors.length);

    const sales = readyRows.filter((row) => row.type === "sale");
    const expenses = readyRows.filter((row) => row.type === "expense");

    return {
      totalRows: reviewRows.length,
      readyRows: readyRows.length,
      readyRowsCount: readyRows.length,
      salesCount: sales.length,
      purchaseCount: expenses.length,
      grossAmount: readyRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      vatAmount: readyRows.reduce((sum, row) => sum + Number(row.vatAmount || 0), 0),
    };
  }, [reviewRows]);

  const readyRowsCount = summary.readyRowsCount || 0;
  const ocrImportLocked = selectedSource === "PDF" && ocrRequiresReview && !ocrReviewed;

  const importSources = [
    {
      key: "CSV",
      title: "CSV Import",
      subtitle: "Upload transaction data from CSV files",
    },
    {
      key: "Excel",
      title: "Excel Import",
      subtitle: "Import spreadsheet-based VAT records",
    },
    {
      key: "PDF",
      title: "PDF Import",
      subtitle: "Stage PDF files for OCR-based extraction",
    },
    {
      key: "QuickBooks",
      title: "QuickBooks",
      subtitle: "Connect accounting data in a future upgrade",
    },
  ];

  const handleSelectSource = (sourceKey) => {
    setSelectedSource(sourceKey);
  };

  const buildReviewRowsFromMapping = () => {
    if (!parsedRows.length) {
      Alert.alert("No Source Rows", "Open a file first.");
      return;
    }

    if (
      !columnMapping.amount ||
      !columnMapping.transactionDate ||
      !columnMapping.description
    ) {
      Alert.alert(
        "Missing Mapping",
        "Please map at least Amount, Date, and Description."
      );
      return;
    }

    const mappedRows = parsedRows.map((row, index) => {
      const amountRaw = row[columnMapping.amount];
      const amount = normalizeMoney(amountRaw);
      const transactionDate = normalizeDate(row[columnMapping.transactionDate]);
      const description = String(row[columnMapping.description] || "").trim();

      const type = columnMapping.type
        ? normalizeType(row[columnMapping.type])
        : "sale";

      const classification = columnMapping.classification
        ? normalizeClassification(row[columnMapping.classification])
        : "taxable";

      const vatAmount =
        classification === "taxable"
          ? Number((amount * 0.1).toFixed(2))
          : 0;

      const errors = [];
      if (amount === null || Number.isNaN(amount)) {
        errors.push("Missing amount");
      }
      if (!transactionDate) errors.push("Missing or invalid date");
      if (!description) errors.push("Missing description");

      return {
        id: `mapped-${index + 1}`,
        selected: errors.length === 0,
        description,
        transactionDate,
        amount,
        vatAmount,
        type,
        classification,
        status: errors.length ? "Needs Review" : "Ready",
        errors,
        sourceRow: row,
      };
    });

    setReviewRows(mappedRows);

    Alert.alert(
      "Mapping Applied",
      `${mappedRows.length} row(s) prepared for review.`
    );
  };

  const handleChooseFile = async () => {
    try {
      if (!selectedCompany?.id) {
        Alert.alert("No Company Selected", "Please select a company first.");
        return;
      }

      if (selectedSource === "QuickBooks") {
        Alert.alert(
          "QuickBooks",
          "QuickBooks integration should be added next as an OAuth/API workflow. This screen is ready for file-based imports now."
        );
        return;
      }

      setLoading(true);
      setImportMessage("");
      setMatchedTemplate(null);
      setMatchedTemplateScore(null);
      setReviewRows([]);
      setParsedRows([]);
      setColumns([]);
      setSelectedFile(null);
      setRawRowCount(0);
      setColumnMapping({
        amount: "",
        transactionDate: "",
        description: "",
        classification: "",
        type: "",
      });

      const asset = await pickImportDocument();
      if (!asset) {
        return;
      }

      setSelectedFile(asset);
      setMatchedTemplate(null);

      const token = getAuthToken();
      if (!token) {
        Alert.alert("Authentication Error", "Please log in again.");
        return;
      }

      const formData = new FormData();
      formData.append("file", asset.file);
      formData.append("companyId", String(selectedCompany.id));

      const importEndpoint =
        selectedSource === "PDF"
          ? `${API_BASE}/imports/pdf-ocr`
          : `${API_BASE}/imports/upload`;

      const response = await fetch(importEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to upload import file");
      }

      console.log("UPLOAD RESPONSE:", data);

      if (selectedSource === "PDF") {
        const ocrRows = Array.isArray(data.preview)
          ? data.preview
          : Array.isArray(data.reviewRows)
            ? data.reviewRows
            : [];

        const mappedOcrRows = ocrRows.map((row, index) => {
          const parsed = row.parsed || {};
          const amount = normalizeMoney(parsed.amount);

          const errors = [];

          if (amount === null || Number.isNaN(amount)) {
            errors.push("Missing amount");
          }

          if (!parsed.transactionDate) errors.push("Missing or invalid date");
          if (!parsed.description?.trim()) errors.push("Missing description");

          const ocrWarningsForRow = Array.isArray(row.warnings) ? row.warnings : [];

          return {
            id: `ocr-${index + 1}`,
            selected: errors.length === 0 && !row.requiresReview,
            description: parsed.description || "",
            transactionDate: parsed.transactionDate || "",
            amount: amount ?? 0,
            vatAmount:
              parsed.classification === "taxable"
                ? Number(((amount || 0) * 0.1).toFixed(2))
                : 0,
            type: parsed.type || "expense",
            classification: parsed.classification || "taxable",
            status:
              row.requiresReview || errors.length
                ? "OCR Review Required"
                : "Ready",
            errors: [...errors, ...ocrWarningsForRow],
            sourceRow: row,
            confidence: row.confidence ?? null,
            requiresReview: !!row.requiresReview,
            ocrWarnings: ocrWarningsForRow,
          };
        });

        setParsedRows([]);
        setColumns([]);
        setRawRowCount(ocrRows.length);
        setPreviewBatchId(data.batchId || null);
        setReviewRows(mappedOcrRows);
        setOcrWarnings(Array.isArray(data.warnings) ? data.warnings : []);
        setOcrRequiresReview(!!data.requiresManualReview);
        setOcrLowConfidenceRows(Number(data.lowConfidenceRows || 0));
        setOcrReviewed(!data.requiresManualReview);
        setImportMessage(
          data.requiresManualReview
            ? "PDF processed. Some OCR rows require manual review."
            : data.message || "PDF processed successfully."
        );

        return;
      }

      const preview = Array.isArray(data.preview) ? data.preview : [];
      const previewRowsFromBackend = preview.map((item, index) => {
        const parsed = item.parsed || {};

        return {
          id: `preview-${index + 1}`,
          selected: item.status === "valid",
          description: parsed.description || "",
          transactionDate: parsed.transactionDate || "",
          amount: Number(parsed.amount || 0),
          vatAmount: Number(parsed.vatAmount || 0),
          type: parsed.type || "sale",
          classification: parsed.classification || "taxable",
          status: item.status === "valid" ? "Ready" : "Needs Review",
          errors: item.errorMessage ? [item.errorMessage] : [],
          sourceRow: item.raw || {},
        };
      });

      const rawRows = preview.map((item) => item.raw || {});
      const detectedColumns =
        rawRows.length > 0 ? Object.keys(rawRows[0]) : [];

      setRawRowCount(rawRows.length);
      setParsedRows(rawRows);
      setColumns(detectedColumns);
      setPreviewBatchId(data.batchId || null);
      setReviewRows(previewRowsFromBackend);
      setImportMessage(data.message || "");

      const lowerColumns = detectedColumns.map((col) => ({
        original: col,
        lower: String(col).toLowerCase(),
      }));

      const findColumn = (keywords) => {
        const found = lowerColumns.find((item) =>
          keywords.some((keyword) => item.lower.includes(keyword))
        );
        return found ? found.original : "";
      };

      const detectedTemplate = await detectTemplateForColumns(detectedColumns);

      if (detectedTemplate?.mapping) {
        applyTemplateMapping(detectedTemplate);

        if (detectedTemplate.score >= 0.9) {
          setImportMessage(
            `Matched template "${detectedTemplate.template_name}" with high confidence. Starting one-click import.`
          );

          await autoImportWithTemplate(detectedTemplate, rawRows);
          return;
        }

        setImportMessage(
          `Matched template "${detectedTemplate.template_name}". Review mapping and import when ready.`
        );
      } else {
        setColumnMapping({
          amount: findColumn(["amount", "total", "gross", "value"]),
          transactionDate: findColumn(["date", "transaction date", "invoice date"]),
          description: findColumn(["description", "details", "memo", "narration"]),
          classification: findColumn(["classification", "vat type", "tax status"]),
          type: findColumn(["type", "transaction type", "entry type"]),
        });
      }

    } catch (error) {
      Alert.alert("Import Error", error.message || "Failed to open file.");
    } finally {
      setLoading(false);
    }
  };

  const updateReviewRow = (id, field, value) => {
    setReviewRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;

        const updated = {
          ...row,
          [field]: value,
        };

        if (field === "classification" || field === "amount") {
          const amount = Number(updated.amount || 0);
          updated.vatAmount =
            updated.classification === "taxable"
              ? Number((amount * 0.1).toFixed(2))
              : 0;
        }

        const errors = [];
        if (
          updated.amount === null ||
          updated.amount === "" ||
          Number.isNaN(Number(updated.amount))
        ) {
          errors.push("Missing amount");
        }
        if (!updated.transactionDate) errors.push("Missing or invalid date");
        if (!updated.description?.trim()) errors.push("Missing description");

        updated.errors = errors;
        updated.status = errors.length ? "Needs Review" : "Ready";

        return updated;
      })
    );
  };

  const toggleSelectedRow = (id) => {
    setReviewRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, selected: !row.selected } : row
      )
    );
  };

  const submitReviewedRows = async () => {
    try {
      if (!selectedCompany?.id) {
        Alert.alert("No Company", "Please select a company.");
        return;
      }

      if (!previewBatchId) {
        Alert.alert("No Import Batch", "Please upload a file first.");
        return;
      }

      setSaving(true);

      const token = getAuthToken();

      if (!token) {
        throw new Error("Please log in again.");
      }

      console.log("CONFIRMING BATCH ID:", previewBatchId);

      const response = await fetch(`${API_BASE}/imports/confirm`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          batchId: previewBatchId,
        }),
      });

      const data = await response.json().catch(() => ({}));
      console.log("CONFIRM IMPORT RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to confirm import");
      }

      setLastImportBatch({
        id: data.batchId,
        status: "imported",
      });

      await fetchImportHistory();

      Alert.alert(
        "Confirm Import Complete",
        `Imported ${data.insertedCount || 0} row(s).`
      );

      if ((data.insertedCount || 0) > 0) {
        setReviewRows((current) =>
          current.map((row) =>
            row.selected
              ? { ...row, selected: false, status: "Imported" }
              : row
          )
        );

        setPreviewBatchId(null);
      }
    } catch (error) {
      Alert.alert("Import Error", error.message || "Failed to confirm import.");
    } finally {
      setSaving(false);
    }
  };

  const getBatchStatusText = (status) => {
    if (!status) return "unknown";
    return String(status).replace(/_/g, " ");
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Imports</Text>
          <Text style={styles.pageSubtitle}>
            Open source files, review mapped rows, and import them into transactions or purchases.
          </Text>
        </View>
      </View>

      <View style={styles.companyCard}>
        <Text style={styles.cardLabel}>Selected Company</Text>
        <Text style={styles.companyName}>
          {selectedCompany?.name || "No company selected"}
        </Text>
        <Text style={styles.companySubtext}>
          Imported records will be created under this company.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Import Sources</Text>
        <Text style={styles.sectionSubtitle}>
          Choose the source format you want to import.
        </Text>

        <View style={styles.sourceGrid}>
          {importSources.map((source) => {
            const isActive = selectedSource === source.key;

            return (
              <TouchableOpacity
                key={source.key}
                style={[styles.sourceCard, isActive && styles.sourceCardActive]}
                onPress={() => handleSelectSource(source.key)}
              >
                <Text
                  style={[
                    styles.sourceTitle,
                    isActive && styles.sourceTitleActive,
                  ]}
                >
                  {source.title}
                </Text>
                <Text
                  style={[
                    styles.sourceSubtitle,
                    isActive && styles.sourceSubtitleActive,
                  ]}
                >
                  {source.subtitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Open File</Text>
        <Text style={styles.sectionSubtitle}>
          Choose a CSV or Excel file to generate review rows before import.
        </Text>

        <View style={styles.uploadCard}>
          <Text style={styles.uploadTitle}>
            {selectedFile?.name || "No file selected"}
          </Text>
          <Text style={styles.uploadSubtitle}>
            {selectedFile
              ? `${rawRowCount} source row(s) loaded`
              : `Ready to open a ${selectedSource} file`}
          </Text>

          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleChooseFile}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.uploadButtonText}>Open File</Text>
            )}
          </TouchableOpacity>

          {!!importMessage && (
            <Text style={styles.uploadHelpText}>{importMessage}</Text>
          )}
        </View>

        {parsedRows.length > 0 && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Source Preview</Text>
            <Text style={styles.previewSubtitle}>
              Showing the first {Math.min(parsedRows.length, 10)} row(s) from the selected file.
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={styles.previewHeaderRow}>
                  {columns.map((col) => (
                    <Text key={col} style={styles.previewHeaderCell}>
                      {col}
                    </Text>
                  ))}
                </View>

                {parsedRows.slice(0, 10).map((row, index) => (
                  <View key={`preview-${index}`} style={styles.previewDataRow}>
                    {columns.map((col) => (
                      <Text key={`${index}-${col}`} style={styles.previewDataCell}>
                        {row?.[col] == null || row?.[col] === ""
                          ? "-"
                          : String(row[col])}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      {columns.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Column Mapping</Text>
          <Text style={styles.sectionSubtitle}>
            Map your imported columns to VAT Pro fields before generating review rows.
          </Text>

          <View style={styles.mappingCard}>
            {!!matchedTemplate && (
              <View style={styles.templateMatchedBox}>
                <View style={styles.templateMatchedTopRow}>
                  <Text style={styles.templateMatchedTitle}>
                    Template detected: {matchedTemplate.template_name}
                  </Text>

                  {matchedTemplateScore !== null && (
                    <View style={styles.templateScorePill}>
                      <Text style={styles.templateScorePillText}>
                        {Math.round(matchedTemplateScore * 100)}% match
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={styles.templateMatchedText}>
                  {autoImporting
                    ? "High-confidence template matched. Importing rows now..."
                    : matchedTemplateScore >= 0.9
                      ? "High-confidence match. One-click import is available."
                      : "Template matched. Review mapping before importing."}
                </Text>
              </View>
            )}

            <View style={styles.templateToolbar}>
              <TextInput
                style={styles.templateInput}
                placeholder="Template name (e.g. Bank CSV)"
                value={templateName}
                onChangeText={setTemplateName}
                placeholderTextColor="#7c8798"
              />

              <TouchableOpacity
                style={styles.templateSaveButton}
                onPress={() =>
                  saveTemplateToBackend({
                    name: templateName,
                    makeDefault: true,
                  })
                }
              >
                <Text style={styles.templateSaveButtonText}>Save Template</Text>
              </TouchableOpacity>
            </View>

            {templates.length > 0 && (
              <View style={styles.templateSelectorCard}>
                <Text style={styles.templateSelectorLabel}>Saved Templates</Text>

                <View style={styles.templateSelectorPickerWrap}>
                  <Picker
                    selectedValue={selectedTemplateId}
                    onValueChange={(value) => setSelectedTemplateId(value)}
                    style={styles.templateSelectorPicker}
                  >
                    <Picker.Item label="Select a saved template" value="" />
                    {templates.map((template) => (
                      <Picker.Item
                        key={template.id}
                        label={
                          template.is_default
                            ? `${template.template_name} (Default)`
                            : template.template_name
                        }
                        value={String(template.id)}
                      />
                    ))}
                  </Picker>
                </View>

                <View style={styles.templateSelectorActions}>
                  <TouchableOpacity
                    style={styles.templateApplyButton}
                    onPress={handleApplySelectedTemplate}
                  >
                    <Text style={styles.templateApplyButtonText}>Apply Template</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.templateDeleteButton}
                    onPress={handleDeleteSelectedTemplate}
                  >
                    <Text style={styles.templateDeleteButtonText}>Delete Template</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.mappingGrid}>
              <View style={styles.mappingField}>
                <Text style={styles.mappingLabel}>Amount Column</Text>
                <View style={styles.mappingPickerWrap}>
                  <Picker
                    selectedValue={columnMapping.amount}
                    onValueChange={(value) =>
                      setColumnMapping((prev) => ({ ...prev, amount: value }))
                    }
                    style={styles.mappingPicker}
                  >
                    <Picker.Item label="Select column" value="" />
                    {columns.map((col) => (
                      <Picker.Item key={col} label={col} value={col} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.mappingToolbar}>
                <TouchableOpacity style={styles.mappingBtn} onPress={saveMappingTemplate}>
                  <Text style={styles.mappingBtnText}>Save</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.mappingBtnAlt} onPress={loadSavedMappingTemplate}>
                  <Text style={styles.mappingBtnAltText}>Load</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.mappingBtnDanger} onPress={clearSavedMappingTemplate}>
                  <Text style={styles.mappingBtnDangerText}>Clear</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.mappingField}>
                <Text style={styles.mappingLabel}>Date Column</Text>
                <View style={styles.mappingPickerWrap}>
                  <Picker
                    selectedValue={columnMapping.transactionDate}
                    onValueChange={(value) =>
                      setColumnMapping((prev) => ({
                        ...prev,
                        transactionDate: value,
                      }))
                    }
                    style={styles.mappingPicker}
                  >
                    <Picker.Item label="Select column" value="" />
                    {columns.map((col) => (
                      <Picker.Item key={col} label={col} value={col} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.mappingField}>
                <Text style={styles.mappingLabel}>Description Column</Text>
                <View style={styles.mappingPickerWrap}>
                  <Picker
                    selectedValue={columnMapping.description}
                    onValueChange={(value) =>
                      setColumnMapping((prev) => ({ ...prev, description: value }))
                    }
                    style={styles.mappingPicker}
                  >
                    <Picker.Item label="Select column" value="" />
                    {columns.map((col) => (
                      <Picker.Item key={col} label={col} value={col} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.mappingField}>
                <Text style={styles.mappingLabel}>Classification Column</Text>
                <View style={styles.mappingPickerWrap}>
                  <Picker
                    selectedValue={columnMapping.classification}
                    onValueChange={(value) =>
                      setColumnMapping((prev) => ({
                        ...prev,
                        classification: value,
                      }))
                    }
                    style={styles.mappingPicker}
                  >
                    <Picker.Item label="Optional" value="" />
                    {columns.map((col) => (
                      <Picker.Item key={col} label={col} value={col} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.mappingField}>
                <Text style={styles.mappingLabel}>Type Column</Text>
                <View style={styles.mappingPickerWrap}>
                  <Picker
                    selectedValue={columnMapping.type}
                    onValueChange={(value) =>
                      setColumnMapping((prev) => ({ ...prev, type: value }))
                    }
                    style={styles.mappingPicker}
                  >
                    <Picker.Item label="Optional" value="" />
                    {columns.map((col) => (
                      <Picker.Item key={col} label={col} value={col} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.applyMappingButton}
              onPress={buildReviewRowsFromMapping}
            >
              <Text style={styles.applyMappingButtonText}>Apply Mapping</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Rows Loaded</Text>
          <Text style={styles.summaryValue}>{summary.totalRows}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Ready Rows</Text>
          <Text style={styles.summaryValue}>{summary.readyRows}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Sales</Text>
          <Text style={styles.summaryValue}>{summary.salesCount}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Purchases</Text>
          <Text style={styles.summaryValue}>{summary.purchaseCount}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Gross Amount</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.grossAmount)}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>VAT Amount</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.vatAmount)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Import Status</Text>
          <Text style={styles.summaryValue}>
            {readyRowsCount > 0 ? "Ready to Import" : "Needs Review"}
          </Text>
        </View>
      </View>

      {selectedSource === "PDF" && (ocrRequiresReview || ocrWarnings.length > 0) && (
        <View style={styles.ocrWarningCard}>
          <Text style={styles.ocrWarningTitle}>OCR Review Required</Text>

          <Text style={styles.ocrWarningText}>
            Low-confidence rows: {ocrLowConfidenceRows}
          </Text>

          {ocrWarnings.map((warning, index) => (
            <Text key={`ocr-warning-${index}`} style={styles.ocrWarningText}>
              • {warning}
            </Text>
          ))}

          <TouchableOpacity
            style={[
              styles.ocrReviewedButton,
              ocrReviewed && styles.ocrReviewedButtonActive,
            ]}
            onPress={() => setOcrReviewed(true)}
          >
            <Text
              style={[
                styles.ocrReviewedButtonText,
                ocrReviewed && styles.ocrReviewedButtonTextActive,
              ]}
            >
              {ocrReviewed ? "OCR Rows Reviewed" : "I reviewed OCR rows"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Review Logic</Text>
        <Text style={styles.infoText}>
          Rows are mapped into import review records first. Ready rows can be posted
          into your existing backend transaction endpoint after VAT classification review.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Review Rows</Text>
        <Text style={styles.sectionSubtitle}>
          Review, adjust, and select rows before import.
        </Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Search review rows..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#7c8798"
        />

        <View style={styles.tableCard}>
          {filteredRows.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No rows loaded yet. Open a CSV or Excel file to begin.
              </Text>
            </View>
          ) : (
            filteredRows.map((row) => (
              <View
                key={row.id}
                style={[
                  styles.rowCard,
                  row.requiresReview && styles.ocrReviewRowCard,
                ]}
              >
                <View style={styles.rowTop}>
                  <TouchableOpacity
                    style={[
                      styles.selectBadge,
                      row.selected && styles.selectBadgeActive,
                    ]}
                    onPress={() => toggleSelectedRow(row.id)}
                  >
                    <Text
                      style={[
                        styles.selectBadgeText,
                        row.selected && styles.selectBadgeTextActive,
                      ]}
                    >
                      {row.selected ? "Selected" : "Skip"}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.rowStatus}>{row.status}</Text>
                </View>

                <View style={styles.rowGrid}>
                  <View style={styles.inputBlock}>
                    <Text style={styles.inputLabel}>Description</Text>
                    <TextInput
                      style={styles.input}
                      value={row.description}
                      onChangeText={(value) =>
                        updateReviewRow(row.id, "description", value)
                      }
                    />
                  </View>

                  <View style={styles.inputBlock}>
                    <Text style={styles.inputLabel}>Date</Text>
                    <TextInput
                      style={styles.input}
                      value={row.transactionDate}
                      onChangeText={(value) =>
                        updateReviewRow(row.id, "transactionDate", value)
                      }
                      placeholder="YYYY-MM-DD"
                    />
                  </View>

                  <View style={styles.inputBlock}>
                    <Text style={styles.inputLabel}>Amount</Text>
                    <TextInput
                      style={styles.input}
                      value={String(row.amount)}
                      onChangeText={(value) =>
                        updateReviewRow(row.id, "amount", value)
                      }
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[
                      styles.optionPill,
                      row.type === "sale" && styles.optionPillActive,
                    ]}
                    onPress={() => updateReviewRow(row.id, "type", "sale")}
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        row.type === "sale" && styles.optionPillTextActive,
                      ]}
                    >
                      Sale
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionPill,
                      row.type === "expense" && styles.optionPillActive,
                    ]}
                    onPress={() => updateReviewRow(row.id, "type", "expense")}
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        row.type === "expense" && styles.optionPillTextActive,
                      ]}
                    >
                      Purchase
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionPill,
                      row.classification === "taxable" && styles.optionPillActive,
                    ]}
                    onPress={() =>
                      updateReviewRow(row.id, "classification", "taxable")
                    }
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        row.classification === "taxable" &&
                        styles.optionPillTextActive,
                      ]}
                    >
                      Taxable
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionPill,
                      row.classification === "zero_rated" &&
                      styles.optionPillActive,
                    ]}
                    onPress={() =>
                      updateReviewRow(row.id, "classification", "zero_rated")
                    }
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        row.classification === "zero_rated" &&
                        styles.optionPillTextActive,
                      ]}
                    >
                      Zero Rated
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionPill,
                      row.classification === "exempt" &&
                      styles.optionPillActive,
                    ]}
                    onPress={() =>
                      updateReviewRow(row.id, "classification", "exempt")
                    }
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        row.classification === "exempt" &&
                        styles.optionPillTextActive,
                      ]}
                    >
                      Exempt
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.rowFooter}>
                  <Text style={styles.rowFooterText}>
                    {row.confidence !== null && row.confidence !== undefined && (
                      <Text style={styles.ocrConfidenceText}>
                        OCR Confidence: {row.confidence}%
                      </Text>
                    )}
                    VAT: {formatCurrency(row.vatAmount || 0)}
                  </Text>

                  {!!row.errors?.length && (
                    <Text style={styles.errorText}>{row.errors.join(" • ")}</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.importButton,
          (saving || autoImporting || readyRowsCount === 0 || ocrImportLocked) &&
          styles.importButtonDisabled,
        ]}
        onPress={submitReviewedRows}
        disabled={saving || autoImporting || readyRowsCount === 0 || ocrImportLocked}
      >
        {saving ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.importButtonText}>
            {saving
              ? "Importing..."
              : ocrImportLocked
                ? "Review OCR Rows First"
                : readyRowsCount > 0
                  ? `Import ${readyRowsCount} Row(s)`
                  : "No Rows Ready"}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Import History</Text>
        <Text style={styles.sectionSubtitle}>
          Review completed import batches and undo them if needed.
        </Text>

        <View style={styles.historyCard}>
          {historyLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator />
              <Text style={[styles.emptyStateText, { marginTop: 10 }]}>
                Loading import history...
              </Text>
            </View>
          ) : importHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No import batches have been recorded yet.
              </Text>
            </View>
          ) : (
            importHistory.map((batch) => {
              const isUndoing = undoingBatchId === batch.id;
              const isUndone = String(batch.status || "").toLowerCase() === "undone";

              return (
                <View key={batch.id} style={styles.historyRow}>
                  <View style={styles.historyRowTop}>
                    <View style={styles.historyMeta}>
                      <Text style={styles.historyTitle}>
                        {batch.file_name || batch.fileName || "Imported File"}
                      </Text>
                      <Text style={styles.historySubtext}>
                        Source: {batch.source_type || batch.sourceType || "Unknown"}
                      </Text>
                    </View>

                    <Text style={styles.historyStatus}>
                      {getBatchStatusText(batch.status)}
                    </Text>
                  </View>

                  <Text style={styles.historyDetails}>
                    Rows: {batch.total_rows ?? batch.totalRows ?? 0} | Valid: {batch.valid_rows ??
                      batch.validRows ?? 0} | Errors: {batch.error_rows ?? batch.errorRows ?? 0}
                  </Text>

                  <View style={styles.historyActions}>
                    <TouchableOpacity
                      style={styles.historyViewButton}
                      onPress={() => loadBatchDetails(batch.id)}
                    >
                      <Text style={styles.historyViewButtonText}>View Batch</Text>
                    </TouchableOpacity>

                    {!isUndone && (
                      <TouchableOpacity
                        style={styles.historyUndoButton}
                        onPress={() => handleUndoBatch(batch.id)}
                        disabled={isUndoing}
                      >
                        {isUndoing ? (
                          <ActivityIndicator />
                        ) : (
                          <Text style={styles.historyUndoButtonText}>Undo Batch</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>

      {(selectedBatch || selectedBatchItems.length > 0) && (
        <View
          style={styles.section}
          onLayout={(event) => {
            setBatchDetailsY(event.nativeEvent.layout.y);
          }}
        >

          <Text style={styles.sectionTitle}>Batch Details</Text>
          <Text style={styles.sectionSubtitle}>
            Inspect imported rows and their status for the selected batch.
          </Text>

          <View style={styles.batchDetailsCard}>
            <Text style={styles.batchDetailsTitle}>
              {selectedBatch?.file_name || selectedBatch?.fileName || "Selected Batch"}
            </Text>

            <Text style={styles.batchDetailsSubtext}>
              Status: {getBatchStatusText(selectedBatch?.status)} | Total rows:{" "}
              {selectedBatch?.total_rows ?? selectedBatch?.totalRows ?? selectedBatchItems.length}
            </Text>

            {selectedBatchItems.length === 0 ? (
              <Text style={styles.emptyStateText}>No batch items found.</Text>
            ) : (
              selectedBatchItems.map((item, index) => (
                <View
                  key={`${item.id || item.rowIndex || index}-${index}`}
                  style={styles.batchItemRow}
                >
                  <Text style={styles.batchItemTitle}>
                    Row {item.row_index ?? item.rowIndex ?? index + 1}:{" "}
                    {item.description || "No description"}
                  </Text>
                  <Text style={styles.batchItemSubtext}>
                    {item.transaction_date || item.transactionDate || "-"} |{" "}
                    {formatCurrency(Number(item.amount || 0))} |{" "}
                    {item.type || "sale"} | {item.classification || "taxable"} |{" "}
                    {getBatchStatusText(item.status)}
                  </Text>
                  {!!item.error_message && (
                    <Text style={styles.errorText}>{item.error_message}</Text>
                  )}
                  {!!item.errorMessage && (
                    <Text style={styles.errorText}>{item.errorMessage}</Text>
                  )}
                </View>
              ))
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f8fb",
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  headerRow: {
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  companyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  companyName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  companySubtext: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 19,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 14,
    lineHeight: 19,
  },
  sourceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  sourceCard: {
    width: "48.5%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sourceCardActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  sourceTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  sourceTitleActive: {
    color: "#1d4ed8",
  },
  sourceSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
  sourceSubtitleActive: {
    color: "#1e40af",
  },
  uploadCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    alignItems: "center",
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  uploadSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 20,
  },
  uploadButton: {
    backgroundColor: "#111827",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    marginBottom: 14,
    minWidth: 160,
    alignItems: "center",
  },
  uploadButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  uploadHelpText: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 520,
  },
  previewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  previewSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 14,
    lineHeight: 19,
  },
  previewHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  previewHeaderCell: {
    minWidth: 140,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  previewDataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  previewDataCell: {
    minWidth: 140,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 12,
    color: "#111827",
  },
  mappingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  templateMatchedBox: {
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#a5f3fc",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  templateMatchedTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "wrap",
  },
  templateMatchedTitle: {
    color: "#155e75",
    fontSize: 13,
    fontWeight: "700",
    marginRight: 8,
  },
  templateMatchedText: {
    color: "#155e75",
    fontSize: 13,
    fontWeight: "700",
  },
  templateScorePill: {
    backgroundColor: "#cffafe",
    borderWidth: 1,
    borderColor: "#67e8f9",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  templateScorePillText: {
    color: "#0f766e",
    fontSize: 11,
    fontWeight: "700",
  },
  templateToolbar: {
    marginBottom: 14,
  },
  templateInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#111827",
    marginBottom: 10,
  },
  templateSaveButton: {
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  templateSaveButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  templateSelectorCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  templateSelectorLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  templateSelectorPickerWrap: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 10,
  },
  templateSelectorPicker: {
    height: 44,
  },
  templateSelectorActions: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  templateApplyButton: {
    backgroundColor: "#0f766e",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  templateApplyButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  templateDeleteButton: {
    backgroundColor: "#fee2e2",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  templateDeleteButtonText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  mappingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  mappingField: {
    width: "48.5%",
    marginBottom: 14,
  },
  mappingLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 6,
  },
  mappingPickerWrap: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    overflow: "hidden",
  },
  mappingPicker: {
    height: 44,
  },
  mappingToolbar: {
    flexDirection: "row",
    marginBottom: 12,
  },
  mappingBtn: {
    backgroundColor: "#111827",
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  mappingBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  mappingBtnAlt: {
    backgroundColor: "#e5e7eb",
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  mappingBtnAltText: {
    fontWeight: "700",
  },
  mappingBtnDanger: {
    backgroundColor: "#fee2e2",
    padding: 8,
    borderRadius: 8,
  },
  mappingBtnDangerText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
  applyMappingButton: {
    marginTop: 8,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: "center",
  },
  applyMappingButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  summaryCard: {
    width: "48.5%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  infoCard: {
    backgroundColor: "#eef4ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e3a8a",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 20,
  },
  searchInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
    marginBottom: 14,
  },
  tableCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    padding: 16,
  },
  rowCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    alignItems: "center",
  },
  selectBadge: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
  selectBadgeActive: {
    backgroundColor: "#dcfce7",
    borderColor: "#22c55e",
  },
  selectBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  selectBadgeTextActive: {
    color: "#166534",
  },
  rowStatus: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
  rowGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  inputBlock: {
    width: "32%",
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#111827",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    marginBottom: 10,
  },
  optionPill: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#ffffff",
  },
  optionPillActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  optionPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  optionPillTextActive: {
    color: "#ffffff",
  },
  rowFooter: {
    marginTop: 4,
  },
  rowFooterText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  errorText: {
    fontSize: 12,
    color: "#b91c1c",
    lineHeight: 17,
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  importButton: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 20,
  },
  importButtonDisabled: {
    opacity: 0.7,
  },
  importButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  historyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    marginBottom: 16,
  },
  historyRow: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  historyRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  historyMeta: {
    flex: 1,
    marginRight: 12,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  historySubtext: {
    fontSize: 12,
    color: "#6b7280",
  },
  historyStatus: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    textTransform: "capitalize",
  },
  historyDetails: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 10,
  },
  historyActions: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  historyViewButton: {
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  historyViewButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  historyUndoButton: {
    backgroundColor: "#fee2e2",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  historyUndoButtonText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  batchDetailsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
  },
  batchDetailsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  batchDetailsSubtext: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 12,
  },
  batchItemRow: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingVertical: 10,
  },
  batchItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  batchItemSubtext: {
    fontSize: 12,
    color: "#6b7280",
  },
  ocrWarningCard: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  ocrWarningTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9a3412",
    marginBottom: 8,
  },
  ocrWarningText: {
    fontSize: 13,
    color: "#9a3412",
    lineHeight: 19,
    marginBottom: 4,
  },
  ocrReviewedButton: {
    marginTop: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f97316",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  ocrReviewedButtonActive: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  ocrReviewedButtonText: {
    color: "#c2410c",
    fontSize: 13,
    fontWeight: "700",
  },
  ocrReviewedButtonTextActive: {
    color: "#ffffff",
  },
  ocrReviewRowCard: {
    borderColor: "#f97316",
    backgroundColor: "#fff7ed",
  },
  ocrConfidenceText: {
    fontSize: 12,
    color: "#9a3412",
    fontWeight: "700",
    marginBottom: 6,
  },
});