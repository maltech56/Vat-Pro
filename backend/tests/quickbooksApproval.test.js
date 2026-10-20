"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

// Replace the database module before loading the controller.
const dbPath = require.resolve("../src/config/db");

const queries = [];
let rollbackCalled = false;
let clientReleased = false;

// Configurable source amount for independent test scenarios.
let mockSourceAmount = "275.00";
let mockMissingStagedLine = false;
let mockSourceDiscountLine = false;

const mockClient = {
  async query(sql) {
    const statement = String(sql);
    queries.push(statement);

    if (statement === "BEGIN") return { rows: [] };

    if (statement === "ROLLBACK") {
      rollbackCalled = true;
      return { rows: [] };
    }

    if (statement.includes("FROM import_batches b")) {
      return {
        rows: [{
          id: 124,
          import_status: "pending_review",
          batch_status: "review_required",
          tracking_status: "staged",
          approval_status: "pending_review",
          raw_data: {
            DocNumber: "1037",
            TotalAmt: "362.07",
            TxnTaxDetail: { TotalTax: "26.82" },
            Line: [
              { Id: "1", Amount: mockSourceAmount, DetailType: "SalesItemLineDetail" },
              { Id: "2", Amount: "12.75", DetailType: "SalesItemLineDetail" },
              { Id: "3", Amount: "47.50", DetailType: "SalesItemLineDetail" },
              { Amount: "335.25", DetailType: "SubTotalLineDetail" },
              ...(mockSourceDiscountLine
                ? [{ Id: "4", Amount: "50.25", DetailType: "DiscountLineDetail" }]
                : [])
            ]
          }
        }]
      };
    }

    if (statement.includes("FROM quickbooks_review_lines")) {
      return {
        rows: [
          {
            id: 1,
            line_index: 0,
            line_type: "financial",
            original_amount: "275.00",
            reviewed_amount: "276.00",
            vat_classification: "taxable",
            review_status: "reviewed"
          },
          {
            id: 2,
            line_index: 1,
            line_type: "financial",
            original_amount: "12.75",
            reviewed_amount: "12.75",
            vat_classification: "taxable",
            review_status: "reviewed"
          },
          {
            id: 3,
            line_index: 2,
            line_type: "financial",
            original_amount: "47.50",
            reviewed_amount: "47.50",
            vat_classification: "taxable",
            review_status: "reviewed"
          }
        ].filter(line =>
          !mockMissingStagedLine || line.line_index !== 1
        )
      };
    }

    throw new Error("Unexpected SQL query");
  },

  release() {
    clientReleased = true;
  }
};

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    connect: async () => mockClient
  }
};

const {
  approveQuickBooksDocument
} = require("../src/controllers/quickbooksReviewController");

