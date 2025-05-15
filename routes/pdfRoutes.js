const express = require('express');
const router = express.Router();
const { uploadPdf, editPdf, downloadPdf, getPdfInfo } = require('../controllers/pdfController');
const upload = require('../config/multerConfig');
const { validatePdfUpload, validatePdfEdit } = require('../middleware/validation');

// PDF routes
router.post('/upload', upload.single('pdf'), validatePdfUpload, uploadPdf);
router.post('/edit', validatePdfEdit, editPdf);
router.get('/download/:id', downloadPdf);
router.get('/info/:id', getPdfInfo);

module.exports = router; 