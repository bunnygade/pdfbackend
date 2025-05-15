const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

const uploadPdf = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Read the uploaded PDF
    const pdfBytes = await fs.readFile(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Store metadata
    const metadata = {
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
      path: file.path,
      pages: pdfDoc.getPageCount()
    };

    // Save metadata to a JSON file
    const metadataPath = path.join(path.dirname(file.path), `${file.filename}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata));

    res.status(200).json({
      success: true,
      message: 'PDF uploaded successfully',
      data: {
        fileId: file.filename,
        pages: pdfDoc.getPageCount()
      }
    });
  } catch (error) {
    next(error);
  }
};

const editPdf = async (req, res, next) => {
  try {
    const { fileId, edits } = req.body;
    const filePath = path.join(__dirname, '..', 'uploads', fileId);
    const metadataPath = `${filePath}.json`;

    // Read the PDF and metadata
    const pdfBytes = await fs.readFile(filePath);
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Apply edits
    for (const edit of edits) {
      switch (edit.type) {
        case 'text':
          const page = pdfDoc.getPage(edit.pageIndex);
          page.drawText(edit.text, {
            x: edit.x,
            y: edit.y,
            size: edit.size || 12
          });
          break;

        case 'image':
          if (edit.imageData) {
            const imageBytes = Buffer.from(edit.imageData, 'base64');
            const image = await pdfDoc.embedPng(imageBytes);
            const page = pdfDoc.getPage(edit.pageIndex);
            page.drawImage(image, {
              x: edit.x,
              y: edit.y,
              width: edit.width,
              height: edit.height
            });
          }
          break;

        case 'delete':
          pdfDoc.removePage(edit.pageIndex);
          break;
      }
    }

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    const modifiedFilePath = path.join(path.dirname(filePath), `modified-${fileId}`);
    await fs.writeFile(modifiedFilePath, modifiedPdfBytes);

    // Update metadata
    metadata.modifiedAt = new Date().toISOString();
    metadata.modifiedPath = modifiedFilePath;
    await fs.writeFile(metadataPath, JSON.stringify(metadata));

    res.status(200).json({
      success: true,
      message: 'PDF edited successfully',
      data: {
        fileId: `modified-${fileId}`,
        pages: pdfDoc.getPageCount()
      }
    });
  } catch (error) {
    next(error);
  }
};

const downloadPdf = async (req, res, next) => {
  try {
    const { id } = req.params;
    const filePath = path.join(__dirname, '..', 'uploads', id);
    const metadataPath = `${filePath}.json`;

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new Error('File not found');
    }

    // Read metadata
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${metadata.originalname}`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadPdf,
  editPdf,
  downloadPdf
}; 