async function runTest() {
  let statusCode;
  let responseBody;

  const req = {
    params: {
      companyId: "2",
      batchId: "43",
      importRowId: "124"
    },
    user: { id: 2 }
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

  await approveQuickBooksDocument(req, res);

  assert.equal(statusCode, 409);
  assert.equal(responseBody.validationOnly, true);

  assert.ok(
    responseBody.blockers.includes(
      "Reviewed financial amounts differ from source amounts"
    )
  );

  assert.equal(responseBody.approvalStatus, "pending_review");
  assert.equal(responseBody.transactionsPosted, 0);

  assert.equal(rollbackCalled, true);
  assert.equal(clientReleased, true);

  assert.ok(
    queries.every(sql =>
      !/^\s*(UPDATE|INSERT|DELETE)\b/i.test(sql)
    )
  );

  console.log("PASS: HTTP 409 returned");
  console.log("PASS: $1.00 mismatch blocked approval");
  console.log("PASS: Document remains pending");
  console.log("PASS: Transaction rolled back");
  console.log("PASS: Database client released");
  console.log("PASS: No approval or posting SQL executed");
}

async function runSourceIntegrityTest() {
  // Simulate an altered QuickBooks source amount.
  mockSourceAmount = "274.00";

  // Reset tracking for this independent test.
  queries.length = 0;
  rollbackCalled = false;
  clientReleased = false;

  let statusCode;
  let responseBody;

  const req = {
    params: {
      companyId: "2",
      batchId: "43",
      importRowId: "124"
    },
    user: { id: 2 }
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

  try {
    await approveQuickBooksDocument(req, res);

    assert.equal(statusCode, 409);

    assert.ok(
      responseBody.blockers.includes(
        "Original QuickBooks amount mismatch on line 1"
      ),
      "Controller must reject altered QuickBooks source amounts"
    );

    assert.equal(responseBody.approvalStatus, "pending_review");
    assert.equal(responseBody.transactionsPosted, 0);
    assert.equal(rollbackCalled, true);
    assert.equal(clientReleased, true);

    assert.ok(
      queries.every(sql =>
        !/^\s*(UPDATE|INSERT|DELETE)\b/i.test(sql)
      )
    );

    console.log("PASS: Altered QuickBooks source amount detected");
    console.log("PASS: Source-integrity mismatch blocked approval");
    console.log("PASS: Source-integrity test rolled back");
    console.log("PASS: No financial posting SQL executed");
  } finally {
    mockSourceAmount = "275.00";
  }
}

async function runMissingStagedLineTest() {
  mockMissingStagedLine = true;

  queries.length = 0;
  rollbackCalled = false;
  clientReleased = false;

  let statusCode;
  let responseBody;

  const req = {
    params: {
      companyId: "2",
      batchId: "43",
      importRowId: "124"
    },
    user: { id: 2 }
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

  try {
    await approveQuickBooksDocument(req, res);

    assert.equal(statusCode, 409);

    assert.ok(
      responseBody.blockers.includes(
        "Missing staged QuickBooks financial line at index 1"
      ),
      "Controller must detect missing staged financial lines"
    );

    assert.equal(responseBody.approvalStatus, "pending_review");
    assert.equal(responseBody.transactionsPosted, 0);
    assert.equal(rollbackCalled, true);
    assert.equal(clientReleased, true);

    assert.ok(
      queries.every(sql =>
        !/^\s*(UPDATE|INSERT|DELETE)\b/i.test(sql)
      )
    );

    console.log("PASS: Missing staged financial line detected");
    console.log("PASS: Missing line blocked approval");
    console.log("PASS: Missing-line test rolled back");
    console.log("PASS: No financial posting SQL executed");
  } finally {
    mockMissingStagedLine = false;
  }
}

async function runMissingStagedDiscountTest() {
  mockSourceDiscountLine = true;

  queries.length = 0;
  rollbackCalled = false;
  clientReleased = false;

  let statusCode;
  let responseBody;

  const req = {
    params: {
      companyId: "2",
      batchId: "43",
      importRowId: "124"
    },
    user: { id: 2 }
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

  try {
    await approveQuickBooksDocument(req, res);

    assert.equal(statusCode, 409);

    assert.ok(
      responseBody.blockers.includes(
        "Missing staged QuickBooks discount line at index 4"
      ),
      "Missing staged discount must block approval"
    );

    assert.equal(responseBody.approvalStatus, "pending_review");
    assert.equal(responseBody.transactionsPosted, 0);
    assert.equal(rollbackCalled, true);
    assert.equal(clientReleased, true);

    assert.ok(
      queries.every(sql =>
        !/^\s*(UPDATE|INSERT|DELETE)\b/i.test(sql)
      )
    );

    console.log("PASS: Missing staged discount line detected");
    console.log("PASS: Missing discount blocked approval");
    console.log("PASS: Discount test rolled back");
    console.log("PASS: No financial posting SQL executed");
  } finally {
    mockSourceDiscountLine = false;
  }
}

async function main() {
  await runTest();
  await runSourceIntegrityTest();
  await runMissingStagedLineTest();
  await runMissingStagedDiscountTest();
}

main().catch(error => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});