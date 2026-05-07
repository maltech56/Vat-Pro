const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const companyRoutes = require("./routes/companyRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const vatFilingRoutes = require("./routes/vatFilingRoutes");
const documentRoutes = require("./routes/documentRoutes");
const reportRoutes = require("./routes/reportRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const importTemplateRoutes = require("./routes/importTemplateRoutes");
const importBatchRoutes = require("./routes/importBatchRoutes");
const importRoutes = require("./routes/importRoutes");
const auditRoutes = require("./routes/auditRoutes");
//const demoRoutes = require("./routes/demoRoutes");

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:8088",
  "http://localhost:8089",
  "http://localhost:8090",
  "http://localhost:3000",
  "https://vat-pro-backend.onrender.com",
  process.env.CORS_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow tools like Postman, curl, Render health checks, and same-origin requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn("Blocked by CORS:", origin);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json());
//app.use("/api/demo", demoRoutes);

app.get("/", (req, res) => {
  res.send("VAT Pro Backend Running 🚀");
});

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/vat-filings", vatFilingRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/import-templates", importTemplateRoutes);
app.use("/api/import-batches", importBatchRoutes);
app.use("/api/imports", importRoutes);
app.use("/api/audit", auditRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});