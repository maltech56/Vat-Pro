const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../../uploads/imports");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedExt = [".csv", ".xlsx", ".xls"];

const allowedMimeTypes = [
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const sanitizeFilename = (filename) => {
  const ext = path.extname(filename).toLowerCase();

  const base = path
    .basename(filename, ext)
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 80);

  return `${Date.now()}-${base}${ext}`;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    cb(null, sanitizeFilename(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExt.includes(ext)) {
    return cb(new Error("Only CSV and Excel files are allowed"));
  }

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Invalid file MIME type"));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

module.exports = upload;