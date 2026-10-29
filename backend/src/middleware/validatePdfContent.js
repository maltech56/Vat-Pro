const validatePdfContent = (req, res, next) => {
  if (!req.file || !Buffer.isBuffer(req.file.buffer)) {
    return res.status(400).json({
      error: "A PDF file is required.",
    });
  }

  const buffer = req.file.buffer;

  // Verify the PDF file signature: %PDF-
  const hasPdfSignature =
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString("ascii") === "%PDF-";

  if (!hasPdfSignature) {
    return res.status(400).json({
      error: "Invalid PDF file content.",
    });
  }

  next();
};

module.exports = validatePdfContent;