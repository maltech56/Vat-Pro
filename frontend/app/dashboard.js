import React, { useEffect, useState, useCallback } from "react";
import TransactionsPage from "./transactions";
import VatFilingScreen from "./vat-filing";
import Purchases from "./purchases";
import VatFilingHistory from "./vat-filing-history";
import VatReturnsScreen from "../components/VatReturnsScreen";
import ImportsScreen from "../components/ImportsScreen";
import DocumentsScreen from "../components/DocumentsScreen";
import ReportsScreen from "../components/ReportsScreen";
import SettingsScreen from "../components/SettingsScreen";
import CreateCompanyScreen from "../components/CreateCompanyScreen";
import AuditDashboardScreen from "../components/AuditDashboardScreen";
import ErrorBoundary from "../components/ErrorBoundary";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { Picker } from "@react-native-picker/picker";

import Sidebar from "../components/Sidebar";
import AddTransaction from "./add-transaction";
import RecentTransactions from "../components/RecentTransactions";

import { getUser } from "../src/utils/session";
import { useCompany } from "../context/CompanyContext";
import { formatCurrency } from "../src/utils/formatters";
import { apiFetch } from "../src/utils/apiFetch";

const VAT_DUE_DAY = 28;

const calculateNextVatDueDate = (vatDueDay = VAT_DUE_DAY) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  let dueDate = new Date(year, month, vatDueDay);

  if (today > dueDate) {
    dueDate = new Date(year, month + 1, vatDueDay);
  }

  return dueDate;
};

