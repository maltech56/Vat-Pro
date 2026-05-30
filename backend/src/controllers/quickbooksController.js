const pool = require("../config/db");
const oauthClient = require("../services/quickbooksService");
const OAuthClient = require("intuit-oauth");

exports.connectQuickBooks = async (req, res) => {
    console.log("🔥 CONNECT QUICKBOOKS HIT");

    console.log("REQ USER:", req.user);
    console.log("REQ QUERY:", req.query);

    try {
        const companyId = req.query.companyId;

        if (!companyId) {
            console.log("MISSING COMPANY ID");
            return res.status(400).json({ error: "Company ID is required" });
        }

        if (!req.user || !req.user.id) {
            console.log("MISSING AUTH USER");
            return res.status(401).json({ error: "Unauthorized - missing user" });
        }

        const state = Buffer.from(
            JSON.stringify({
                companyId,
                userId: req.user.id,
            })
        ).toString("base64");

        console.log("GENERATING QUICKBOOKS AUTH URL...");

        const authUri = oauthClient.authorizeUri({
            scope: [OAuthClient.scopes.Accounting],
            state,
        });

        console.log("AUTH URI GENERATED:", authUri);

        return res.json({
            authUri,
        });

    } catch (error) {
        console.error("FULL QUICKBOOKS ERROR:", error);
        console.error("STACK:", error.stack);

        return res.status(500).json({
            error: "Failed to initiate QuickBooks connection",
        });
    }
};

exports.quickBooksCallback = async (req, res) => {
    try {
        if (!req.query.state) {
            throw new Error("Missing OAuth state");
        }

        const authResponse = await oauthClient.createToken(req.url);
        const tokenData = authResponse.getJson();

        const realmId = req.query.realmId; // FIXED LOCATION

        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;
        const expiresIn = tokenData.expires_in;

        const decodedState = JSON.parse(
            Buffer.from(req.query.state, "base64").toString("utf8")
        );

        const companyId = decodedState.companyId;

        if (!companyId || !realmId) {
            throw new Error("Missing companyId or realmId");
        }

        await pool.query(
  `
  INSERT INTO quickbooks_connections (...)
  `,
  [companyId, realmId, accessToken, refreshToken, expiresIn]
);

console.log(
  "REDIRECT TARGET:",
  "https://vat-pro-frontend.onrender.com/settings?quickbooks=connected"
);

return res.redirect(
  "https://vat-pro-frontend.onrender.com/settings?quickbooks=connected"
);
    } catch (error) {
        console.error("QuickBooks callback error:", error);

        return res.status(500).json({
            error: "QuickBooks connection failed",
        });
    }
};

exports.disconnectQuickBooks = async (req, res) => {
    try {
        const { companyId } = req.body;

        await pool.query(
            `
      DELETE FROM quickbooks_connections
      WHERE company_id = $1
      `,
            [companyId]
        );

        return res.json({
            message:
                "QuickBooks disconnected successfully",
        });
    } catch (error) {
        console.error(
            "QuickBooks disconnect error:",
            error
        );

        return res.status(500).json({
            error: "Failed to disconnect QuickBooks",
        });
    }
};