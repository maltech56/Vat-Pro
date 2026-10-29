"use strict";

// Convert an exact monetary value into integer cents.
// Reject missing values, negatives, and excess decimals.
const toCents = (value) => {
  if (value === null || value === undefined) {
    throw new Error("Monetary amount is required");
  }

  const text = String(value).trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error("Invalid monetary amount");
  }

  const [whole, fraction = ""] = text.split(".");
  const cents =
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"));

  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Monetary amount exceeds safe range");
  }

  return Number(cents);
};

const fromCents = (cents) => {
  if (!Number.isSafeInteger(cents)) {
    throw new Error("Invalid cents value");
  }

  return (cents / 100).toFixed(2);
};

module.exports = {
  toCents,
  fromCents
};