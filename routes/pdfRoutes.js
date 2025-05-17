const express = require('express');
const router = express.Router();
const { 
  uploadPdf, 
  editPdf, 
  downloadPdf, 
  getPdfInfo,
  convertPdfToWord,
  convertPdfToExcel,
  convertPdfToJpg,
  convertPdfToPpt
} = require('../controllers/pdfController');
const upload = require('../config/multerConfig');
const { validatePdfUpload, validatePdfEdit } = require('../middleware/validation');

// PDF routes
router.post('/upload', upload.single('pdf'), validatePdfUpload, uploadPdf);
router.post('/edit', validatePdfEdit, editPdf);
router.get('/download/:id', downloadPdf);
router.get('/info/:id', getPdfInfo);

// Conversion routes
router.post('/convert/word', convertPdfToWord);
router.post('/convert/excel', convertPdfToExcel);
router.post('/convert/jpg', convertPdfToJpg);
router.post('/convert/ppt', convertPdfToPpt);

module.exports = router; 