const stripTime = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDaysRemaining = (dueDate) => {
  const today = stripTime(new Date());
  const target = stripTime(dueDate);

  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const formatLongDate = (date) =>
  new Intl.DateTimeFormat("en-BS", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);

const buildVatAlert = (vatDueDay = VAT_DUE_DAY) => {
  const nextDueDate = calculateNextVatDueDate(vatDueDay);
  const daysRemaining = getDaysRemaining(nextDueDate);

  let status = "upcoming";
  let title = "Next VAT Filing Due";
  let message = `${daysRemaining} days remaining`;

  if (daysRemaining < 0) {
    status = "overdue";
    title = "VAT Filing Overdue";
    message = `${Math.abs(daysRemaining)} days overdue`;
  } else if (daysRemaining === 0) {
    status = "due_soon";
    title = "VAT Filing Due Today";
    message = "VAT filing is due today";
  } else if (daysRemaining <= 7) {
    status = "due_soon";
    title = "VAT Filing Due Soon";
    message = `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`;
  }

  return {
    title,
    status,
    dueDate: formatLongDate(nextDueDate),
    message,
    daysRemaining,
  };
};

const buildDocumentAuditAlert = (unlinkedCount = 0) => {
  if (!unlinkedCount || unlinkedCount <= 0) {
    return null;
  }

  if (unlinkedCount >= 5) {
    return {
      level: "critical",
      title: "Critical Audit Risk",
      badge: "Critical",
      message: `${unlinkedCount} uploaded documents are still not linked to transactions. Your audit trail is incomplete and should be reviewed immediately.`,
    };
  }

  if (unlinkedCount >= 2) {
    return {
      level: "warning",
      title: "Unlinked Documents Detected",
      badge: "Warning",
      message: `${unlinkedCount} uploaded documents are not linked to transactions. Review them before finalizing this VAT period.`,
    };
  }

  return {
    level: "low",
    title: "Minor Audit Review Needed",
    badge: "Review",
    message: `1 uploaded document is not linked to a transaction. Review it to keep your filing pack audit-ready.`,
  };
};

const buildAuditReadinessScore = (unlinkedCount = 0, totalDocuments = 0) => {
  const unlinked = Number(unlinkedCount || 0);
  const total = Number(totalDocuments || 0);

  if (total === 0) {
    return {
      score: 0,
      level: "critical",
      label: "No Documents Uploaded",
      message:
        "No supporting documents have been uploaded. Upload invoices and receipts to build an audit-ready VAT filing pack.",
      action: "Upload Documents",
    };
  }

  if (unlinked === 0) {
    return {
      score: 100,
      level: "excellent",
      label: "Audit Ready",
      message:
        "All uploaded documents are linked to transactions. This company is ready for VAT filing support.",
      action: "Review Documents",
    };
  }

  if (unlinked === 1) {
    return {
      score: 90,
      level: "good",
      label: "Minor Review Needed",
      message:
        "1 document still needs to be linked before the audit trail is complete.",
      action: "Fix Document Link",
    };
  }

  if (unlinked <= 4) {
    return {
      score: 70,
      level: "warning",
      label: "Review Recommended",
      message: `${unlinked} documents are not linked to transactions. Link them before finalizing the VAT period.`,
      action: "Review Unlinked Documents",
    };
  }

  return {
    score: 40,
    level: "critical",
    label: "Audit Risk",
    message: `${unlinked} documents are not linked. The filing pack may be incomplete for audit review.`,
    action: "Resolve Audit Risk",
  };
};

const getAuditStatus = (summary) => {
  const total = Number(summary?.totalDocuments || 0);
  const unlinked = Number(summary?.unlinkedCount || 0);

  if (total === 0) {
    return {
      label: "Missing Documents",
      color: "#DC2626",
      bg: "#FEF2F2",
      border: "#FECACA",
    };
  }

  if (unlinked === 0) {
    return {
      label: "Complete",
      color: "#16A34A",
      bg: "#F0FDF4",
      border: "#BBF7D0",
    };
  }

  return {
    label: "Partial",
    color: "#D97706",
    bg: "#FFF7ED",
    border: "#FED7AA",
  };
};

export default function Dashboard() {
  const [overview, setOverview] = useState({
    totalSales: 0,
    outputVAT: 0,
    inputVAT: 0,
    netVATPayable: 0,
  });

  const [auditSummary, setAuditSummary] = useState({
    unlinkedCount: 0,
    linkedCount: 0,
    totalDocuments: 0,
  });

  const [vatAlert, setVatAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [error, setError] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activePage, setActivePage] = useState("Dashboard");
  const [pageOptions, setPageOptions] = useState({});

  const handleSelectPage = (page, options = {}) => {
    setActivePage(page);
    setPageOptions(options);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const transactionId = params.get("transactionId");

    if (view === "transactions") {
      setActivePage("Transactions");
    }

    if (transactionId) {
      localStorage.setItem("highlightTransactionId", transactionId);
    }
  }, []);


  const [user] = useState(() => getUser());
  const [companies, setCompanies] = useState([]);
  const [companySettings, setCompanySettings] = useState(null);
  const { selectedCompany, setSelectedCompany, companyReady } = useCompany();

  const [vatPeriodType, setVatPeriodType] = useState("monthly");

  const [periodFilters, setPeriodFilters] = useState({
    month: "",
    quarter: "Q1",
    year: String(new Date().getFullYear()),
    startDate: "",
    endDate: "",
  });

  const selectedMonth = periodFilters.month;
  const selectedQuarter = periodFilters.quarter;
  const selectedYear = periodFilters.year;
  const startDate = periodFilters.startDate;
  const endDate = periodFilters.endDate;

  const companyName =
    selectedCompany?.name ||
    selectedCompany?.company_name ||
    "Selected Company";

  const brandColor = companySettings?.primaryColor || "#0F3D91";
  const documentAuditAlert = buildDocumentAuditAlert(
    auditSummary?.unlinkedCount || 0
  );

  const auditReadiness = buildAuditReadinessScore(
    auditSummary?.unlinkedCount || 0,
    auditSummary?.totalDocuments || 0
  );

  const auditStatus = getAuditStatus(auditSummary);

  const getDateRange = useCallback(() => {
    if (vatPeriodType === "monthly" && selectedMonth) {
      const [year, month] = selectedMonth.split("-");
      const start = `${year}-${month}-01`;
      const end = new Date(Number(year), Number(month), 0)
        .toISOString()
        .slice(0, 10);

      return { start, end };
    }

    if (vatPeriodType === "quarterly") {
      const q = String(selectedQuarter).toUpperCase();
      const year = String(selectedYear);

      const ranges = {
        Q1: ["01-01", "03-31"],
        Q2: ["04-01", "06-30"],
        Q3: ["07-01", "09-30"],
        Q4: ["10-01", "12-31"],
      };

      const [startSuffix, endSuffix] = ranges[q] || ranges.Q1;

      return {
        start: `${year}-${startSuffix}`,
        end: `${year}-${endSuffix}`,
      };
    }

    if (vatPeriodType === "custom") {
      return {
        start: startDate || "",
        end: endDate || "",
      };
    }

    return {};
  }, [
    vatPeriodType,
    selectedMonth,
    selectedQuarter,
    selectedYear,
    startDate,
    endDate,
  ]);


  
  const fetchCompanies = useCallback(async () => {
    try {
      setCompaniesLoading(true);
      setCompanyError("");

      if (!user?.id) {
        setCompanyError("User information is missing. Please log in again.");
        return;
      }

      const response = await apiFetch(`/companies/user`);
      if (!response) return;

      const data = response;

      const companyList = Array.isArray(data) ? data : [];

      setCompanies(companyList);

      if (companyList.length === 0) {
        setSelectedCompany(null);
        return;
      }

      const currentId = selectedCompany?.id;

      const matchedCurrent = companyList.find(
        (company) => String(company.id) === String(currentId)
      );

      if (!currentId || !matchedCurrent) {
        const fallbackCompany = companyList[0];

        if (
          fallbackCompany?.id &&
          String(fallbackCompany.id) !== String(selectedCompany?.id)
        ) {
          setSelectedCompany(fallbackCompany);
        }

        return;
      }
    } catch (err) {
      console.error("fetchCompanies error:", err);
      setCompanyError(err.message || "Failed to load companies");
    } finally {
      setCompaniesLoading(false);
    }
  }, [setSelectedCompany, user?.id]);


  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      if (!selectedCompany?.id) return;

      const { start, end } = getDateRange();
      const params = new URLSearchParams();

      if (start) params.append("startDate", start);
      if (end) params.append("endDate", end);

      const query = params.toString();

      const endpoint = `/dashboard/company/${selectedCompany.id}/overview${query ? `?${query}` : ""
        }`;

      const response = await apiFetch(endpoint);
      if (!response) return;

      const data = response;

      setOverview({
        totalSales: Number(data.totalSales || 0),
        outputVAT: Number(data.outputVAT || 0),
        inputVAT: Number(data.inputVAT || 0),
        netVATPayable: Number(data.netVATPayable || 0),
      });
    } catch (err) {
      console.error("fetchOverview error:", err);
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [getDateRange, selectedCompany?.id]);

  const fetchAuditSummary = useCallback(async (companyId) => {
    try {
      const response = await apiFetch(
        `/documents/company/${companyId}/unlinked-summary`
      );

      if (!response) return;

      const data = response;

      setAuditSummary({
        unlinkedCount: Number(data.unlinkedCount || 0),
        linkedCount: Number(data.linkedCount || 0),
        totalDocuments: Number(data.totalDocuments || 0),
      });

    } catch (error) {
      console.error("fetchAuditSummary error:", error);

      setAuditSummary({
        unlinkedCount: 0,
        linkedCount: 0,
        totalDocuments: 0,
      });
    }
  }, []);

  useEffect(() => {

    if (!companyReady) return;

    fetchCompanies();

  }, [companyReady, fetchCompanies]);

  useEffect(() => {
    if (!companyReady) return;

    if (!selectedCompany?.id) {
    
      setOverview({
        totalSales: 0,
        outputVAT: 0,
        inputVAT: 0,
        netVATPayable: 0,
      });

      setAuditSummary({
        unlinkedCount: 0,
        linkedCount: 0,
        totalDocuments: 0,
      });

      setLoading(false);

      return;
    }

    fetchOverview();
    fetchAuditSummary(selectedCompany.id);
  }, [
    companyReady,
    selectedCompany?.id,
    refreshKey,
    fetchOverview,
    fetchAuditSummary,
  ]);

  useEffect(() => {
    if (!companyReady) return;
    if (!selectedCompany?.id) return;

    const interval = setInterval(() => {
      fetchAuditSummary(selectedCompany.id);

      setVatAlert((currentAlert) => {
        const dueDay = Number(companySettings?.vatDueDay ?? VAT_DUE_DAY);
        return buildVatAlert(dueDay);
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [
    companyReady,
    selectedCompany?.id,
    companySettings?.vatDueDay,
    fetchAuditSummary,
  ]);


  useEffect(() => {
    const loadCompanySettings = async () => {
      if (!companyReady) return;

      if (!selectedCompany?.id) {
        return;
      }

      try {
        const response = await apiFetch(
          `/settings/company/${selectedCompany.id}`
        );

        if (!response) return;

        const data = response;

        const settings = data.settings || null;

        console.log("COMPANY SETTINGS:", settings);

        setCompanySettings(settings);

        const dueDay = Number(settings?.vatDueDay ?? VAT_DUE_DAY);
        setVatAlert(buildVatAlert(dueDay));
      } catch (error) {
        console.error("LOAD COMPANY SETTINGS ERROR:", error);
      }
    };

    loadCompanySettings();
  }, [companyReady, selectedCompany?.id]);

  const handleTransactionSaved = () => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (!selectedCompany?.id) return;
      setOverview({
      totalSales: 0,
      outputVAT: 0,
      inputVAT: 0,
      netVATPayable: 0,
    });

    setError("");

    setPeriodFilters({
      month: "",
      quarter: "Q1",
      year: String(new Date().getFullYear()),
      startDate: "",
      endDate: "",
    });

  }, [selectedCompany?.id]);

  // console.log("Dashboard user:", user);

  
  if (loading) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (!selectedCompany) {
    return (
      <View style={styles.loadingPage}>
        <Text>No company selected.</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {/* Sidebar disabled for test */}
      <View style={styles.main}>
        {activePage === "Dashboard" && (

          <View style={{ flex: 1 }}>
            <View style={styles.topBar}>
              <Text style={styles.pageTitle}>dashboard</Text>
            </View>
            <ScrollView
              style={styles.contentArea}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.heroCard}>
                <View style={styles.heroRow}>
                  <View style={styles.heroLeft}>
                    {!!companySettings?.logoUrl && (
                      <Image
                        source={{ uri: companySettings.logoUrl }}
                        style={{ width: 60, height: 60, marginBottom: 10 }}
                      />
                    )}
                    <Text style={[styles.heroEyebrow, { color: brandColor }]}>
                      VAT PRO DASHBOARD
                    </Text>


                    <Text style={styles.heroTitle}>
                      {companySettings?.homeScreenTitle ||
                        `Welcome back, ${user?.name || "User"}`}
                    </Text>
                    <Text style={styles.heroSubtitle}>
                      Manage VAT activity, filings, and transactions across your
                      companies.
                    </Text>
                    <View
                      style={[
                        styles.activeCompanyBadge,
                        {
                          backgroundColor: `${brandColor}12`,
                          borderColor: `${brandColor}44`,
                        },
                      ]}
                    >
                      <Text style={[styles.activeCompanyBadgeLabel, { color: brandColor }]}>
                        Active Company
                      </Text>
                      <Text style={styles.activeCompanyBadgeText}>
                        {companyName}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.heroRight}>
                    <View style={styles.alertPill}>
                      <View style={styles.alertDot} />
                      <Text style={styles.alertText}>Alerts</Text>
                    </View>

                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>DM</Text>
                    </View>
                  </View>
                </View>

                {vatAlert !== null && vatAlert !== undefined && typeof vatAlert === "object" && (
                  <View
                    style={[
                      styles.vatAlertCard,
                      vatAlert.status === "due_soon" && styles.vatAlertDueSoon,
                      vatAlert.status === "overdue" && styles.vatAlertOverdue,
                    ]}
                  >
                    <View style={styles.vatAlertHeader}>
                      <Text style={styles.vatAlertTitle}>{vatAlert.title}</Text>

                      <View
                        style={[
                          styles.vatAlertBadge,
                          vatAlert.status === "due_soon" &&
                          styles.vatAlertBadgeDueSoon,
                          vatAlert.status === "overdue" &&
                          styles.vatAlertBadgeOverdue,
                        ]}
                      >
                        <Text style={styles.vatAlertBadgeText}>
                          {vatAlert.status === "overdue"
                            ? "Overdue"
                            : vatAlert.status === "due_soon"
                              ? "Due Soon"
                              : "Upcoming"}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.vatAlertDate}>
                      Due date: {vatAlert.dueDate}
                    </Text>
                    <Text style={styles.vatAlertMessage}>
                      {vatAlert.message}
                    </Text>
                  </View>
                )}

                <View style={styles.heroControlsRow}>
                  <View style={styles.heroControlBlock}>
                    <Text style={styles.companyLabel}>Company</Text>

                    <View style={styles.companyPickerWrap}>
                      {companiesLoading ? (
                        <Text style={styles.companyLoadingText}>
                          Loading companies...
                        </Text>
                      ) : (
                        <Picker
                          selectedValue={
                            selectedCompany?.id ? String(selectedCompany.id) : ""
                          }
                          onValueChange={(value) => {
                            const company = companies.find(
                              (item) => String(item.id) === String(value)
                            );

                            if (!company) return;

                            setLoading(true);
                            setSelectedCompany(company);

                            setOverview({
                              totalSales: 0,
                              outputVAT: 0,
                              inputVAT: 0,
                              netVATPayable: 0,
                            });
                            
                            setAuditSummary({
                              unlinkedCount: 0,
                              linkedCount: 0,
                              totalDocuments: 0,
                            });
                            setError("");
                            setRefreshKey((prev) => prev + 1);
                          }}
                          style={styles.picker}
                        >
                          {companies.map((company) => (
                            <Picker.Item
                              key={company.id}
                              label={company.name || company.company_name}
                              value={String(company.id)}
                            />
                          ))}
                        </Picker>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.periodCard}>
                <Text style={styles.sectionTitle}>VAT Period</Text>

                <View style={styles.selectRow}>
                  {["monthly", "quarterly", "custom"].map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setVatPeriodType(type)}
                      style={[
                        styles.selectOption,
                        vatPeriodType === type && styles.selectOptionActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectOptionText,
                          vatPeriodType === type &&
                          styles.selectOptionTextActive,
                        ]}
                      >
                        {type.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {vatPeriodType === "monthly" && (
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM"
                    value={selectedMonth}
                    onChangeText={(value) =>
                      setPeriodFilters((prev) => ({
                        ...prev,
                        month: value,
                      }))
                    }
                  />
                )}

                {vatPeriodType === "quarterly" && (
                  <View style={styles.periodRow}>
                    <TextInput
                      style={[styles.input, styles.periodInput]}
                      placeholder="Year"
                      value={String(selectedYear)}
                      onChangeText={(value) =>
                        setPeriodFilters((prev) => ({
                          ...prev,
                          year: value,
                        }))
                      }
                    />
                    <TextInput
                      style={[styles.input, styles.periodInput]}
                      placeholder="Q1 / Q2 / Q3 / Q4"
                      value={selectedQuarter}
                      onChangeText={(value) =>
                        setPeriodFilters((prev) => ({
                          ...prev,
                          quarter: value,
                        }))
                      }
                    />
                  </View>
                )}

                {vatPeriodType === "custom" && (
                  <View style={styles.periodRow}>
                    <TextInput
                      style={[styles.input, styles.periodInput]}
                      placeholder="Start YYYY-MM-DD"
                      value={startDate}
                      onChangeText={(value) =>
                        setPeriodFilters((prev) => ({
                          ...prev,
                          startDate: value,
                        }))
                      }
                    />
                    <TextInput
                      style={[styles.input, styles.periodInput]}
                      placeholder="End YYYY-MM-DD"
                      value={endDate}
                      onChangeText={(value) =>
                        setPeriodFilters((prev) => ({
                          ...prev,
                          endDate: value,
                        }))
                      }
                    />
                  </View>
                )}
              </View>

              {companyError ? (
                <Text style={styles.errorText}>{companyError}</Text>
              ) : null}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={styles.auditScoreCard}
                onPress={() => setActivePage("Documents")}
                activeOpacity={0.9}
              >
                <View style={styles.auditScoreHeader}>
                  <View>
                    <Text style={styles.auditScoreLabel}>
                      Audit Readiness Score
                    </Text>
                    <Text style={styles.auditScoreTitle}>
                      {auditReadiness.label}
                    </Text>
                  </View>

                  <View style={styles.auditHeaderRight}>
                    {/* STATUS BADGE (NEW) */}
                    <View
                      style={[
                        styles.auditStatusBadge,
                        {
                          backgroundColor: auditStatus.bg,
                          borderColor: auditStatus.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.auditStatusBadgeText,
                          { color: auditStatus.color },
                        ]}
                      >
                        {auditStatus.label}
                      </Text>
                    </View>

                    {/* SCORE BADGE */}
                    <View
                      style={[
                        styles.auditScoreBadge,
                        auditReadiness.level === "excellent" &&
                        styles.auditScoreBadgeExcellent,
                        auditReadiness.level === "good" &&
                        styles.auditScoreBadgeGood,
                        auditReadiness.level === "warning" &&
                        styles.auditScoreBadgeWarning,
                        auditReadiness.level === "critical" &&
                        styles.auditScoreBadgeCritical,
                      ]}
                    >
                      <Text style={styles.auditScoreBadgeText}>
                        {auditReadiness.score}%
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.auditScoreMessage}>
                  {auditReadiness.message}
                </Text>

                <View style={styles.auditScoreBarTrack}>
                  <View
                    style={[
                      styles.auditScoreBarFill,
                      { width: `${auditReadiness.score}%` },
                      auditReadiness.level === "excellent" &&
                      styles.auditScoreBarExcellent,
                      auditReadiness.level === "good" &&
                      styles.auditScoreBarGood,
                      auditReadiness.level === "warning" &&
                      styles.auditScoreBarWarning,
                      auditReadiness.level === "critical" &&
                      styles.auditScoreBarCritical,
                    ]}
                  />
                </View>

                <View style={styles.auditScoreFooter}>
                  <Text style={styles.auditScoreMeta}>
                    Unlinked documents: {auditSummary?.unlinkedCount || 0}
                  </Text>

                  <Text style={styles.auditScoreLinkText}>
                    {auditReadiness.action} →
                  </Text>
                </View>
              </TouchableOpacity>

              {documentAuditAlert !== null && documentAuditAlert !== undefined && typeof documentAuditAlert === "object" && (
                <View
                  style={[
                    styles.auditAlertCard,
                    documentAuditAlert.level === "warning" &&
                    styles.auditAlertWarning,
                    documentAuditAlert.level === "critical" &&
                    styles.auditAlertCritical,
                    documentAuditAlert.level === "low" && styles.auditAlertLow,
                  ]}
                >
                  <View style={styles.auditAlertHeader}>
                    <Text style={styles.auditAlertTitle}>
                      {documentAuditAlert.title}
                    </Text>

                    <View
                      style={[
                        styles.auditAlertBadge,
                        documentAuditAlert.level === "warning" &&
                        styles.auditAlertBadgeWarning,
                        documentAuditAlert.level === "critical" &&
                        styles.auditAlertBadgeCritical,
                        documentAuditAlert.level === "low" &&
                        styles.auditAlertBadgeLow,
                      ]}
                    >
                      <Text style={styles.auditAlertBadgeText}>
                        {documentAuditAlert.badge}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.auditAlertText}>
                    {documentAuditAlert.message}
                  </Text>

                  <View style={styles.auditAlertActions}>
                    <TouchableOpacity
                      style={styles.auditAlertButton}
                      onPress={() => setActivePage("Documents")}
                    >
                      <Text style={styles.auditAlertButtonText}>
                        Review Documents
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.auditAlertMeta}>
                      Unlinked: {auditSummary?.unlinkedCount || 0}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.cardsRow}>
                <View
                  style={[
                    styles.kpiCard,
                    styles.kpiCardPrimary,
                    {
                      backgroundColor: brandColor,
                      borderColor: brandColor,
                    },
                  ]}
                >
                  <View style={styles.kpiTopRow}>
                    <Text style={styles.kpiLabel}>Total Sales</Text>
                    <View style={styles.kpiBadge}>
                      <Text style={styles.kpiBadgeText}>Revenue</Text>
                    </View>
                  </View>

                  <Text style={styles.kpiValue}>
                    {formatCurrency(overview.totalSales)}
                  </Text>

                  <Text style={styles.kpiHint}>
                    Total sales recorded for the selected VAT period.
                  </Text>
                </View>

                <View style={styles.kpiCard}>
                  <View style={styles.kpiTopRow}>
                    <Text style={styles.kpiLabel}>Output VAT</Text>
                    <View style={styles.kpiBadge}>
                      <Text style={styles.kpiBadgeText}>Collected</Text>
                    </View>
                  </View>

                  <Text style={styles.kpiValue}>
                    {formatCurrency(overview.outputVAT)}
                  </Text>

                  <Text style={styles.kpiHint}>
                    VAT charged on taxable sales during this period.
                  </Text>
                </View>

                <View style={styles.kpiCard}>
                  <View style={styles.kpiTopRow}>
                    <Text style={styles.kpiLabel}>Input VAT</Text>
                    <View style={styles.kpiBadge}>
                      <Text style={styles.kpiBadgeText}>Recoverable</Text>
                    </View>
                  </View>

                  <Text style={styles.kpiValue}>
                    {formatCurrency(overview.inputVAT)}
                  </Text>

                  <Text style={styles.kpiHint}>
                    VAT paid on eligible purchases and expenses.
                  </Text>
                </View>

                <View style={[styles.kpiCard, styles.kpiCardPrimary]}>
                  <View style={styles.kpiTopRow}>
                    <Text style={styles.kpiLabelPrimary}>Net VAT Payable</Text>
                    <View style={styles.kpiBadgePrimary}>
                      <Text style={styles.kpiBadgePrimaryText}>Summary</Text>
                    </View>
                  </View>

                  <Text style={styles.kpiValuePrimary}>
                    {formatCurrency(overview.netVATPayable)}
                  </Text>

                  <Text style={styles.kpiHintPrimary}>
                    Output VAT less Input VAT for the selected period.
                  </Text>
                </View>
              </View>

              {/*<View style={styles.sectionSpacing}>
                <AddTransaction
                  key={selectedCompany?.id || "none"}
                  onSaved={handleTransactionSaved}
                />
              </View>
              */}
              {/*
              <View style={styles.sectionSpacing}>
                <ErrorBoundary>
                  <RecentTransactions
                    key={`${selectedCompany?.id || "none"}-${refreshKey}`}
                    refreshKey={refreshKey}
                    startDate={getDateRange().start || ""}
                    endDate={getDateRange().end || ""}
                  />
                </ErrorBoundary>
              </View>
              */}
            </ScrollView>
          </View>
        )}

        {activePage === "Transactions" && <TransactionsPage />}
        {activePage === "Purchases" && <Purchases />}
        {activePage === "Imports" && <ImportsScreen />}
        {activePage === "Documents" && <DocumentsScreen pageOptions={pageOptions} />}
        {activePage === "Reports" && <ReportsScreen />}
        {activePage === "Audit Dashboard" && (


          <AuditDashboardScreen pageOptions={pageOptions} />
        )}

        {activePage === "VAT Returns" && <VatReturnsScreen />}
        {activePage === "VAT Filing" && (
          <VatFilingScreen
            pageOptions={pageOptions}
            onNavigate={handleSelectPage}
          />
        )}
        {activePage === "VAT Filing History" && <VatFilingHistory />}
        {activePage === "Settings" && (
          <SettingsScreen selectedCompany={selectedCompany} />
        )}

        {activePage === "Create Company" && (
          <CreateCompanyScreen
            onCompanyCreated={(company) => {
              if (company) {
                setSelectedCompany(company);
              }

              setRefreshKey((prev) => prev + 1);
              fetchCompanies();
              setActivePage("Dashboard");
            }}
            onCancel={() => setActivePage("Dashboard")}
          />
        )}

        {activePage !== "Dashboard" &&
          activePage !== "Transactions" &&
          activePage !== "Purchases" &&
          activePage !== "Imports" &&
          activePage !== "Documents" &&
          activePage !== "Reports" &&
          activePage !== "Audit Dashboard" &&
          activePage !== "Settings" &&
          activePage !== "Create Company" &&
          activePage !== "VAT Returns" &&
          activePage !== "VAT Filing" &&
          activePage !== "VAT Filing History" && (
            <View>
              <View style={styles.topBar}>
                <Text style={styles.pageTitle}>
                  {activePage.toLowerCase()}
                </Text>
              </View>

              <View style={{ padding: 28 }}>
                <Text style={{ fontSize: 18, color: "#13294b" }}>
                  {activePage} page coming next.
                </Text>
              </View>
            </View>
          )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#f3f6fb",
  },
  loadingPage: {
    flex: 1,
    backgroundColor: "#f3f6fb",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#4b5b73",
    fontSize: 15,
  },
  main: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },
  topBar: {
    height: 82,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#dfe5ee",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    textTransform: "lowercase",
  },
  contentArea: {
    flex: 1,
  },
  contentContainer: {
    padding: 28,
    paddingBottom: 40,
  },


  heroCard: {
    backgroundColor: "#FFFFFF",
    padding: 28,
    marginBottom: 24,
  },
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroLeft: {
    flex: 1,
    paddingRight: 20,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "#2563EB",
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
    lineHeight: 48,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "#475569",
    lineHeight: 24,
    maxWidth: 620,
  },
  activeCompanyBadge: {
    marginTop: 20,
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  activeCompanyBadgeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  activeCompanyBadgeText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },

  auditHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  auditStatusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  auditStatusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  heroRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    minHeight: 120,
  },
  alertPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginBottom: 16,
  },
  alertDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F97316",
    marginRight: 10,
  },
  alertText: {
    fontSize: 15,
    color: "#9A3412",
    fontWeight: "700",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1D4ED8",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#1D4ED8",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  vatAlertCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    padding: 18,
    marginTop: 24,
  },
  vatAlertDueSoon: {
    borderColor: "#f59e0b",
    backgroundColor: "#fffaf0",
  },
  vatAlertOverdue: {
    borderColor: "#dc2626",
    backgroundColor: "#fef2f2",
  },
  vatAlertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  vatAlertTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  vatAlertDate: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 6,
  },
  vatAlertMessage: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  vatAlertBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  vatAlertBadgeDueSoon: {
    backgroundColor: "#fde68a",
  },
  vatAlertBadgeOverdue: {
    backgroundColor: "#fecaca",
  },
  vatAlertBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  heroControlsRow: {
    marginTop: 24,
  },
  heroControlBlock: {
    maxWidth: 460,
  },
  companyLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 10,
  },
  companyPickerWrap: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    overflow: "hidden",
    minHeight: 54,
    justifyContent: "center",
  },
  picker: {
    height: 54,
    width: "100%",
  },
  companyLoadingText: {
    paddingHorizontal: 16,
    color: "#64748B",
    fontSize: 14,
  },
  errorText: {
    marginBottom: 16,
    color: "#dc2626",
    fontSize: 14,
  },
  auditAlertCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  auditAlertLow: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  auditAlertWarning: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  auditAlertCritical: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  auditAlertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  auditAlertTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  auditAlertBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  auditAlertBadgeLow: {
    backgroundColor: "#2563EB",
  },
  auditAlertBadgeWarning: {
    backgroundColor: "#F97316",
  },
  auditAlertBadgeCritical: {
    backgroundColor: "#DC2626",
  },
  auditAlertBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  auditAlertText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#374151",
    marginBottom: 14,
  },
  auditAlertActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  auditAlertButton: {
    alignSelf: "flex-start",
    backgroundColor: "#111827",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  auditAlertButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  auditAlertMeta: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  auditScoreCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  auditScoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  auditScoreLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  auditScoreTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  auditScoreBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  auditScoreBadgeExcellent: {
    backgroundColor: "#16A34A",
  },
  auditScoreBadgeGood: {
    backgroundColor: "#2563EB",
  },
  auditScoreBadgeWarning: {
    backgroundColor: "#F97316",
  },
  auditScoreBadgeCritical: {
    backgroundColor: "#DC2626",
  },
  auditScoreBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  auditScoreMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: "#374151",
    marginBottom: 14,
  },
  auditScoreBarTrack: {
    width: "100%",
    height: 12,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
  },
  auditScoreBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  auditScoreBarExcellent: {
    backgroundColor: "#16A34A",
  },
  auditScoreBarGood: {
    backgroundColor: "#2563EB",
  },
  auditScoreBarWarning: {
    backgroundColor: "#F97316",
  },
  auditScoreBarCritical: {
    backgroundColor: "#DC2626",
  },
  auditScoreMeta: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  auditScoreFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  auditScoreLinkText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  periodCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#dfe5ee",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    color: "#13294b",
  },
  selectRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  selectOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },
  selectOptionActive: {
    backgroundColor: "#1d4ed8",
  },
  selectOptionText: {
    color: "#000000",
    fontWeight: "600",
  },
  selectOptionTextActive: {
    color: "#ffffff",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cccccc",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "#ffffff",
  },
  periodRow: {
    flexDirection: "row",
    gap: 10,
  },
  periodInput: {
    flex: 1,
  },
  cardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
  },
  kpiCard: {
    flexBasis: "23.8%",
    minWidth: 220,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 24,
    padding: 22,
    minHeight: 178,
    justifyContent: "space-between",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  kpiCardPrimary: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8",
  },
  kpiTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  kpiLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
  kpiLabelPrimary: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  kpiBadge: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  kpiBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
  },
  kpiBadgePrimary: {
    backgroundColor: "#FDE68A",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  kpiBadgePrimaryText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400E",
    textTransform: "uppercase",
  },
  kpiValue: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },
  kpiValuePrimary: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  kpiHint: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
  },
  kpiHintPrimary: {
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(255,255,255,0.85)",
  },
  sectionSpacing: {
    marginTop: 22,
  },
});