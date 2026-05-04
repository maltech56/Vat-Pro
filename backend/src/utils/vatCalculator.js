const FIXED_VAT_RATE = 0.10;

const VALID_CLASSIFICATIONS = ["taxable", "zero_rated", "exempt"];

const roundMoney = (value) => {
  return Number((Number(value || 0) + Number.EPSILON).toFixed(2));
};

const normalizeClassification = (value) => {
  return String(value || "").trim().toLowerCase();
};

const calculateVAT = (amount, classification) => {
  const numericAmount = Number(amount || 0);
  const normalizedClassification = normalizeClassification(classification);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error("Invalid amount");
  }

  if (!VALID_CLASSIFICATIONS.includes(normalizedClassification)) {
    throw new Error("Invalid VAT classification");
  }

  if (normalizedClassification === "zero_rated" || normalizedClassification === "exempt") {
    return {
      amountExVat: roundMoney(numericAmount),
      vatAmount: 0,
      amountIncVat: roundMoney(numericAmount),
      vatRate: 0,
      vatRatePercent: 0,
      classification: normalizedClassification,
    };
  }

  const vatAmount = roundMoney(numericAmount * FIXED_VAT_RATE);

  return {
    amountExVat: roundMoney(numericAmount),
    vatAmount,
    amountIncVat: roundMoney(numericAmount + vatAmount),
    vatRate: FIXED_VAT_RATE,
    vatRatePercent: 10,
    classification: normalizedClassification,
  };
};

module.exports = {
  FIXED_VAT_RATE,
  VALID_CLASSIFICATIONS,
  calculateVAT,
  normalizeClassification,
  roundMoney,
};