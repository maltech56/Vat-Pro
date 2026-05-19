const pool = require("../config/db");
const oauthClient = require("../services/quickbooksService");
const OAuthClient = require("intuit-oauth");

exports.connectQuickBooks = async (req, res) => {
    console.log("🔥 CONNECT QUICKBOOKS HIT");

    console.log("REQ USER:", req.user);
    console.log("REQ QUERY:", req.query);

    console.log("QB ENV CHECK:", {
        clientId: process.env.QUICKBOOKS_CLIENT_ID,
        clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET ? "EXISTS" : "MISSING",
        redirectUri: process.env.QUICKBOOKS_REDIRECT_URI,
        env: process.env.QUICKBOOKS_ENVIRONMENT
    });

    try {
        const companyId = req.query.companyId;

        if (!companyId) {
            return res.status(400).json({ error: "Company ID is required" });
        }

        const state = Buffer.from(
            JSON.stringify({
                companyId,
                userId: req.user.id,
            })
        ).toString("base64");

        console.log(
            "CLIENT ID:",
            process.env.QUICKBOOKS_CLIENT_ID
        );

        console.log(
            "REDIRECT URI:",
            process.env.QUICKBOOKS_REDIRECT_URI
        );

        console.log(
            "ENVIRONMENT:",
            process.env.QUICKBOOKS_ENVIRONMENT
        );

        console.log("COMPANY ID:", companyId);
        console.log("GENERATING QUICKBOOKS AUTH URL...");

        console.log("AUTH URL GENERATED:");
        console.log(authUri);

        const authUri = oauthClient.authorizeUri({
            scope: [OAuthClient.scopes.Accounting],
            state,
        });

        console.log("Generated QuickBooks URL:", authUri);
        console.log("CLIENT ID:", process.env.QUICKBOOKS_CLIENT_ID);
        console.log("REDIRECT URI:", process.env.QUICKBOOKS_REDIRECT_URI);
        console.log("AUTH URI:", authUri);

        return res.redirect(authUri);
    } catch (error) {
        console.error(
            "QuickBooks connect error:",
            error.message
        );

        console.error(error);
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
      INSERT INTO quickbooks_connections (
        company_id,
        realm_id,
        access_token,
        refresh_token,
        token_expires_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW() + ($5 || ' seconds')::interval, NOW(), NOW())
      ON CONFLICT (company_id)
      DO UPDATE SET
        realm_id = EXCLUDED.realm_id,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        updated_at = NOW()
      `,
            [companyId, realmId, accessToken, refreshToken, expiresIn]
        );

        return res.redirect(
            "https://vat.maltechenterprises.com/settings?quickbooks=connected"
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