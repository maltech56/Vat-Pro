import React, { useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Picker } from "@react-native-picker/picker";

export default function TransactionForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitText = "Save Transaction",
  cancelText = "Cancel",
  showCancel = false,
  loading = false,
}) {
  useEffect(() => {
    const amountNumber = parseFloat(form.amountExVat) || 0;

    let calculatedVat = "0.00";

    if (form.classification === "taxable") {
      calculatedVat = (amountNumber * 0.1).toFixed(2);
    }

    if (String(form.vatAmount) !== String(calculatedVat)) {
      onChange("vatAmount", calculatedVat);
    }
  }, [form.amountExVat, form.classification]);

  const amountNumber = isNaN(parseFloat(form.amountExVat))
    ? 0
    : parseFloat(form.amountExVat);

  const vatNumber = parseFloat(form.vatAmount) || 0;
  const totalInclVat = amountNumber + vatNumber;

  return (
    <View style={styles.formCard}>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Transaction Type</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={form.type || "sale"}
            onValueChange={(value) => onChange("type", value)}
          >
            <Picker.Item label="Sale" value="sale" />
            <Picker.Item label="Expense" value="expense" />
          </Picker>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Amount (Excl. VAT)</Text>
        <TextInput
          style={styles.input}
          value={form.amountExVat}
          onChangeText={(text) => onChange("amountExVat", text)}
          placeholder="Amount (Ex VAT)"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>VAT Amount</Text>
        <TextInput
          style={[styles.input, styles.readOnlyInput]}
          value={form.vatAmount}
          placeholder="VAT auto-calculated"
          editable={false}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Total (Incl. VAT)</Text>
        <TextInput
          style={[styles.input, styles.readOnlyInput]}
          value={totalInclVat.toFixed(2)}
          placeholder="Total including VAT"
          editable={false}
        />
      </View>

      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>
          VAT (10%): {vatNumber.toFixed(2)}
        </Text>
        <Text style={styles.previewTotal}>
          Total (Incl. VAT): {totalInclVat.toFixed(2)}
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Classification</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={form.classification}
            onValueChange={(value) => onChange("classification", value)}
          >
            <Picker.Item label="Taxable (Standard VAT)" value="taxable" />
            <Picker.Item label="Zero Rated (0%)" value="zero_rated" />
            <Picker.Item label="Exempt (No VAT)" value="exempt" />
          </Picker>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Transaction Date</Text>
        <TextInput
          style={styles.input}
          value={form.transactionDate}
          onChangeText={(text) => onChange("transactionDate", text)}
          placeholder="YYYY-MM-DD"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={form.description}
          onChangeText={(text) => onChange("description", text)}
          placeholder="Enter description"
          multiline
        />
      </View>

      <View style={styles.buttonRow}>
        {showCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>{cancelText}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.submitButton,
            loading ? styles.submitButtonDisabled : null,
          ]}
          onPress={onSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? "Saving..." : submitText}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: "#F9FAFB",
    color: "#111827",
  },
  readOnlyInput: {
    opacity: 0.8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    overflow: "hidden",
  },
  previewCard: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  previewLabel: {
    fontSize: 14,
    color: "#4B5563",
  },
  previewTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginTop: 4,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    marginRight: 10,
  },
  cancelButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
  submitButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#111827",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});