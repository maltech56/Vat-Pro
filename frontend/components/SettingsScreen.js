import React, { useEffect, useMemo, useState } from "react";
import CompanyBrandingSettings from "./CompanyBrandingSettings";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  getUser,
  getSelectedCompany,
  getToken,
  clearSession,
} from "../src/utils/session";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.maltechdigital.com/api";

const formatRole = (role) => {
  if (!role) return "";
  return role.charAt(0).toUpperCase() + role.slice(1);
};

export default function SettingsScreen({ selectedCompany: selectedCompanyProp }) {
  const user = useMemo(() => getUser(), []);
  const selectedCompany = selectedCompanyProp || getSelectedCompany();

  const [companyForm, setCompanyForm] = useState({
    companyName: "",
    taxId: "",
    vatRegistrationNumber: "",
    businessEmail: "",
    businessPhone: "",
    address: "",
  });

  const [vatForm, setVatForm] = useState({
    defaultVatRate: "10",
    filingFrequency: "Monthly",
    currency: "BSD",
    taxYearStart: "January",
    vatDueDay: "28",
  });

  const [userForm] = useState({
    fullName: user?.name || "",
    email: user?.email || "",
    role: user?.role || "",
  });

  const [appForm, setAppForm] = useState({
    dateFormat: "YYYY-MM-DD",
    rowsPerPage: "10",
    defaultReportTab: "Summary",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    // 🔥 FULL RESET on company change

    setCompanyForm({
      companyName: "",
      taxId: "",
      vatRegistrationNumber: "",
      businessEmail: "",
      businessPhone: "",
      address: "",
    });

    setVatForm({
      defaultVatRate: "10",
      filingFrequency: "Monthly",
      currency: "BSD",
      taxYearStart: "January",
      vatDueDay: "28",
    });

    setAppForm({
      dateFormat: "YYYY-MM-DD",
      rowsPerPage: "10",
      defaultReportTab: "Summary",
    });

    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

    setShowPasswordForm(false);
    setSaving(false);
    setChangingPassword(false);

    if (!selectedCompany?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchSettings();

  }, [selectedCompany?.id]);
  
  const fetchSettings = async () => {
    try {
      const token = getToken();
      const company = selectedCompany;

      if (!token) {
        Alert.alert("Error", "No token found. Please log in again.");
        setLoading(false);
        return;
      }

      if (!company?.id) {
        Alert.alert("Error", "No company selected.");
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${API_BASE}/settings/company/${company.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = response;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load settings");
      }

      if (data) {
        setCompanyForm({
          companyName: data.companyName || "",
          taxId: data.tin || "",
          vatRegistrationNumber: data.vatNumber || "",
          businessEmail: data.email || "",
          businessPhone: data.phone || "",
          address: data.address || "",
        });

        setVatForm({
          defaultVatRate: "10",
          filingFrequency: data.filingFrequency || "Monthly",
          currency: data.currency || "BSD",
          taxYearStart: data.taxYearStart || "January",
          vatDueDay: String(data.vatDueDay || 28),
        });

        setAppForm({
          dateFormat: data.dateFormat || "YYYY-MM-DD",
          rowsPerPage: String(data.rowsPerPage || 10),
          defaultReportTab: data.defaultReportTab || "Summary",
        });

      }
    } catch (error) {
      console.error("fetchSettings error:", error);
      Alert.alert("Error", error.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const token = getToken();
      const company = selectedCompany;

      if (!token) {
        Alert.alert("Error", "No token found. Please log in again.");
        return;
      }

      if (!company?.id) {
        Alert.alert("Error", "No company selected.");
        return;
      }

      const companyName = companyForm.companyName.trim();
      const businessEmail = companyForm.businessEmail.trim();
      const businessPhone = companyForm.businessPhone.trim();
      const taxId = companyForm.taxId.trim();
      const vatNumber = companyForm.vatRegistrationNumber.trim();

      // Normalize casing
      const filingFrequencyRaw = vatForm.filingFrequency.trim().toLowerCase();

      let filingFrequency = "";

      if (filingFrequencyRaw === "monthly") {
        filingFrequency = "Monthly";
      } else if (filingFrequencyRaw === "quarterly") {
        filingFrequency = "Quarterly";
      }
      const currency = vatForm.currency.trim().toUpperCase();

      if (!companyName) {
        Alert.alert("Validation Error", "Company name is required.");
        return;
      }

      if (!taxId) {
        Alert.alert("Validation Error", "Tax ID / TIN is required.");
        return;
      }

      if (!vatNumber) {
        Alert.alert("Validation Error", "VAT registration number is required.");
        return;
      }

      if (
        businessEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail)
      ) {
        Alert.alert("Validation Error", "Please enter a valid business email address.");
        return;
      }

      const vatDueDay = Number(vatForm.vatDueDay);
      if (!Number.isInteger(vatDueDay) || vatDueDay < 1 || vatDueDay > 31) {
        Alert.alert("Validation Error", "VAT due day must be a whole number between 1 and 31.");
        return;
      }

      const allowedFrequencies = ["Monthly", "Quarterly"];
      if (!allowedFrequencies.includes(filingFrequency)) {
        Alert.alert("Validation Error", "Filing frequency must be Monthly or Quarterly.");
        return;
      }

      const allowedCurrencies = ["BSD", "USD"];
      if (!allowedCurrencies.includes(currency)) {
        Alert.alert("Validation Error", "Currency must be BSD or USD.");
        return;
      }

      const allowedDateFormats = ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"];
      if (!allowedDateFormats.includes(appForm.dateFormat)) {
        Alert.alert("Validation Error", "Please use a supported date format.");
        return;
      }

      const allowedReportTabs = ["Summary", "Sales", "Purchases", "Transactions"];
      if (!allowedReportTabs.includes(appForm.defaultReportTab)) {
        Alert.alert("Validation Error", "Default report tab must be Summary, Sales, Purchases, or Transactions.");
        return;
      }

      const rowsPerPage = Number(appForm.rowsPerPage);

      if (!Number.isInteger(rowsPerPage) || rowsPerPage < 5 || rowsPerPage > 100) {
        Alert.alert("Validation Error", "Rows per page must be a whole number between 5 and 100.");
        return;
      }

      const hasChanges =
        companyName !== companyForm.companyName.trim() ||
        businessEmail !== (companyForm.businessEmail || "") ||
        businessPhone !== (companyForm.businessPhone || "") ||
        taxId !== (companyForm.taxId || "") ||
        vatNumber !== (companyForm.vatRegistrationNumber || "") ||
        vatDueDay !== Number(vatForm.vatDueDay) ||
        rowsPerPage !== Number(appForm.rowsPerPage);

      if (!hasChanges) {
        Alert.alert("No Changes", "No updates were made.");
        return;
      }

      setSaving(true);

      const response = await fetch(
        `${API_BASE}/settings/company/${company.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            companyName: companyForm.companyName.trim(),
            email: companyForm.businessEmail.trim(),
            phone: companyForm.businessPhone.trim(),
            address: companyForm.address.trim(),
            tin: companyForm.taxId.trim(),
            vatNumber: companyForm.vatRegistrationNumber.trim(),

            filingFrequency,
            currency,
            taxYearStart: vatForm.taxYearStart,

            dateFormat: appForm.dateFormat,
            rowsPerPage,
            defaultReportTab: appForm.defaultReportTab,

            vatDueDay,
          }),
        }
      );

      const data = response;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save settings");
      }

      await fetchSettings();
      Alert.alert("Success", "Settings saved successfully.");
    } catch (error) {
      console.error("handleSaveSettings error:", error);
      Alert.alert("Error", error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = () => {
    setShowPasswordForm((prev) => !prev);
  };

  const handleSubmitPasswordChange = async () => {
    try {
      const token = getToken();

      if (!token) {
        Alert.alert("Error", "No token found. Please log in again.");
        return;
      }

      if (
        !passwordForm.currentPassword ||
        !passwordForm.newPassword ||
        !passwordForm.confirmPassword
      ) {
        Alert.alert("Error", "Please complete all password fields.");
        return;
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        Alert.alert("Error", "New password and confirm password do not match.");
        return;
      }

      if (passwordForm.newPassword.length < 8) {
        Alert.alert("Error", "New password must be at least 8 characters.");
        return;
      }

      if (passwordForm.currentPassword === passwordForm.newPassword) {
        Alert.alert("Error", "New password must be different from your current password.");
        return;
      }

      setChangingPassword(true);

      const response = await fetch(`${API_BASE}/auth/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = response;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to change password");
      }

      Alert.alert("Success", "Password changed successfully.");

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setShowPasswordForm(false);
    } catch (error) {
      console.error("handleSubmitPasswordChange error:", error);
      Alert.alert("Error", error.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    try {
      clearSession?.();

      if (typeof global !== "undefined") {
        global.token = null;
      }

      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Logout failed:", error);
      Alert.alert("Error", "Failed to log out properly.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.loaderText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Settings</Text>
      <Text style={styles.pageSubtitle}>
        Manage company details, VAT preferences, app defaults, and security.
      </Text>

      <View style={styles.companyBadge}>
        <Text style={styles.companyBadgeLabel}>Selected Company</Text>
        <Text style={styles.companyBadgeName}>
          {selectedCompany?.name || "No company selected"}
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Company Settings</Text>

        <View style={styles.fieldGrid}>
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Company Name</Text>
            <TextInput
              style={styles.input}
              value={companyForm.companyName}
              onChangeText={(value) =>
                setCompanyForm((prev) => ({ ...prev, companyName: value }))
              }
              placeholder="Enter company name"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Tax ID / TIN</Text>
            <TextInput
              style={styles.input}
              value={companyForm.taxId}
              onChangeText={(value) =>
                setCompanyForm((prev) => ({ ...prev, taxId: value }))
              }
              placeholder="Enter tax ID"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>VAT Registration Number</Text>
            <TextInput
              style={styles.input}
              value={companyForm.vatRegistrationNumber}
              onChangeText={(value) =>
                setCompanyForm((prev) => ({
                  ...prev,
                  vatRegistrationNumber: value,
                }))
              }
              placeholder="Enter VAT registration number"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Business Email</Text>
            <TextInput
              style={styles.input}
              value={companyForm.businessEmail}
              onChangeText={(value) =>
                setCompanyForm((prev) => ({ ...prev, businessEmail: value }))
              }
              placeholder="Enter business email"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Business Phone</Text>
            <TextInput
              style={styles.input}
              value={companyForm.businessPhone}
              onChangeText={(value) =>
                setCompanyForm((prev) => ({ ...prev, businessPhone: value }))
              }
              placeholder="Enter business phone"
            />
          </View>

          <View style={[styles.fieldBlock, styles.fullWidth]}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={companyForm.address}
              onChangeText={(value) =>
                setCompanyForm((prev) => ({ ...prev, address: value }))
              }
              placeholder="Enter business address"
              multiline
            />
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>User Settings</Text>

        <View style={styles.fieldGrid}>
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={userForm.fullName}
              editable={false}
              placeholder="Enter full name"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={userForm.email}
              editable={false}
              placeholder="Enter email"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Role</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={formatRole(userForm.role)}
              editable={false}
            />
          </View>
        </View>
      </View>

      <CompanyBrandingSettings selectedCompany={selectedCompany} />

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>VAT Preferences</Text>

        <View style={styles.fieldGrid}>
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>VAT Rate</Text>
            <View style={styles.fixedComplianceBox}>
              <Text style={styles.fixedComplianceText}>
                10% (Fixed for compliance)
              </Text>
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Filing Frequency</Text>
            <TextInput
              style={styles.input}
              value={vatForm.filingFrequency}
              onChangeText={(value) =>
                setVatForm((prev) => ({ ...prev, filingFrequency: value }))
              }
              placeholder="Monthly or Quarterly"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Currency</Text>
            <TextInput
              style={styles.input}
              value={vatForm.currency}
              onChangeText={(value) =>
                setVatForm((prev) => ({ ...prev, currency: value }))
              }
              placeholder="BSD"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>VAT Due Day</Text>
            <TextInput
              style={styles.input}
              value={String(vatForm.vatDueDay || 28)}
              onChangeText={(value) =>
                setVatForm((prev) => ({ ...prev, vatDueDay: value }))
              }
              placeholder="28"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Tax Year Start</Text>
            <TextInput
              style={styles.input}
              value={vatForm.taxYearStart}
              onChangeText={(value) =>
                setVatForm((prev) => ({ ...prev, taxYearStart: value }))
              }
              placeholder="January"
            />
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>App Preferences</Text>

        <View style={styles.fieldGrid}>
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Date Format</Text>
            <TextInput
              style={styles.input}
              value={appForm.dateFormat}
              onChangeText={(value) =>
                setAppForm((prev) => ({ ...prev, dateFormat: value }))
              }
              placeholder="YYYY-MM-DD"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Rows Per Page</Text>
            <TextInput
              style={styles.input}
              value={appForm.rowsPerPage}
              onChangeText={(value) =>
                setAppForm((prev) => ({ ...prev, rowsPerPage: value }))
              }
              placeholder="10"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Default Report Tab</Text>
            <TextInput
              style={styles.input}
              value={appForm.defaultReportTab}
              onChangeText={(value) =>
                setAppForm((prev) => ({ ...prev, defaultReportTab: value }))
              }
              placeholder="Summary"
            />
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Security</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={handleChangePassword}
          >
            <Text style={styles.secondaryButtonText}>Change Password</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={handleLogout}
          >
            <Text style={styles.dangerButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showPasswordForm && (
        <View style={styles.passwordCard}>
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={passwordForm.currentPassword}
              onChangeText={(value) =>
                setPasswordForm((prev) => ({ ...prev, currentPassword: value }))
              }
              placeholder="Enter current password"
              secureTextEntry
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              value={passwordForm.newPassword}
              onChangeText={(value) =>
                setPasswordForm((prev) => ({ ...prev, newPassword: value }))
              }
              placeholder="Enter new password"
              secureTextEntry
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={passwordForm.confirmPassword}
              onChangeText={(value) =>
                setPasswordForm((prev) => ({ ...prev, confirmPassword: value }))
              }
              placeholder="Confirm new password"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, changingPassword && styles.saveButtonDisabled]}
            onPress={handleSubmitPasswordChange}
            disabled={changingPassword}
          >
            <Text style={styles.saveButtonText}>
              {changingPassword ? "Changing..." : "Update Password"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSaveSettings}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Saving..." : "Save Settings"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loaderWrap: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
  },
  passwordCard: {
    marginTop: 16,
    gap: 14,
  },
  loaderText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 14,
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 20,
  },
  companyBadge: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginBottom: 18,
  },
  companyBadgeLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 6,
  },
  companyBadgeName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 16,
  },
  fieldGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  fieldBlock: {
    minWidth: 240,
    flexGrow: 1,
  },
  fullWidth: {
    width: "100%",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0f172a",
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  readOnlyInput: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
  },
  fixedComplianceBox: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 46,
    justifyContent: "center",
  },
  fixedComplianceText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "700",
  },
  dangerButton: {
    backgroundColor: "#fee2e2",
  },
  dangerButtonText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
  saveButton: {
    backgroundColor: "#0f172a",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});