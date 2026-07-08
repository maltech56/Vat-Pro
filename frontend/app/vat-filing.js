import { API_BASE } from "../src/api/config";
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { getToken } from "../src/utils/session";
import { useCompany } from "../context/CompanyContext";
import { formatCurrency } from "../src/utils/formatters";

export default function VatFilingScreen({ onNavigate }) {
  const { selectedCompany, companyReady } = useCompany();

  const [tin, setTin] = useState("");
  const [auditReadiness, setAuditReadiness] = useState(null);
  const [periodType, setPeriodType] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  const [selectedYear, setSelectedYear] = useState(
    String(new Date().getFullYear())
  );
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [taxableSales, setTaxableSales] = useState("");
  const [zeroRatedSales, setZeroRatedSales] = useState("");
  const [exemptSales, setExemptSales] = useState("");
  const [outputVAT, setOutputVAT] = useState("");
  const [inputVAT, setInputVAT] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [authorizedOfficer, setAuthorizedOfficer] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [auditScore, setAuditScore] = useState(0);
  const [unlinkedTransactions, setUnlinkedTransactions] = useState(0);

  useEffect(() => {
    if (!companyReady) return;

    if (!selectedCompany?.id) {
      setAuditReadiness(null);
      setTin("");
      return;
    }
    setAuditReadiness(null);
    fetchAuditReadiness();

    // ✅ Reset + hydrate TIN
    setTin(selectedCompany?.tin || selectedCompany?.taxId || "");

    setPeriodType("monthly");
    setSelectedMonth("");
    setSelectedQuarter("Q1");
    setSelectedYear(String(new Date().getFullYear()));
    setCustomStartDate("");
    setCustomEndDate("");

    // ✅ Reset VAT figures
    setTaxableSales("");
    setZeroRatedSales("");
    setExemptSales("");
    setOutputVAT("");
    setInputVAT("");
    setLoadingSummary(false);

    // ✅ Reset declaration section
    setAuthorizedOfficer("");
    setPositionTitle("");
    setDeclarationAccepted(false);

    // ✅ Reset preview
    setPreviewVisible(false);
  }, [companyReady, selectedCompany?.id]);

  const getDateRange = () => {
    if (periodType === "monthly") {
      if (!selectedMonth || !selectedMonth.includes("-")) {
        return { start: "", end: "" };
      }

      const [year, month] = selectedMonth.split("-");

      if (!year || !month) {
        return { start: "", end: "" };
      }

      const start = `${year}-${month}-01`;
      const endDateObj = new Date(Number(year), Number(month), 0);

      if (isNaN(endDateObj.getTime())) {
        return { start: "", end: "" };
      }

      const end = endDateObj.toISOString().slice(0, 10);

      return { start, end };
    }

    if (periodType === "quarterly") {
      if (!selectedYear || !selectedQuarter) {
        return { start: "", end: "" };
      }

      const ranges = {
        Q1: ["01-01", "03-31"],
        Q2: ["04-01", "06-30"],
        Q3: ["07-01", "09-30"],
        Q4: ["10-01", "12-31"],
      };

      const [startSuffix, endSuffix] = ranges[selectedQuarter] || ranges.Q1;

      return {
        start: `${selectedYear}-${startSuffix}`,
        end: `${selectedYear}-${endSuffix}`,
      };
    }

    if (periodType === "custom") {
      if (!customStartDate || !customEndDate) {
        return { start: "", end: "" };
      }

      return {
        start: customStartDate,
        end: customEndDate,
      };
    }

    return { start: "", end: "" };
  };

  const filingPeriodLabel = useMemo(() => {
    if (periodType === "monthly") {
      return selectedMonth || "Not selected";
    }

    if (periodType === "quarterly") {
      return `${selectedQuarter} ${selectedYear}`;
    }

    const { start, end } = getDateRange();
    if (!start && !end) return "Not selected";
    return `${start || "?"} to ${end || "?"}`;
  }, [
    periodType,
    selectedMonth,
    selectedQuarter,
    selectedYear,
    customStartDate,
    customEndDate,
  ]);

  const numericTaxableSales = Number(taxableSales || 0);
  const numericZeroRatedSales = Number(zeroRatedSales || 0);
  const numericExemptSales = Number(exemptSales || 0);
  const numericOutputVAT = Number(outputVAT || 0);
  const numericInputVAT = Number(inputVAT || 0);
  const netVATPayable = numericOutputVAT - numericInputVAT;

  const fetchVatSummary = async (startDate, endDate) => {
    try {
      const token = getToken();

      if (!token || !selectedCompany?.id || !startDate || !endDate) {
        return;
      }

      setLoadingSummary(true);

      const response = await fetch(
        `${API_BASE}/dashboard/company/${selectedCompany.id}/overview?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch VAT summary");
      }

      setTaxableSales(String(data.taxableSales ?? data.totalSales ?? 0));
      setZeroRatedSales(String(data.zeroRatedSales ?? 0));
      setExemptSales(String(data.exemptSales ?? 0));
      setOutputVAT(String(data.outputVAT ?? data.outputVat ?? 0));
      setInputVAT(String(data.inputVAT ?? data.inputVat ?? 0));
    } catch (error) {
      console.error("VAT summary fetch error:", error);
      Alert.alert(
        "VAT Summary Error",
        error.message || "Failed to load VAT summary."
      );
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    const { start, end } = getDateRange();

    if (selectedCompany?.id && start && end) {
      fetchVatSummary(start, end);
    }
  }, [
    selectedCompany?.id,
    periodType,
    selectedMonth,
    selectedQuarter,
    selectedYear,
    customStartDate,
    customEndDate,
  ]);

  useEffect(() => {
    setPreviewVisible(false);
  }, [
    tin,
    periodType,
    selectedMonth,
    selectedQuarter,
    selectedYear,
    customStartDate,
    customEndDate,
    taxableSales,
    zeroRatedSales,
    exemptSales,
    outputVAT,
    inputVAT,
    authorizedOfficer,
    positionTitle,
    declarationAccepted,
  ]);

  const handlePreview = () => {
    const { start, end } = getDateRange();

    if (!tin.trim()) {
      Alert.alert("Missing TIN", "Please enter the company TIN.");
      return;
    }

    if (!start || !end) {
      Alert.alert(
        "Missing filing period",
        "Please complete the filing period details."
      );
      return;
    }

    setPreviewVisible(true);
  };

  const fetchAuditReadiness = async () => {
    try {
      const token = getToken();
      if (!token || !selectedCompany?.id) return;

      const response = await fetch(
        `${API_BASE}/documents/company/${selectedCompany.id}/audit-readiness`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch audit readiness");
      }

      setAuditReadiness(data);
    } catch (error) {
      console.error("Audit readiness fetch error:", error);
      setAuditReadiness(null);
    }
  };
  const continueGenerate = async () => {
    try {
      // duplicate ONLY the part AFTER audit checks

      let filingId = null;

      const token = getToken();
      const { start, end } = getDateRange();

      const saveResponse = await fetch(`${API_BASE}/vat-filings/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId: selectedCompany?.id,
          startDate: start,
          endDate: end,
          filingPeriodLabel,
          taxableSales: Number(taxableSales || 0),
          zeroRatedSales: Number(zeroRatedSales || 0),
          exemptSales: Number(exemptSales || 0),
          totalSales:
            Number(taxableSales || 0) +
            Number(zeroRatedSales || 0) +
            Number(exemptSales || 0),
          totalPurchases: 0,
          outputVat: Number(outputVAT || 0),
          inputVat: Number(inputVAT || 0),
          netVat: Number(netVATPayable || 0),
          status: "draft",
          tin,
          authorizedOfficer,
          positionTitle,
          declarationAccepted,
        }),
      });

      if (saveResponse.status === 409) {
        const data = await saveResponse.json();
        filingId = data?.existingFiling?.id || null;
      } else {
        const data = await saveResponse.json();
        filingId = data?.filing?.id || null;
      }

      const pdfResponse = await fetch(
        `${API_BASE}/vat-filings/${filingId}/filing-pack`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (typeof window !== "undefined") {
        const blob = await pdfResponse.blob();
        const fileUrl = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = fileUrl;
        a.download = `vat-filing-pack-${filingId}.pdf`;

        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(fileUrl);

        Alert.alert("Success", "Filing pack generated successfully.");
        return;
      }

      Alert.alert("Success", "VAT filing saved and filing pack generated.");
    } catch (error) {
      console.error(error);
    }
  };

  const goToUnlinkedDocuments = () => {
    if (typeof onNavigate === "function") {
      onNavigate("Documents", { focus: "unlinked" });
      return;
    }

    Alert.alert(
      "Open Documents",
      "Please open Documents and review unlinked files."
    );
  };


  const handleGenerate = async () => {
    try {
      const token = getToken();

      if (!token) {
        Alert.alert("Missing token", "Please log in again.");
        return;
      }

      if (!selectedCompany?.id) {
        Alert.alert("Missing company", "No company selected.");
        return;
      }

      const { start, end } = getDateRange();

      if (!tin.trim()) {
        Alert.alert("Missing TIN", "Please enter the company TIN.");
        return;
      }

      if (!start || !end) {
        Alert.alert(
          "Missing filing period",
          "Please complete the filing period details."
        );
        return;
      }

      if (!authorizedOfficer.trim()) {
        Alert.alert(
          "Missing authorized officer",
          "Please enter the name of the authorized officer."
        );
        return;
      }

      if (!positionTitle.trim()) {
        Alert.alert(
          "Missing position title",
          "Please enter the officer's position title."
        );
        return;
      }

      if (!declarationAccepted) {
        Alert.alert(
          "Declaration required",
          "Please confirm the declaration before continuing."
        );
        return;
      }

      // ===============================
      // AUDIT READINESS CONTROL
      // ===============================

      // 🔴 HARD BLOCK — must fix
      if (auditReadiness && auditReadiness.auditScore < 50) {
        Alert.alert(
          "Audit Readiness Too Low",
          `Audit score is ${auditReadiness.auditScore}%. You must link documents before filing.`,
          [
            {
              text: "Review Documents",
              onPress: goToUnlinkedDocuments,
            },
          ]
        );
        return;
      }

      // 🟠 WARNING — allow override
      if (auditReadiness && auditReadiness.auditScore < 80) {
        Alert.alert(
          "Audit Warning",
          `Audit Score: ${auditReadiness.auditScore}%\n\nSome transactions are missing documents.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Review Documents",
              onPress: goToUnlinkedDocuments,
            },
            {
              text: "Continue Anyway",
              onPress: () => continueGenerate(),
            },
          ]
        );
        return;
      }
      let filingId = null;

      const saveResponse = await fetch(`${API_BASE}/vat-filings/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId: selectedCompany?.id,
          startDate: start,
          endDate: end,
          filingPeriodLabel,
          taxableSales: Number(taxableSales || 0),
          zeroRatedSales: Number(zeroRatedSales || 0),
          exemptSales: Number(exemptSales || 0),
          totalSales:
            Number(taxableSales || 0) +
            Number(zeroRatedSales || 0) +
            Number(exemptSales || 0),
          totalPurchases: 0,
          outputVat: Number(outputVAT || 0),
          inputVat: Number(inputVAT || 0),
          netVat: Number(netVATPayable || 0),
          status: "draft",
          tin,
          authorizedOfficer,
          positionTitle,
          declarationAccepted,
        }),
      });

      if (saveResponse.status === 409) {
        const data = await saveResponse.json();

        Alert.alert(
          "Duplicate Filing",
          data.error || "Filing already exists. Generating existing filing pack."
        );

        filingId = data?.existingFiling?.id || null;
      } else if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save VAT filing");
      } else {
        const data = await saveResponse.json();
        filingId = data?.filing?.id || null;
      }

      if (!filingId) {
        throw new Error("No filing ID available for filing pack generation.");
      }

      const pdfResponse = await fetch(
        `${API_BASE}/vat-filings/${filingId}/filing-pack`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!pdfResponse.ok) {
        const rawText = await pdfResponse.text();
        console.error("Filing pack PDF failed:", rawText);
        throw new Error(`Failed to generate filing pack (${pdfResponse.status})`);
      }

      const contentType = pdfResponse.headers.get("content-type");

      if (!contentType || !contentType.includes("application/pdf")) {
        const rawText = await pdfResponse.text();
        console.error("Expected PDF but got:", rawText);
        throw new Error("Server did not return a PDF file.");
      }

      if (typeof window !== "undefined") {
        const blob = await pdfResponse.blob();
        const fileUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = fileUrl;
        a.download = `vat-filing-pack-${filingId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(fileUrl);

        Alert.alert("Success", "Filing pack generated successfully.");
        return;
      }

      Alert.alert("Success", "VAT filing saved and filing pack generated.");
    } catch (error) {
      console.error("VAT filing generation error:", error);
      Alert.alert(
        "Generation failed",
        error.message || "Failed to save filing or generate filing pack."
      );
    }
  };

  if (!companyReady) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.subTitle}>Loading VAT Filing...</Text>
        </View>
      </View>
    );
  }

  if (!selectedCompany?.id) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.pageTitle}>VAT Filing</Text>
          <Text style={styles.subTitle}>No company selected.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>VAT Filing Screen</Text>
      <Text style={styles.subTitle}>
        Bahamas VAT return preparation workspace
      </Text>

      {auditReadiness && auditReadiness.auditScore < 90 && (
        <View style={{
          backgroundColor: "#fff7ed",
          borderColor: "#fed7aa",
          borderWidth: 1,
          padding: 12,
          borderRadius: 10,
          marginBottom: 12,
        }}>
          <Text style={{ fontWeight: "700", color: "#9a3412" }}>
            Audit Warning
          </Text>
          <Text style={{ color: "#7c2d12" }}>
            Audit Score: {auditReadiness.auditScore}% — {auditReadiness.auditStatus}
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Company & Filing Period</Text>

        <Text style={styles.label}>Company</Text>
        <Text style={styles.readOnlyValue}>
          {selectedCompany?.name ||
            selectedCompany?.company_name ||
            "Selected Company"}
        </Text>

        <Text style={styles.label}>TIN</Text>
        <TextInput
          style={styles.input}
          value={tin}
          onChangeText={setTin}
          placeholder="Enter TIN"
        />

        <Text style={styles.label}>Period Type</Text>
        <View style={styles.optionRow}>
          {["monthly", "quarterly", "custom"].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.optionButton,
                periodType === type && styles.optionButtonActive,
              ]}
              onPress={() => setPeriodType(type)}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  periodType === type && styles.optionButtonTextActive,
                ]}
              >
                {type.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {periodType === "monthly" && (
          <>
            <Text style={styles.label}>Month</Text>
            <TextInput
              style={styles.input}
              value={selectedMonth}
              onChangeText={setSelectedMonth}
              placeholder="YYYY-MM"
            />
          </>
        )}

        {periodType === "quarterly" && (
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Quarter</Text>
              <TextInput
                style={styles.input}
                value={selectedQuarter}
                onChangeText={setSelectedQuarter}
                placeholder="Q1"
              />
            </View>

            <View style={styles.half}>
              <Text style={styles.label}>Year</Text>
              <TextInput
                style={styles.input}
                value={selectedYear}
                onChangeText={setSelectedYear}
                placeholder="2026"
              />
            </View>
          </View>
        )}

        {periodType === "custom" && (
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Start Date</Text>
              <TextInput
                style={styles.input}
                value={customStartDate}
                onChangeText={setCustomStartDate}
                placeholder="YYYY-MM-DD"
              />
            </View>

            <View style={styles.half}>
              <Text style={styles.label}>End Date</Text>
              <TextInput
                style={styles.input}
                value={customEndDate}
                onChangeText={setCustomEndDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
        )}

        <Text style={styles.label}>Resolved Filing Period</Text>
        <Text style={styles.readOnlyValue}>{filingPeriodLabel}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>VAT Figures</Text>

        {loadingSummary && (
          <Text style={styles.loadingText}>
            Loading VAT totals from transactions...
          </Text>
        )}

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>1. Taxable Sales</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={taxableSales}
              editable={false}
              selectTextOnFocus={false}
              placeholder="0.00"
            />
          </View>

          <View style={styles.half}>
            <Text style={styles.label}>2. Zero-Rated Sales</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={zeroRatedSales}
              editable={false}
              selectTextOnFocus={false}
              placeholder="0.00"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>3. Exempt Sales</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={exemptSales}
              editable={false}
              selectTextOnFocus={false}
              placeholder="0.00"
            />
          </View>

          <View style={styles.half}>
            <Text style={styles.label}>4. Output VAT</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={outputVAT}
              editable={false}
              selectTextOnFocus={false}
              placeholder="0.00"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>5. Input VAT</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={inputVAT}
              editable={false}
              selectTextOnFocus={false}
              placeholder="0.00"
            />
          </View>

          <View style={styles.half}>
            <Text style={styles.label}>6. Net VAT Payable</Text>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>
                {formatCurrency(netVATPayable)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Taxable Sales</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(numericTaxableSales)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Zero-Rated Sales</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(numericZeroRatedSales)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Exempt Sales</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(numericExemptSales)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Declaration</Text>

        <Text style={styles.label}>Authorized Officer</Text>
        <TextInput
          style={styles.input}
          value={authorizedOfficer}
          onChangeText={setAuthorizedOfficer}
          placeholder="Full name"
        />

        <Text style={styles.label}>Position Title</Text>
        <TextInput
          style={styles.input}
          value={positionTitle}
          onChangeText={setPositionTitle}
          placeholder="e.g. Director / Manager / Accountant"
        />

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setDeclarationAccepted((prev) => !prev)}
        >
          <View
            style={[
              styles.checkbox,
              declarationAccepted && styles.checkboxActive,
            ]}
          />
          <Text style={styles.checkboxText}>
            I declare that the information contained in this VAT filing summary
            is true and complete to the best of my knowledge.
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handlePreview}>
          <Text style={styles.secondaryButtonText}>Preview Filing</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            auditReadiness?.auditScore < 70 && { opacity: 0.5 }
          ]}
          onPress={handleGenerate}
          disabled={false}
        >
          <Text style={styles.primaryButtonText}>
            {auditReadiness?.auditScore < 70
              ? "Fix Audit Issues to Continue"
              : "Generate Filing Pack"}
          </Text>
        </TouchableOpacity>
      </View>

      {previewVisible && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Filing Preview</Text>

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Company</Text>
            <Text style={styles.previewValue}>
              {selectedCompany?.name ||
                selectedCompany?.company_name ||
                "Selected Company"}
            </Text>
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>TIN</Text>
            <Text style={styles.previewValue}>{tin || "-"}</Text>
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Filing Period</Text>
            <Text style={styles.previewValue}>{filingPeriodLabel}</Text>
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Taxable Sales</Text>
            <Text style={styles.previewValue}>
              {formatCurrency(numericTaxableSales)}
            </Text>
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Zero-Rated Sales</Text>
            <Text style={styles.previewValue}>
              {formatCurrency(numericZeroRatedSales)}
            </Text>
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Exempt Sales</Text>
            <Text style={styles.previewValue}>
              {formatCurrency(numericExemptSales)}
            </Text>
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Output VAT</Text>
            <Text style={styles.previewValue}>
              {formatCurrency(numericOutputVAT)}
            </Text>
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Input VAT</Text>
            <Text style={styles.previewValue}>
              {formatCurrency(numericInputVAT)}
            </Text>
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Net VAT Payable</Text>
            <Text style={styles.previewValueStrong}>
              {formatCurrency(netVATPayable)}
            </Text>
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Authorized Officer</Text>
            <Text style={styles.previewValue}>{authorizedOfficer || "-"}</Text>
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Position Title</Text>
            <Text style={styles.previewValue}>{positionTitle || "-"}</Text>
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Declaration</Text>
            <Text style={styles.previewValue}>
              {declarationAccepted ? "Accepted" : "Not accepted"}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#13294b",
    marginBottom: 6,
  },
  subTitle: {
    fontSize: 14,
    color: "#4b5b73",
    marginBottom: 18,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#dfe5ee",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#13294b",
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4b5b73",
    marginBottom: 8,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d0d7e2",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  readOnlyInput: {
    backgroundColor: "#f8fafc",
    color: "#475569",
  },
  readOnlyValue: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    color: "#13294b",
    fontWeight: "600",
  },
  loadingText: {
    color: "#1d4ed8",
    fontWeight: "600",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  half: {
    flex: 1,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  optionButton: {
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  optionButtonActive: {
    backgroundColor: "#1d4ed8",
  },
  optionButtonText: {
    color: "#111827",
    fontWeight: "700",
  },
  optionButtonTextActive: {
    color: "#ffffff",
  },
  summaryBox: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: "center",
    minHeight: 48,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#15803d",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  summaryCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#13294b",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#94a3b8",
    borderRadius: 4,
    marginTop: 2,
    backgroundColor: "#ffffff",
  },
  checkboxActive: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  checkboxText: {
    flex: 1,
    color: "#334155",
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#e5e7eb",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "800",
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    flex: 1,
  },
  previewValue: {
    fontSize: 14,
    color: "#0f172a",
    flex: 1,
    textAlign: "right",
  },
  previewValueStrong: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f766e",
    flex: 1,
    textAlign: "right",
  },
});