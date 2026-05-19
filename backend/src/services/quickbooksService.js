const OAuthClient = require("intuit-oauth");

console.log("QB SERVICE INIT:", {
  clientId: !!process.env.QUICKBOOKS_CLIENT_ID,
  clientSecret: !!process.env.QUICKBOOKS_CLIENT_SECRET,
  redirectUri: process.env.QUICKBOOKS_REDIRECT_URI,
  env: process.env.QUICKBOOKS_ENVIRONMENT,
});

// QuickBooks OAuth Client
const oauthClient = new OAuthClient({
  clientId: process.env.QUICKBOOKS_CLIENT_ID,
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
  environment: process.env.QUICKBOOKS_ENVIRONMENT || "sandbox",
  redirectUri: process.env.QUICKBOOKS_REDIRECT_URI,
});

// Export the instance used in controllers
module.exports = oauthClient;