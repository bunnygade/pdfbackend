const express = require('express');
const router = express.Router();
const { extractTextFromPdf, extractTextFromImage, batchExtractTextFromPdf } = require('../controllers/ocrController');
const upload = require('../config/multerConfig');

// OCR routes
router.post('/pdf/extract', extractTextFromPdf);
router.post('/pdf/batch-extract', batchExtractTextFromPdf);
router.post('/image/extract', upload.single('image'), extractTextFromImage);

module.exports = router; 