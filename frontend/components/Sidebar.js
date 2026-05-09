import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
export default function Sidebar({
  activeItem = "Dashboard",
  onSelectItem,
  auditSummary = {},
  vatAlert = null,
}) {
  const unlinkedCount = Number(auditSummary?.unlinkedCount || 0);
  const totalDocuments = Number(auditSummary?.totalDocuments || 0);

  const hasAuditRisk = totalDocuments === 0 || unlinkedCount > 0;

  const hasVatWarning =
    vatAlert?.status === "due_soon" || vatAlert?.status === "overdue";

  const items = [
    { label: "Dashboard", icon: "grid-outline" },

    {
      label: "Audit Dashboard",
      icon: "shield-checkmark-outline",
      badge: hasAuditRisk ? { text: "!", type: totalDocuments === 0 ? "danger" : "warning" } : null,
    },

    { label: "Transactions", icon: "swap-horizontal-outline" },
    { label: "Purchases", icon: "cart-outline" },
    { label: "VAT Returns", icon: "document-text-outline" },
    { label: "Imports", icon: "cloud-upload-outline" },

    {
      label: "Documents",
      icon: "folder-open-outline",
      badge: unlinkedCount > 0 ? { text: String(unlinkedCount), type: unlinkedCount >= 5 ? "danger" : "warning" } : null,
    },

    { label: "Reports", icon: "bar-chart-outline" },
    { label: "Settings", icon: "settings-outline" },
    { label: "Create Company", icon: "business-outline" },

    {
      label: "VAT Filing",
      icon: "receipt-outline",
      badge: hasVatWarning ? { text: "!", type: vatAlert?.status === "overdue" ? "danger" : "warning" } : null,
    },

    { label: "VAT Filing History", icon: "time-outline" },
  ];

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandBlock}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>M</Text>
        </View>

        <View>
          <Text style={styles.brandTitle}>Maltech</Text>
          <Text style={styles.brandSubtitle}>VAT Pro</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <ScrollView
        style={styles.navScroll}
        contentContainerStyle={styles.navList}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item) => {
          const isActive = activeItem === item.label;

          return (
            <TouchableOpacity
              key={item.label}
              onPress={() => {
                if (item.label === "Documents" && unlinkedCount > 0) {
                  onSelectItem("Documents", { focus: "unlinked" });
                  return;
                }

                if (item.label === "Audit Dashboard" && hasAuditRisk) {
                  onSelectItem("Audit Dashboard", { focus: "issues" });
                  return;
                }

                if (item.label === "VAT Filing" && hasVatWarning) {
                  onSelectItem("VAT Filing", { focus: "warning" });
                  return;
                }

                onSelectItem(item.label, {});
              }}
              style={[
                styles.menuItem,
                isActive && styles.menuItemActive,
              ]}
            >
              <View style={styles.menuLeft}>
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={isActive ? "#FFFFFF" : "#94A3B8"}
                  style={styles.menuIcon}
                />

                <Text
                  style={[
                    styles.menuText,
                    isActive && styles.menuTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </View>

              {item.badge !== null && item.badge !== undefined && item.badge !== "" && (
                <View
                  style={[
                    styles.badge,
                    item.badge.type === "danger" && styles.badgeDanger,
                    item.badge.type === "warning" && styles.badgeWarning,
                    item.badge.type === "success" && styles.badgeSuccess,
                  ]}
                >
                  <Text style={styles.badgeText}>{item.badge.text}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© Maltech Digital</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 260,
    backgroundColor: "#0F172A",
    paddingTop: 40,
    paddingHorizontal: 16,
    height: "100%",            // ✅ ensures full height
  },

  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    paddingHorizontal: 5,
  },
  badgeWarning: {
    backgroundColor: "#F59E0B",
  },
  badgeDanger: {
    backgroundColor: "#EF4444",
  },
  badgeSuccess: {
    backgroundColor: "#10B981",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },

  brandTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  brandSubtitle: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },

  divider: {
    height: 1,
    backgroundColor: "#1E293B",
    marginBottom: 16,
  },
  footer: {
    paddingTop: 16,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
  },

  footerText: {
    color: "#64748B",
    fontSize: 11,
    textAlign: "center",
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#3B82F6", // brand blue
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  logoText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  menuItemActive: {
    backgroundColor: "#1E3A8A",
  },

  menuText: {
    color: "#CBD5F5",
    fontSize: 14,
  },

  menuTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  menuIcon: {
    marginRight: 10,
  },

  navScroll: {
    flex: 1,
  },
  navList: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  navItem: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginBottom: 10,
  },
  navItemActive: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  navText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  navTextActive: {
    color: "#FFFFFF",
  },
});