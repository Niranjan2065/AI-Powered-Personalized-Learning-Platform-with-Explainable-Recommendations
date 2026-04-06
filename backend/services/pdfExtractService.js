// ============================================================
// services/pdfExtractService.js
// ============================================================
// ✅ FIX: pdf-parse must be imported and called correctly.
//
// WRONG (causes "pdfParse is not a function"):
//   const pdfParse = require('pdf-parse');          // may return object in some versions
//   const pdfParse = require('pdf-parse/lib/pdf-parse'); // direct internal path
//
// CORRECT: require('pdf-parse') returns the function directly.
// If it doesn't work, we fall back to the internal path.
// We also always pass a Buffer (not a path string) to the function.
// ============================================================

const fs   = require('fs');
const path = require('path');

// ✅ Safe import — handles both common import patterns
let pdfParse;
try {
  pdfParse = require('pdf-parse');
  // Some versions export as { default: fn } instead of fn directly
  if (typeof pdfParse !== 'function' && typeof pdfParse.default === 'function') {
    pdfParse = pdfParse.default;
  }
  // Fallback: try internal path
  if (typeof pdfParse !== 'function') {
    pdfParse = require('pdf-parse/lib/pdf-parse.js');
  }
} catch (e) {
  console.error('❌ pdf-parse not installed. Run: npm install pdf-parse');
}

/**
 * Extract text from a PDF file path
 * @param {string} filePath - Absolute path to the PDF file
 * @returns {Promise<string>} - Extracted text content
 */
const extractTextFromPdfPath = async (filePath) => {
  if (typeof pdfParse !== 'function') {
    throw new Error('pdf-parse is not installed or failed to load. Run: npm install pdf-parse');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found at path: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const data   = await pdfParse(buffer);

  const text = data.text?.trim() || '';

  if (!text || text.length < 20) {
    throw new Error('Could not extract readable text from this PDF. It may be scanned or image-based.');
  }

  return text;
};

/**
 * Extract text from a PDF Buffer (for in-memory files)
 * @param {Buffer} buffer - PDF file as a Buffer
 * @returns {Promise<string>} - Extracted text content
 */
const extractTextFromPdfBuffer = async (buffer) => {
  if (typeof pdfParse !== 'function') {
    throw new Error('pdf-parse is not installed or failed to load. Run: npm install pdf-parse');
  }

  const data = await pdfParse(buffer);
  const text = data.text?.trim() || '';

  if (!text || text.length < 20) {
    throw new Error('Could not extract readable text from this PDF. It may be scanned or image-based.');
  }

  return text;
};

module.exports = { extractTextFromPdfPath, extractTextFromPdfBuffer };