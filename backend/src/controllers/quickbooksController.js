const pool = require("../config/db");
const oauthClient = require("../services/quickbooksService");
const OAuthClient = require("intuit-oauth");

const getQuickBooksConnection = async (companyId) => {
    const result = await pool.query(
        `
        SELECT
            realm_id,
            access_token,
            refresh_token,
            token_expires_at
        FROM quickbooks_connections
        WHERE company_id = $1
        `,
        [companyId]
    );

    if (!result.rows.length) {
        throw new Error("QuickBooks not connected");
    }

    return result.rows[0];
};

const getValidAccessToken = async (companyId) => {

    const connection =
        await getQuickBooksConnection(companyId);

    const {
        access_token,
        refresh_token,
        token_expires_at
    } = connection;

    if (
        token_expires_at &&
        new Date(token_expires_at) > new Date()
    ) {
        return connection;
    }

    console.log(
        "QB ACCESS TOKEN EXPIRED - REFRESHING"
    );
    console.log(
        "Company:",
        companyId
    );
    const authResponse =
        await oauthClient.refreshUsingToken(
            refresh_token
        );

    const tokenData =
        authResponse.getJson();

    console.log(
        "QB TOKEN REFRESH SUCCESS"
    );

    const newAccessToken =
        tokenData.access_token;

    const newRefreshToken =
        tokenData.refresh_token;

    const expiresIn =
        tokenData.expires_in;

    await pool.query(
        `
        UPDATE quickbooks_connections
        SET
            access_token = $1,
            refresh_token = $2,
            token_expires_at =
                NOW() +
                ($3 || ' seconds')::interval,
            updated_at = NOW()
        WHERE company_id = $4
        `,
        [
            newAccessToken,
            newRefreshToken,
            expiresIn,
            companyId
        ]
    );

    return {
        ...connection,
        access_token: newAccessToken
    };
};

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
  INSERT INTO quickbooks_connections (
    company_id,
    realm_id,
    access_token,
    refresh_token,
    token_expires_at,
    created_at,
    updated_at
  )
  VALUES (
    $1,
    $2,
    $3,
    $4,
    NOW() + ($5 || ' seconds')::interval,
    NOW(),
    NOW()
  )
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

        console.log("====================================");
        console.log("✅ QUICKBOOKS CONNECTED SUCCESSFULLY");
        console.log("Company ID:", companyId);
        console.log("Realm ID:", realmId);
        console.log("====================================");

        return res.redirect(
            "https://vat-pro-frontend.onrender.com/dashboard?quickbooks=connected"
        );


    } catch (error) {
        console.error("====================================");
        console.error("❌ QUICKBOOKS CALLBACK FAILED");
        console.error(error);
        console.error(error.stack);
        console.error("====================================");

        return res.status(500).json({
            error: "QuickBooks connection failed",
            message: error.message,
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

exports.getQuickBooksStatus = async (req, res) => {
    try {
        const { companyId } = req.params;

        const result = await pool.query(
            `
            SELECT
                company_id,
                realm_id,
                updated_at
            FROM quickbooks_connections
            WHERE company_id = $1
            `,
            [companyId]
        );

        if (result.rows.length === 0) {
            return res.json({
                connected: false,
            });
        }

        const connection = result.rows[0];

        return res.json({
            connected: true,
            realmId: connection.realm_id,
            lastUpdated: connection.updated_at,
        });

    } catch (error) {
        console.error(
            "QuickBooks status error:",
            error
        );

        return res.status(500).json({
            error: "Failed to load QuickBooks status",
        });
    }
};

exports.getQuickBooksCompanyInfo = async (req, res) => {
    try {
        const { companyId } = req.params;

        const result = await pool.query(
            `
      SELECT
        realm_id,
        access_token
      FROM quickbooks_connections
      WHERE company_id = $1
      `,
            [companyId]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                error: "QuickBooks not connected",
            });
        }

        const {
            realm_id,
            access_token,
        } = result.rows[0];

        const response = await fetch(
            `https://sandbox-quickbooks.api.intuit.com/v3/company/${realm_id}/companyinfo/${realm_id}`,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    Accept: "application/json",
                },
            }
        );

        const data = await response.json();

        console.log("QB COMPANY INFO:");
        console.log(JSON.stringify(data, null, 2));

        return res.json(data);

    } catch (error) {
        console.error(
            "QuickBooks company info error:",
            error
        );

        return res.status(500).json({
            error: "Failed to load company info",
            message: error.message,
        });
    }
};

