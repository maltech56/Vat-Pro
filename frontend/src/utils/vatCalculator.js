const roundMoney = (value) => {
  return Number((Number(value || 0) + Number.EPSILON).toFixed(2));
};

const calculateVAT = (amount, classification, vatRate = 0.10) => {
  const numericAmount = Number(amount || 0);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error("Invalid amount");
  }

  if (!["taxable", "zero_rated", "exempt"].includes(classification)) {
    throw new Error("Invalid classification");
  }

  if (classification !== "taxable") {
    return {
      amountExVat: roundMoney(numericAmount),
      vatAmount: 0,
      amountIncVat: roundMoney(numericAmount),
      vatRate: 0,
    };
  }

  const amountExVat = roundMoney(numericAmount);
  const vatAmount = roundMoney(amountExVat * vatRate);
  const amountIncVat = roundMoney(amountExVat + vatAmount);

  return {
    amountExVat,
    vatAmount,
    amountIncVat,
    vatRate,
  };
};

module.exports = { calculateVAT };