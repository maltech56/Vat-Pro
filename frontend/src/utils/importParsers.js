import * as DocumentPicker from "expo-document-picker";
export async function pickImportDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: false,
    copyToCacheDirectory: true,
    type: [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/pdf",
    ],
  });

  if (result.canceled) return null;

  return result.assets?.[0] || null;
}