exports.getQuickBooksCustomers = async (req, res) => {
    try {
        const { companyId } = req.params;

        const { realm_id, access_token } =
            await getValidAccessToken(companyId);

        const response = await fetch(
            `https://sandbox-quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=select * from Customer`,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    Accept: "application/json",
                },
            }
        );

        const data = await response.json();

        res.json(data);

    } catch (error) {
        console.error("QB Customers Error:", error);

        res.status(500).json({
            error: "Failed to load customers",
            message: error.message,
        });
    }
};

exports.getQuickBooksVendors = async (req, res) => {
    try {
        const { companyId } = req.params;

        const { realm_id, access_token } =
            await getValidAccessToken(companyId);

        const response = await fetch(
            `https://sandbox-quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=select * from Vendor`,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    Accept: "application/json",
                },
            }
        );

        const data = await response.json();

        res.json(data);

    } catch (error) {
        console.error("QB Vendors Error:", error);

        res.status(500).json({
            error: "Failed to load vendors",
            message: error.message,
        });
    }
};

exports.getQuickBooksInvoices = async (req, res) => {
    try {
        const { companyId } = req.params;

        const { realm_id, access_token } =
            await getValidAccessToken(companyId);

        const response = await fetch(
            `https://sandbox-quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=select * from Invoice`,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    Accept: "application/json",
                },
            }
        );

        const data = await response.json();

        res.json(data);

    } catch (error) {
        console.error("QB Invoices Error:", error);

        res.status(500).json({
            error: "Failed to load invoices",
            message: error.message,
        });
    }
};

exports.getQuickBooksBills = async (req, res) => {
    try {
        const { companyId } = req.params;

        const { realm_id, access_token } =
            await getValidAccessToken(companyId);

        const response = await fetch(
            `https://sandbox-quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=select * from Bill`,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    Accept: "application/json",
                },
            }
        );

        const data = await response.json();

        res.json(data);

    } catch (error) {
        console.error("QB Bills Error:", error);

        res.status(500).json({
            error: "Failed to load bills",
            message: error.message,
        });
    }
};

exports.importQuickBooksCustomers = async (req, res) => {
    try {
        const { companyId } = req.params;

        const { realm_id, access_token } =
            await getValidAccessToken(companyId);

        const response = await fetch(
            `https://sandbox-quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=select * from Customer`,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    Accept: "application/json",
                },
            }
        );

        const data = await response.json();

        const customers =
            data?.QueryResponse?.Customer || [];

        let imported = 0;

        for (const customer of customers) {
            await pool.query(
                `
                INSERT INTO qb_customers
                (
                    company_id,
                    qb_customer_id,
                    display_name,
                    company_name
                )
                VALUES ($1,$2,$3,$4)
                ON CONFLICT
                (
                    company_id,
                    qb_customer_id
                )
                DO NOTHING
                `,
                [
                    companyId,
                    customer.Id,
                    customer.DisplayName,
                    customer.CompanyName || null,
                ]
            );

            imported++;
        }

        return res.json({
            success: true,
            imported,
        });

    } catch (error) {
        console.error(
            "QB CUSTOMER IMPORT ERROR:",
            error
        );

        return res.status(500).json({
            error: "Failed to import customers",
            message: error.message,
        });
    }
};

