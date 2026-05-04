export const DEFAULT_VAT_RATE = 0.1;

export const calculateVAT = (amount, classification, rate = DEFAULT_VAT_RATE) => {
  const numericAmount = Number(amount || 0);

  if (!numericAmount || Number.isNaN(numericAmount)) {
    return 0;
  }

  if (classification === "zero_rated" || classification === "exempt") {
    return 0;
  }

  if (classification === "taxable") {
    return Number((numericAmount * rate).toFixed(2));
  }

  return 0;
};