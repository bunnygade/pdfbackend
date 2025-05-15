const validatePdfUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'No PDF file uploaded'
      }
    });
  }
  next();
};

const validatePdfEdit = (req, res, next) => {
  const { fileId, edits } = req.body;
  
  if (!fileId) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'File ID is required'
      }
    });
  }

  if (!edits || !Array.isArray(edits)) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Edits array is required'
      }
    });
  }

  // Validate each edit operation
  for (const edit of edits) {
    if (!edit.type || !['text', 'image', 'delete'].includes(edit.type)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid edit type'
        }
      });
    }
  }

  next();
};

module.exports = {
  validatePdfUpload,
  validatePdfEdit
}; 