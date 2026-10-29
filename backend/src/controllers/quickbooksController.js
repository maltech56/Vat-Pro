const pool = require("../config/db");
const oauthClient = require("../services/quickbooksService");
const { quickBooksApiBase } = oauthClient;
const OAuthClient = require("intuit-oauth");
const crypto = require("crypto");

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

const fetchQuickBooksPages = async (
    realmId,
    accessToken,
    entity,
    pageSize = 100
) => {
    const allowedEntities = [
        "Customer",
        "Vendor",
        "Invoice",
        "Bill"
    ];

    if (!allowedEntities.includes(entity)) {
        throw new Error("Invalid QuickBooks entity");
    }

    const records = [];
    let startPosition = 1;

    while (true) {
        const query =
            `SELECT * FROM ${entity} ` +
            `STARTPOSITION ${startPosition} ` +
            `MAXRESULTS ${pageSize}`;

        const url =
            `${quickBooksApiBase}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`;

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json"
            }
        });

        const data = await response.json();

        if (
            !response.ok ||
            data?.Fault ||
            !data?.QueryResponse
        ) {
            throw new Error(
                `QuickBooks ${entity} retrieval failed (HTTP ${response.status})`
            );
        }

        const pageRecords =
            data.QueryResponse[entity] || [];

        if (!Array.isArray(pageRecords)) {
            throw new Error("Invalid QuickBooks response");
        }

        records.push(...pageRecords);

        if (pageRecords.length < pageSize) {
            break;
        }

        startPosition += pageRecords.length;
    }

    return records;
};

