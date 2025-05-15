const express = require('express');
const cors = require('cors');
const path = require('path');
const { errorHandler } = require('./middleware/errorHandler');
const pdfRoutes = require('./routes/pdfRoutes');
require('./utils/cleanup'); // Import cleanup utility

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// API Routes
app.use('/api/pdf', pdfRoutes);

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'index.html'));
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