exports.importQuickBooksVendors = async (req, res) => {
    try {

        const { companyId } = req.params;

        const { realm_id, access_token } =
            await getValidAccessToken(companyId);

        const response = await fetch(
            `https://sandbox-quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=select * from Vendor`,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    Accept: "application/json",
                },
            }
        );

        const data = await response.json();

        const vendors =
            data?.QueryResponse?.Vendor || [];

        let imported = 0;

        for (const vendor of vendors) {

            await pool.query(
                `
        INSERT INTO qb_vendors
        (
          company_id,
          qb_vendor_id,
          display_name,
          company_name,
          email,
          phone
        )
        VALUES
        ($1,$2,$3,$4,$5,$6)

        ON CONFLICT
        (
          company_id,
          qb_vendor_id
        )
        DO NOTHING
        `,
                [
                    companyId,
                    vendor.Id,
                    vendor.DisplayName,
                    vendor.CompanyName || null,
                    vendor.PrimaryEmailAddr?.Address || null,
                    vendor.PrimaryPhone?.FreeFormNumber || null,
                ]
            );

            imported++;
        }

        return res.json({
            success: true,
            imported,
        });

    } catch (error) {

        console.error(
            "QB VENDOR IMPORT ERROR:",
            error
        );

        return res.status(500).json({
            error: "Failed to import vendors",
            message: error.message,
        });
    }
};

exports.importQuickBooksInvoices = async (req, res) => {
  try {

    const { companyId } = req.params;

    const { realm_id, access_token } =
      await getValidAccessToken(companyId);

    const response = await fetch(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=select * from Invoice`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json",
        },
      }
    );

    const data = await response.json();

    const invoices =
      data?.QueryResponse?.Invoice || [];

    let imported = 0;

    for (const invoice of invoices) {

      const total =
        Number(invoice.TotalAmt || 0);

      const vat =
        Number(
          invoice.TxnTaxDetail?.TotalTax || 0
        );

      const subtotal =
        total - vat;

      await pool.query(
        `
        INSERT INTO vat_transactions
        (
          company_id,
          source,
          source_id,
          transaction_type,
          document_number,
          transaction_date,
          customer_vendor_name,
          subtotal,
          vat_amount,
          total_amount
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
        )

        ON CONFLICT
        (
          company_id,
          source,
          source_id
        )
        DO NOTHING
        `,
        [
          companyId,
          "QUICKBOOKS",
          invoice.Id,
          "SALE",
          invoice.DocNumber,
          invoice.TxnDate,
          invoice.CustomerRef?.name || null,
          subtotal,
          vat,
          total,
        ]
      );

      imported++;
    }

    return res.json({
      success: true,
      imported,
    });

  } catch (error) {

    console.error(
      "QB INVOICE IMPORT ERROR:",
      error
    );

    return res.status(500).json({
      error: "Failed to import invoices",
      message: error.message,
    });
  }
};

exports.importQuickBooksBills = async (req, res) => {
  try {

    const { companyId } = req.params;

    const { realm_id, access_token } =
      await getValidAccessToken(companyId);

    const response = await fetch(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=select * from Bill`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json",
        },
      }
    );

    const data = await response.json();

    const bills =
      data?.QueryResponse?.Bill || [];

    let imported = 0;

    for (const bill of bills) {

      const total =
        Number(bill.TotalAmt || 0);

      const vat =
        Number(
          bill.TxnTaxDetail?.TotalTax || 0
        );

      const subtotal =
        total - vat;

      await pool.query(
        `
        INSERT INTO vat_transactions
        (
          company_id,
          source,
          source_id,
          transaction_type,
          document_number,
          transaction_date,
          customer_vendor_name,
          subtotal,
          vat_amount,
          total_amount
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
        )

        ON CONFLICT
        (
          company_id,
          source,
          source_id
        )
        DO NOTHING
        `,
        [
          companyId,
          "QUICKBOOKS",
          bill.Id,
          "PURCHASE",
          bill.DocNumber,
          bill.TxnDate,
          bill.VendorRef?.name || null,
          subtotal,
          vat,
          total,
        ]
      );

      imported++;
    }

    return res.json({
      success: true,
      imported,
    });

  } catch (error) {

    console.error(
      "QB BILL IMPORT ERROR:",
      error
    );

    return res.status(500).json({
      error: "Failed to import bills",
      message: error.message,
    });
  }
};