exports.connectQuickBooks = async (req, res) => {
    try {
        const companyId = req.query.companyId;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                error: "Unauthorized"
            });
        }

        if (!companyId) {
            return res.status(400).json({
                error: "Company ID is required"
            });
        }

        // Verify membership independently of route middleware.
        const membership = await pool.query(
            `SELECT 1
             FROM user_companies
             WHERE user_id = $1 AND company_id = $2
             LIMIT 1`,
            [userId, companyId]
        );

        if (membership.rows.length === 0) {
            return res.status(403).json({
                error: "Access denied for this company"
            });
        }

        // Generate an unpredictable OAuth state.
        const state = crypto.randomBytes(32).toString("hex");

        // Store only the hash, never the original state.
        const stateHash = crypto
            .createHash("sha256")
            .update(state)
            .digest("hex");

        await pool.query(
            `INSERT INTO quickbooks_oauth_states
                (state_hash, user_id, company_id, expires_at)
             VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
            [stateHash, userId, companyId]
        );

        const authUri = oauthClient.authorizeUri({
            scope: [OAuthClient.scopes.Accounting],
            state
        });

        return res.json({ authUri });

    } catch (error) {
        console.error(
            "QuickBooks connection initialization failed:",
            error.message
        );

        return res.status(500).json({
            error: "Failed to initiate QuickBooks connection"
        });
    }
};

exports.quickBooksCallback = async (req, res) => {
    try {
        const state = req.query.state;
        const realmId = req.query.realmId;

        if (
            typeof state !== "string" ||
            !/^[a-f0-9]{64}$/.test(state) ||
            typeof realmId !== "string" ||
            !realmId.trim()
        ) {
            return res.status(400).json({
                error: "Invalid QuickBooks OAuth callback"
            });
        }

        // Hash the received state. Never store the raw state.
        const stateHash = crypto
            .createHash("sha256")
            .update(state)
            .digest("hex");

        // Atomically consume the state.
        // Expired or previously used states cannot be reused.
        const stateResult = await pool.query(
            `
            UPDATE quickbooks_oauth_states
            SET used_at = NOW()
            WHERE state_hash = $1
              AND used_at IS NULL
              AND expires_at > NOW()
            RETURNING user_id, company_id
            `,
            [stateHash]
        );

        if (stateResult.rows.length === 0) {
            return res.status(400).json({
                error: "Invalid, expired, or previously used OAuth state"
            });
        }

        const { user_id: userId, company_id: companyId } =
            stateResult.rows[0];

        // Recheck authorization before exchanging credentials.
        const membership = await pool.query(
            `
            SELECT 1
	    FROM user_companies
	    WHERE user_id = $1
              AND company_id = $2
              AND role IN ('admin', 'staff')
            LIMIT 1
            `,
            [userId, companyId]
        );

        if (membership.rows.length === 0) {
            return res.status(403).json({
                error: "Company authorization no longer valid"
            });
        }

        // Only a validated state may reach the token exchange.
        const authResponse = await oauthClient.createToken(req.url);
        const tokenData = authResponse.getJson();

        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;
        const expiresIn = Number(tokenData.expires_in);

        if (
            !accessToken ||
            !refreshToken ||
            !Number.isFinite(expiresIn) ||
            expiresIn <= 0
        ) {
            throw new Error("Invalid QuickBooks token response");
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
                NOW() + ($5 * INTERVAL '1 second'),
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
            [
                companyId,
                realmId,
                accessToken,
                refreshToken,
                expiresIn
            ]
        );

        console.log(
            "QuickBooks connected for company:",
            companyId
        );

        const frontendUrl =
            process.env.FRONTEND_URL ||
            "https://vat-pro-frontend.onrender.com";

        return res.redirect(
            `${frontendUrl}/dashboard?quickbooks=connected&companyId=${encodeURIComponent(companyId)}`
        );

    } catch (error) {
        console.error(
            "QuickBooks OAuth callback failed:",
            error.message
        );

        return res.status(400).json({
            error: "QuickBooks authorization failed"
        });
    }
};

// Treat only an explicit invalid-token response as proof that the stored grant
// can no longer be revoked. Other failures (including 401, timeouts and 5xx)
// are not evidence of an invalid refresh token.
const isConfirmedInvalidRevocationToken = (error) => {
    const status = Number(error?.statusCode ?? error?.response?.status ?? error?.response?.statusCode);
    const payload = error?.response?.data ?? error?.response?.body ?? error?.response?.json ?? error?.error;
    const code = payload?.error ?? payload?.code;
    return status === 400 && code === "invalid_token";
};

exports.disconnectQuickBooks = async (req, res) => {
    const companyId = req.body?.companyId;
    if (!Number.isSafeInteger(Number(companyId)) || Number(companyId) <= 0) {
        return res.status(400).json({ error: "Valid company ID is required" });
    }
    try {
        // companyAccess middleware must authorize company membership and role.
        const result = await pool.query(
            `SELECT refresh_token FROM quickbooks_connections WHERE company_id = $1`,
            [companyId]
        );
        if (!result.rows.length) {
            return res.json({ disconnected: true, message: "QuickBooks already disconnected" });
        }
        const refreshToken = result.rows[0].refresh_token;
        if (!refreshToken) {
            return res.status(409).json({ error: "Missing authorization token. Contact support to complete disconnection." });
        }

        let alreadyInvalid = false;
        try {
            await oauthClient.revoke({ refresh_token: refreshToken });
        } catch (revokeError) {
            if (isConfirmedInvalidRevocationToken(revokeError)) {
                // Explicitly invalid at Intuit: clear only this stale local grant.
                alreadyInvalid = true;
            } else {
                console.error("QuickBooks token revocation could not be confirmed for company", companyId);
                return res.status(502).json({
                    error: "Intuit could not confirm disconnection. Try again or contact support."
                });
            }
        }

        const deletion = await pool.query(
            `DELETE FROM quickbooks_connections WHERE company_id = $1 AND refresh_token = $2`,
            [companyId, refreshToken]
        );
        if (deletion.rowCount !== 1) {
            return res.status(409).json({
                disconnected: false,
                error: "QuickBooks connection changed during disconnection. Refresh its status and retry."
            });
        }
        return res.json({
            disconnected: true,
            authorizationAlreadyInvalid: alreadyInvalid,
            message: alreadyInvalid
                ? "Stored QuickBooks connection cleared; Intuit reported the token was already invalid."
                : "QuickBooks disconnected successfully"
        });
    } catch (error) {
        console.error("QuickBooks disconnect error for company", companyId, error.message);
        return res.status(500).json({ error: "Failed to disconnect QuickBooks" });
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

        const { realm_id, access_token } =
             await getValidAccessToken(companyId);

        const response = await fetch(
            `${quickBooksApiBase}/v3/company/${realm_id}/companyinfo/${realm_id}`,
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

        const customers = await fetchQuickBooksPages(
            realm_id,
            access_token,
            "Customer"
        );

        return res.json({
            QueryResponse: {
                Customer: customers
            }
        });

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

        const vendors = await fetchQuickBooksPages(
            realm_id,
            access_token,
            "Vendor"
	);

	return res.json({
            QueryResponse: {
                Vendor: vendors
            }
	});

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

        const invoices = await fetchQuickBooksPages(
            realm_id,
            access_token,
            "Invoice"
        );

        return res.json({
            QueryResponse: {
                Invoice: invoices
            }
        });

    } catch (error) {
        console.error("QB Invoices Error:", error);

        return res.status(500).json({
            error: "Failed to load invoices",
            message: error.message
        });
    }
};

exports.getQuickBooksBills = async (req, res) => {
    try {
        const { companyId } = req.params;

        const { realm_id, access_token } =
            await getValidAccessToken(companyId);

        const bills = await fetchQuickBooksPages(
            realm_id,
            access_token,
            "Bill"
        );

        return res.json({
            QueryResponse: {
                Bill: bills
            }
        });

    } catch (error) {
        console.error("QB Bills Error:", error);

        return res.status(500).json({
            error: "Failed to load bills",
            message: error.message
        });
    }
};

exports.importQuickBooksCustomers = async (req, res) => {
    try {
        const { companyId } = req.params;

        const { realm_id, access_token } =
            await getValidAccessToken(companyId);

        const customers = await fetchQuickBooksPages(
            realm_id,
            access_token,
            "Customer"
        );

        let imported = 0;

        for (const customer of customers) {
           const result = await pool.query(
               `
               INSERT INTO qb_customers
                (
               company_id,
                   realm_id,
               qb_customer_id,
               display_name,
               company_name
               )
               VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT
               (
               company_id,
               realm_id,
               qb_customer_id
               )
               DO NOTHING
               `,
               [
               companyId,
               realm_id,
               customer.Id,
               customer.DisplayName,
               customer.CompanyName || null
              ]
	);

            imported += result.rowCount;
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

        const vendors = await fetchQuickBooksPages(
            realm_id,
            access_token,
            "Vendor"
        );

        let imported = 0;

        for (const vendor of vendors) {

            const result = await pool.query(
    `
    INSERT INTO qb_vendors
    (
        company_id,
        realm_id,
        qb_vendor_id,
        display_name,
        company_name,
        email,
        phone
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT
    (
        company_id,
        realm_id,
        qb_vendor_id
    )
    DO NOTHING
    `,
    [
        companyId,
        realm_id,
        vendor.Id,
        vendor.DisplayName,
        vendor.CompanyName || null,
        vendor.PrimaryEmailAddr?.Address || null,
        vendor.PrimaryPhone?.FreeFormNumber || null
    ]
);

            imported += result.rowCount;
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


// ======================================================
// QUICKBOOKS FINANCIAL STAGING - INVOICES AND BILLS
// ======================================================
// Retrieves QuickBooks financial records and stages them
// for Bahamas VAT review. Does not post transactions.

const stageQuickBooksFinancialRecords = async (req, res, entity) => {
    let client;

    try {
        const companyId = Number(req.params.companyId);
        const userId = req.user?.id;

        if (!Number.isSafeInteger(companyId) || companyId <= 0) {
            return res.status(400).json({
                error: "Invalid company ID"
            });
        }

        if (!userId) {
            return res.status(401).json({
                error: "Unauthorized"
            });
        }

        const { realm_id, access_token } =
            await getValidAccessToken(companyId);

        // Fetch all pages before starting the database transaction.
        const records = await fetchQuickBooksPages(
            realm_id,
            access_token,
            entity
        );

        client = await pool.connect();
        await client.query("BEGIN");

        // Confirm permissions independently of route middleware.
        const accessResult = await client.query(
            `
            SELECT role
            FROM user_companies
            WHERE user_id = $1 AND company_id = $2
            LIMIT 1
            `,
            [userId, companyId]
        );

        if (
            !accessResult.rows.length ||
            !["admin", "staff"].includes(accessResult.rows[0].role)
        ) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                error: "Insufficient company permissions"
            });
        }

        const batchResult = await client.query(
            `
            INSERT INTO import_batches (
                company_id,
                uploaded_by,
                file_name,
                file_type,
                source_type,
                status,
                total_rows,
                valid_rows,
                error_rows,
                notes
            )
            VALUES (
                $1, $2, $3, 'quickbooks',
                'quickbooks', 'review_required',
                0, 0, 0, $4
            )
            RETURNING id
            `,
            [
                companyId,
                userId,
                `quickbooks-${entity.toLowerCase()}-import`,
                `QuickBooks ${entity} staging - VAT review required`
            ]
        );

        const batchId = batchResult.rows[0].id;
        let staged = 0;
        let skipped = 0;

        for (const record of records) {
            const quickbooksId = String(record.Id || "").trim();

            if (!quickbooksId) {
                throw new Error(
                    `QuickBooks ${entity} record has no ID`
                );
            }

            // Reserve this external record atomically.
            // Already staged or imported records are skipped.
            const trackingResult = await client.query(
                `
                INSERT INTO quickbooks_transaction_tracking (
                    company_id,
                    realm_id,
                    entity_type,
                    quickbooks_id,
                    status
                )
                VALUES ($1, $2, $3, $4, 'staged')
                ON CONFLICT (
                    company_id,
                    realm_id,
                    entity_type,
                    quickbooks_id
                )
                DO NOTHING
                RETURNING id
                `,
                [
                    companyId,
                    realm_id,
                    entity,
                    quickbooksId
                ]
            );

            if (!trackingResult.rows.length) {
                skipped++;
                continue;
            }

            const rowResult = await client.query(
                `
                INSERT INTO import_rows (
                    batch_id,
                    row_number,
                    raw_data,
                    parsed_data,
                    status,
                    error_message
                )
                VALUES ($1, $2, $3, $4, 'pending_review', NULL)
                RETURNING id
                `,
                [
                    batchId,
                    staged + 1,
                    JSON.stringify(record),
                    JSON.stringify({
                        source: "quickbooks",
                        entityType: entity,
                        quickbooksId,
                        realmId: realm_id,
                        type: entity === "Invoice" ? "sale" : "expense",
                        documentNumber: record.DocNumber || null,
                        transactionDate: record.TxnDate || null,
                        partyName: entity === "Invoice"
                            ? record.CustomerRef?.name || null
                            : record.VendorRef?.name || null,
                        quickbooksTotal: record.TotalAmt ?? null,
                        quickbooksTax: record.TxnTaxDetail?.TotalTax ?? null,
                        amount: null,
                        classification: null,
                        vatReviewApproved: false
                    })
                ]
            );

            await client.query(
                `
                UPDATE quickbooks_transaction_tracking
                SET import_row_id = $1,
                    updated_at = NOW()
                WHERE id = $2
                `,
                [
                    rowResult.rows[0].id,
                    trackingResult.rows[0].id
                ]
            );

            staged++;
        }

        await client.query(
            `
            UPDATE import_batches
            SET total_rows = $1,
                valid_rows = 0,
                error_rows = 0,
                updated_at = NOW()
            WHERE id = $2
            `,
            [staged, batchId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "QuickBooks records staged for Bahamas VAT review",
            batchId,
            entity,
            fetched: records.length,
            staged,
            skipped,
            status: "review_required",
            transactionsPosted: 0
        });

    } catch (error) {
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "QuickBooks staging rollback failed:",
                    rollbackError
                );
            }
        }

        console.error(
            `QuickBooks ${entity} staging error:`,
            error
        );

        return res.status(500).json({
            error: `Failed to stage QuickBooks ${entity} records`
        });

    } finally {
        if (client) {
            client.release();
        }
    }
};

exports.importQuickBooksInvoices = async (req, res) => {
    return stageQuickBooksFinancialRecords(req, res, "Invoice");
};

exports.importQuickBooksBills = async (req, res) => {
    return stageQuickBooksFinancialRecords(req, res, "Bill");
};
