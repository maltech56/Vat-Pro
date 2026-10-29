
"use strict";

const assert = require("node:assert/strict");

const dbPath = require.resolve("../src/config/db");

let sourceTotal = "362.07";
let sourceTax = "26.82";
let includeDiscount = false;

const queries = [];

const mockPool = {
  async query(sql) {
    const statement = String(sql);
    queries.push(statement);

    if (statement.includes("FROM import_rows r")) {
      return {
        rows: [{
          id: 124,
          import_status: "pending_review",
          batch_status: "review_required",
          tracking_status: "staged",
          approval_status: "pending_review",
          raw_data: {
            DocNumber: "1037",
            TotalAmt: sourceTotal,
            TxnTaxDetail: { TotalTax: sourceTax }
          }
        }]
      };
    }

    if (statement.includes("FROM quickbooks_review_lines")) {
      return {
        rows: [
          {
            id: 1,
            line_type: "financial",
            original_amount: "335.25",
            reviewed_amount: "335.25",
            vat_classification: "taxable",
            review_status: "reviewed"
          },
          ...(includeDiscount ? [{
            id: 2,
            line_type: "discount",
            original_amount: "10.00",
            reviewed_amount: null,
            vat_classification: null,
            review_status: "pending"
          }] : [])
        ]
      };
    }

    throw new Error("Unexpected SQL query");
  }
};

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: mockPool
};

const {
  getQuickBooksDocumentReadiness
} = require("../src/controllers/quickbooksReviewController");

async function checkReadiness() {
  queries.length = 0;

  let statusCode = 200;
  let responseBody;

  const req = {
    params: {
      companyId: "2",
      batchId: "43",
      importRowId: "124"
    }
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  await getQuickBooksDocumentReadiness(req, res);

  assert.equal(statusCode, 200);
  assert.ok(responseBody, "Readiness must return a response");

  assert.ok(
    queries.every(sql => /^\s*SELECT\b/i.test(sql)),
    "Readiness must execute SELECT queries only"
  );

  return responseBody;
}

async function main() {
  let result = await checkReadiness();

  assert.equal(result.reconciliationDifference, 0);
  assert.equal(result.readyForApproval, true);
  console.log("PASS: Exact source reconciliation");
  console.log("PASS: Readiness response returned");

  sourceTotal = "362.08";
  result = await checkReadiness();

  assert.equal(result.reconciliationDifference, 0.01);
  assert.ok(
    result.blockers.includes(
      "QuickBooks source totals do not reconcile"
    )
  );
  assert.equal(result.readyForApproval, false);
  console.log("PASS: One-cent discrepancy detected");

  sourceTotal = "352.07";
  includeDiscount = true;
  result = await checkReadiness();

  assert.equal(result.reconciliationDifference, 0);
  assert.ok(
    result.blockers.includes(
      "Discount allocation requires separate review"
    )
  );
  assert.equal(result.readyForApproval, false);
  console.log("PASS: Discount document remains blocked");

  includeDiscount = false;
  sourceTotal = "invalid";
  result = await checkReadiness();

  assert.ok(
    result.blockers.includes(
      "Invalid QuickBooks source amounts"
    )
  );
  assert.equal(result.readyForApproval, false);
  console.log("PASS: Invalid source amount blocked");

  console.log("PASS: Readiness queries are read-only");
}

main().catch(error => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
