const OAuthClient = require("intuit-oauth");

console.log("QB SERVICE INIT:", {
  clientId: !!process.env.QUICKBOOKS_CLIENT_ID,
  clientSecret: !!process.env.QUICKBOOKS_CLIENT_SECRET,
  redirectUri: process.env.QUICKBOOKS_REDIRECT_URI,
  env: process.env.QUICKBOOKS_ENVIRONMENT,
});

const quickBooksEnvironment = process.env.QUICKBOOKS_ENVIRONMENT || "sandbox";
if (!["sandbox", "production"].includes(quickBooksEnvironment)) {
  throw new Error("Invalid QUICKBOOKS_ENVIRONMENT; expected sandbox or production");
}
const quickBooksApiBase = quickBooksEnvironment === "production"
  ? "https://quickbooks.api.intuit.com"
  : "https://sandbox-quickbooks.api.intuit.com";

// QuickBooks OAuth Client
const oauthClient = new OAuthClient({
  clientId: process.env.QUICKBOOKS_CLIENT_ID,
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
  environment: quickBooksEnvironment,
  redirectUri: process.env.QUICKBOOKS_REDIRECT_URI,
});

// Export the instance used in controllers
module.exports = oauthClient;
module.exports.quickBooksApiBase = quickBooksApiBase;