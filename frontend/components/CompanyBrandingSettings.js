import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { getToken } from "../src/utils/session";

const API_BASE = "http://localhost:5000/api";

export default function CompanyBrandingSettings({selectedCompany}) {
 
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [logoUrl, setLogoUrl] = useState("");
  const [homeScreenTitle, setHomeScreenTitle] = useState("");
  const [homeScreenSubtitle, setHomeScreenSubtitle] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0F3D91");
  const [defaultHomeTab, setDefaultHomeTab] = useState("dashboard");
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    if (!selectedCompany?.id) return;
      fetchBrandingSettings();
    
  }, [selectedCompany?.id]);

  const fetchBrandingSettings = async () => {
    try {
      setLoading(true);

      const token = getToken();

      if (!token) {
        Alert.alert("Session Error", "No token found. Please log in again.");
        return;
      }

      const response = await fetch(
        `${API_BASE}/settings/company/${selectedCompany.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load branding settings");
      }

      const settings = data.settings || {};

      setLogoUrl(settings.logoUrl || "");
      setHomeScreenTitle(settings.homeScreenTitle || "");
      setHomeScreenSubtitle(settings.homeScreenSubtitle || "");
      setPrimaryColor(settings.primaryColor || "#0F3D91");
      setDefaultHomeTab(settings.defaultHomeTab || "dashboard");
      setOnboardingComplete(Boolean(settings.onboardingComplete));
    } catch (error) {
      console.error("fetchBrandingSettings error:", error);
      Alert.alert("Error", error.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCompany?.id) {
      Alert.alert("Company Required", "Please select a company first.");
      return;
    }

    try {
      setSaving(true);

      const token = getToken();

      if (!token) {
        Alert.alert("Session Error", "No token found. Please log in again.");
        return;
      }

      const response = await fetch(
        `${API_BASE}/settings/company/${selectedCompany.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            logoUrl,
            homeScreenTitle,
            homeScreenSubtitle,
            primaryColor,
            defaultHomeTab,
            onboardingComplete,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save branding settings");
      }

      Alert.alert("Saved", "Company branding settings updated successfully.");
    } catch (error) {
      console.error("handleSave branding error:", error);
      Alert.alert("Error", error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (!selectedCompany?.id) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Company Branding</Text>
        <Text style={styles.emptyText}>No company selected.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator />
        <Text style={styles.emptyText}>Loading branding settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Company Branding</Text>
          <Text style={styles.subtitle}>
            Customize the company logo, dashboard title, and default home screen.
          </Text>
        </View>
      </View>

      <View style={styles.previewBox}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.logoPreview} />
        ) : (
          <View style={styles.logoFallback}>
            <Text style={styles.logoFallbackText}>
              {selectedCompany?.name?.charAt(0)?.toUpperCase() || "C"}
            </Text>
          </View>
        )}

        <View style={styles.previewTextWrap}>
          <Text style={[styles.previewTitle, { color: primaryColor }]}>
            {homeScreenTitle ||
              `${selectedCompany?.name || "Company"} VAT Dashboard`}
          </Text>
          <Text style={styles.previewSubtitle}>
            {homeScreenSubtitle ||
              "Track VAT filings, audit readiness, and supporting documents."}
          </Text>
        </View>
      </View>

      <Text style={styles.label}>Logo URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://example.com/logo.png"
        value={logoUrl}
        onChangeText={setLogoUrl}
      />

      <Text style={styles.label}>Home Screen Title</Text>
      <TextInput
        style={styles.input}
        placeholder={`${selectedCompany?.name || "Company"} VAT Dashboard`}
        value={homeScreenTitle}
        onChangeText={setHomeScreenTitle}
      />

      <Text style={styles.label}>Home Screen Subtitle</Text>
      <TextInput
        style={styles.input}
        placeholder="Track VAT filings, audit readiness, and supporting documents."
        value={homeScreenSubtitle}
        onChangeText={setHomeScreenSubtitle}
      />

      <Text style={styles.label}>Primary Color</Text>
      <TextInput
        style={styles.input}
        placeholder="#0F3D91"
        value={primaryColor}
        onChangeText={setPrimaryColor}
      />

      <Text style={styles.label}>Default Home Screen</Text>
      <View style={styles.tabGrid}>
        {[
          { label: "Dashboard", value: "dashboard" },
          { label: "Audit Dashboard", value: "audit" },
          { label: "Documents", value: "documents" },
          { label: "VAT Filing", value: "vatFiling" },
          { label: "Reports", value: "reports" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.value}
            style={[
              styles.tabButton,
              defaultHomeTab === tab.value && {
                backgroundColor: primaryColor || "#0F3D91",
                borderColor: primaryColor || "#0F3D91",
              },
            ]}
            onPress={() => setDefaultHomeTab(tab.value)}
          >
            <Text
              style={[
                styles.tabButtonText,
                defaultHomeTab === tab.value && styles.tabButtonTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setOnboardingComplete((prev) => !prev)}
      >
        <View
          style={[
            styles.checkbox,
            onboardingComplete && {
              backgroundColor: primaryColor || "#0F3D91",
              borderColor: primaryColor || "#0F3D91",
            },
          ]}
        >
          {onboardingComplete && <Text style={styles.checkboxTick}>✓</Text>}
        </View>
        <Text style={styles.checkboxText}>Mark onboarding as complete</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.saveButton,
          { backgroundColor: primaryColor || "#0F3D91" },
          saving && styles.disabledButton,
        ]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Saving..." : "Save Branding Settings"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  headerRow: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
  },
  previewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  logoPreview: {
    width: 58,
    height: 58,
    borderRadius: 12,
    resizeMode: "contain",
    backgroundColor: "#FFFFFF",
  },
  logoFallback: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  logoFallbackText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  previewTextWrap: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 13,
    color: "#6B7280",
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#111827",
  },
  tabGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  tabButton: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  tabButtonTextActive: {
    color: "#FFFFFF",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxTick: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  checkboxText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  saveButton: {
    marginTop: 20,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
});