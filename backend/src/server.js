const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
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
const quickbooksRoutes = require("./routes/quickbooksRoutes");
const demoRoutes = require("./routes/demoRoutes");
const leadRoutes = require("./routes/leadRoutes");
const activityRoutes = require("./routes/activityRoutes");
const vatRoutes = require("./routes/vatRoutes");

console.log("✅ activityRoutes imported");

dotenv.config();

const app = express();

app.use(cors());

app.use(helmet());

const allowedOrigins = [
  process.env.CORS_ORIGIN,
  "http://localhost:8084",
  "http://localhost:8083",
  "http://localhost:8081",
  "https://vatpro.maltechdigital.com",
  "https://www.maltechdigital.com",
  "https://maltechdigital.com",
  "https://vat-pro-frontend.onrender.com",
  "https://maltech-vat-pro-landing.onrender.com",
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error(
        `Blocked by CORS: ${origin}`
      );

      callback(
        new Error(`CORS blocked for origin: ${origin}`)
      );
    },
    credentials: true,
  })
);

app.use(express.json());
app.use("/api/demo", demoRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/activities", activityRoutes);

app.get("/", (req, res) => {
  res.send("VAT Pro Backend Running 🚀");
});

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    console.log("REQUEST:", req.method, req.originalUrl);
  }
  next();
});

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

app.use(
  "/api/quickbooks",
  quickbooksRoutes
);

app.use(
  "/api/vat",
  vatRoutes
);

console.log("✅ QUICKBOOKS ROUTES MOUNTED");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

});