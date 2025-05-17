const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware/errorHandler');
const pdfRoutes = require('./routes/pdfRoutes');
const ocrRoutes = require('./routes/ocrRoutes');
require('./utils/cleanup'); // Import cleanup utility

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/pdf', pdfRoutes);
app.use('/api/ocr', ocrRoutes);

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`PDF Tools API running on port ${port}`);
});
