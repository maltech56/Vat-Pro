/**
 * ============================================================================
 * Filing Snapshot Service
 * ============================================================================
 *
 * Purpose:
 * Builds an immutable snapshot of a VAT filing at the time it is saved.
 *
 * This service will eventually store:
 *  - Filing values
 *  - Supporting transactions
 *  - Audit metrics
 *  - Linked documents
 *  - Missing document warnings
 *
 * The snapshot becomes the historical record used by the Filing Pack.
 * ============================================================================
 */

const db = require("../config/db");

/**
 * Build an immutable filing snapshot.
 *
 * @param {Object} options
 * @param {number} options.companyId
 * @param {string|Date} options.periodStart
 * @param {string|Date} options.periodEnd
 * @param {Object} options.filingData
 *
 * @returns {Object}
 */
async function buildFilingSnapshot({
    companyId,
    periodStart,
    periodEnd,
    filingData
}) {
    try {

        console.log("==========================================");
        console.log("BUILDING FILING SNAPSHOT");
        console.log({
            companyId,
            periodStart,
            periodEnd
        });
        console.log("==========================================");

        //----------------------------------------------------------
        // Load transactions for the filing period
        //----------------------------------------------------------

        const transactionResult = await db.query(
            `
            SELECT *
            FROM transactions
            WHERE company_id = $1
              AND DATE(transaction_date)
                  BETWEEN DATE($2) AND DATE($3)
            ORDER BY transaction_date, id
            `,
            [
                companyId,
                periodStart,
                periodEnd
            ]
        );

        const transactions = transactionResult.rows;

        console.log(
            `Snapshot Transactions Found: ${transactions.length}`
        );

        //----------------------------------------------------------
        // Placeholder values
        // (These will be replaced in the next milestones.)
        //----------------------------------------------------------

        //----------------------------------------------------------
        // Load linked documents
        //----------------------------------------------------------

        const transactionIds = transactions.map(t => t.id);

        let linkedDocuments = [];

        if (transactionIds.length > 0) {

            const documentResult = await db.query(
                `
        SELECT *
        FROM company_documents
        WHERE transaction_id = ANY($1)
        ORDER BY created_at DESC
        `,
                [transactionIds]
            );

            linkedDocuments = documentResult.rows;

        }

        const documentsByTransaction = {};

        for (const doc of linkedDocuments) {

            if (!documentsByTransaction[doc.transaction_id]) {
                documentsByTransaction[doc.transaction_id] = [];
            }

            documentsByTransaction[doc.transaction_id].push(doc);

        }

        //----------------------------------------------------------
        // Build transaction summaries
        //----------------------------------------------------------

        const supportingTransactions = transactions.map(tx => {

            const docs = documentsByTransaction[tx.id] || [];

            return {

                ...tx,

                linkedDocuments: docs,

                linkedDocumentCount: docs.length,

                hasLinkedDocuments: docs.length > 0

            };

        });

        //----------------------------------------------------------
        // Missing documents
        //----------------------------------------------------------

        const missingDocumentWarnings =
            supportingTransactions.filter(
                tx => tx.linkedDocumentCount === 0
            );

        //----------------------------------------------------------
        // Statistics
        //----------------------------------------------------------

        const transactionCount = supportingTransactions.length;

        const documentCount = linkedDocuments.length;

        const linkedTransactionCount =
            supportingTransactions.filter(
                tx => tx.hasLinkedDocuments
            ).length;

        const missingDocumentCount =
            missingDocumentWarnings.length;

        //----------------------------------------------------------
        // Audit
        //----------------------------------------------------------

        const auditScore =
            transactionCount === 0
                ? 0
                : Math.round(
                    (linkedTransactionCount / transactionCount) * 100
                );

        const auditReadiness =
            transactionCount === 0
                ? "no_transactions"
                : missingDocumentCount === 0
                    ? "complete"
                    : linkedTransactionCount > 0
                        ? "partial"
                        : "missing_documents";

        return {

            filing: filingData,

            transactions: supportingTransactions,

            audit: {

                auditScore,

                auditReadiness

            },

            stats: {

                transactionCount,

                documentCount,

                linkedTransactionCount,

                missingDocumentCount

            },

            linkedDocuments,

            missingDocumentWarnings

        };
    } catch (error) {

        console.error(
            "Error building filing snapshot:",
            error
        );

        throw error;
    }
}

module.exports = {
    buildFilingSnapshot
};









