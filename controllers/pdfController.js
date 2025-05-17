const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const libre = require('libreoffice-convert');
const { promisify } = require('util');
const { exec } = require('child_process');
const convertAsync = promisify(libre.convert);

// Helper function to check if LibreOffice is installed
const checkLibreOffice = () => {
  return new Promise((resolve, reject) => {
    exec('soffice --version', (error) => {
      if (error) {
        reject(new Error('LibreOffice is not installed. Please install LibreOffice and add it to your system PATH.'));
      } else {
        resolve(true);
      }
    });
  });
};

// Helper function to create uploads directory if it doesn't exist
const ensureUploadsDir = async () => {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
  return uploadsDir;
};

const uploadPdf = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Read the uploaded PDF
    const pdfBytes = await fs.readFile(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const uploadsDir = await ensureUploadsDir();

    // Generate unique ID for the file
    const fileId = uuidv4();
    const newFilePath = path.join(uploadsDir, `${fileId}.pdf`);

    // Store metadata
    const metadata = {
      id: fileId,
      filename: file.originalname,
      size: file.size,
      path: newFilePath,
      pages: pdfDoc.getPageCount(),
      createdAt: new Date().toISOString(),
      operations: []
    };

    // Save the PDF with new name
    await fs.writeFile(newFilePath, pdfBytes);
    await fs.unlink(file.path); // Remove the temporary file

    // Save metadata
    const metadataPath = path.join(uploadsDir, `${fileId}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata));

    res.status(200).json({
      success: true,
      message: 'PDF uploaded successfully',
      data: {
        fileId,
        filename: file.originalname,
        pages: pdfDoc.getPageCount()
      }
    });
  } catch (error) {
    next(error);
  }
};

const editPdf = async (req, res, next) => {
  try {
    const { fileId, operations } = req.body;
    const uploadsDir = await ensureUploadsDir();
    const filePath = path.join(uploadsDir, `${fileId}.pdf`);
    const metadataPath = path.join(uploadsDir, `${fileId}.json`);

    // Read the PDF and metadata
    const pdfBytes = await fs.readFile(filePath);
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Apply operations
    for (const operation of operations) {
      switch (operation.type) {
        case 'text':
          const page = pdfDoc.getPage(operation.pageIndex);
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          page.drawText(operation.text, {
            x: operation.x,
            y: operation.y,
            size: operation.size || 12,
            font,
            color: rgb(0, 0, 0)
          });
          break;

        case 'image':
          if (operation.imageData) {
            const imageBytes = Buffer.from(operation.imageData, 'base64');
            const image = await pdfDoc.embedPng(imageBytes);
            const page = pdfDoc.getPage(operation.pageIndex);
            page.drawImage(image, {
              x: operation.x,
              y: operation.y,
              width: operation.width,
              height: operation.height
            });
          }
          break;

        case 'delete':
          pdfDoc.removePage(operation.pageIndex);
          break;

        case 'rotate':
          const pageToRotate = pdfDoc.getPage(operation.pageIndex);
          pageToRotate.setRotation(operation.angle);
          break;

        case 'merge':
          if (operation.otherPdfId) {
            const otherPdfPath = path.join(uploadsDir, `${operation.otherPdfId}.pdf`);
            const otherPdfBytes = await fs.readFile(otherPdfPath);
            const otherPdf = await PDFDocument.load(otherPdfBytes);
            const copiedPages = await pdfDoc.copyPages(otherPdf, otherPdf.getPageIndices());
            copiedPages.forEach(page => pdfDoc.addPage(page));
          }
          break;
      }

      // Record operation in metadata
      metadata.operations.push({
        type: operation.type,
        timestamp: new Date().toISOString(),
        details: operation
      });
    }

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    const newFileId = uuidv4();
    const newFilePath = path.join(uploadsDir, `${newFileId}.pdf`);
    await fs.writeFile(newFilePath, modifiedPdfBytes);

    // Update metadata
    metadata.modifiedAt = new Date().toISOString();
    metadata.modifiedPath = newFilePath;
    await fs.writeFile(metadataPath, JSON.stringify(metadata));

    res.status(200).json({
      success: true,
      message: 'PDF edited successfully',
      data: {
        fileId: newFileId,
        pages: pdfDoc.getPageCount(),
        operations: metadata.operations
      }
    });
  } catch (error) {
    next(error);
  }
};

const downloadPdf = async (req, res, next) => {
  try {
    const { id } = req.params;
    const uploadsDir = await ensureUploadsDir();
    const filePath = path.join(uploadsDir, `${id}.pdf`);
    const metadataPath = path.join(uploadsDir, `${id}.json`);

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
    res.setHeader('Content-Disposition', `attachment; filename=${metadata.filename}`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

const getPdfInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const uploadsDir = await ensureUploadsDir();
    const metadataPath = path.join(uploadsDir, `${id}.json`);

    // Read metadata
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));

    res.status(200).json({
      success: true,
      data: {
        id: metadata.id,
        filename: metadata.filename,
        size: metadata.size,
        pages: metadata.pages,
        createdAt: metadata.createdAt,
        modifiedAt: metadata.modifiedAt,
        operations: metadata.operations
      }
    });
  } catch (error) {
    next(error);
  }
};

const convertPdfToWord = async (req, res, next) => {
  try {
    // Check if LibreOffice is installed
    await checkLibreOffice();

    const { fileId } = req.body;
    if (!fileId) {
      throw new Error('File ID is required');
    }

    const uploadsDir = await ensureUploadsDir();
    const pdfPath = path.join(uploadsDir, `${fileId}.pdf`);

    // Check if file exists
    try {
      await fs.access(pdfPath);
    } catch {
      throw new Error('PDF file not found');
    }

    // Read the PDF file
    const pdfBuffer = await fs.readFile(pdfPath);

    // Convert to DOCX
    const docxBuffer = await convertAsync(pdfBuffer, '.docx', undefined);

    // Save the converted file
    const newFileId = uuidv4();
    const docxPath = path.join(uploadsDir, `${newFileId}.docx`);
    await fs.writeFile(docxPath, docxBuffer);

    res.status(200).json({
      success: true,
      message: 'PDF converted to Word successfully',
      data: {
        fileId: newFileId,
        filename: 'converted.docx'
      }
    });
  } catch (error) {
    console.error('PDF to Word conversion error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to convert PDF to Word',
      error: error.stack
    });
  }
};

const convertPdfToExcel = async (req, res, next) => {
  try {
    // Check if LibreOffice is installed
    await checkLibreOffice();

    const { fileId } = req.body;
    if (!fileId) {
      throw new Error('File ID is required');
    }

    const uploadsDir = await ensureUploadsDir();
    const pdfPath = path.join(uploadsDir, `${fileId}.pdf`);

    // Check if file exists
    try {
      await fs.access(pdfPath);
    } catch {
      throw new Error('PDF file not found');
    }

    // Read the PDF file
    const pdfBuffer = await fs.readFile(pdfPath);

    // Convert to XLSX
    const xlsxBuffer = await convertAsync(pdfBuffer, '.xlsx', undefined);

    // Save the converted file
    const newFileId = uuidv4();
    const xlsxPath = path.join(uploadsDir, `${newFileId}.xlsx`);
    await fs.writeFile(xlsxPath, xlsxBuffer);

    res.status(200).json({
      success: true,
      message: 'PDF converted to Excel successfully',
      data: {
        fileId: newFileId,
        filename: 'converted.xlsx'
      }
    });
  } catch (error) {
    console.error('PDF to Excel conversion error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to convert PDF to Excel',
      error: error.stack
    });
  }
};

const convertPdfToJpg = async (req, res, next) => {
  try {
    const { fileId } = req.body;
    const uploadsDir = await ensureUploadsDir();
    const pdfPath = path.join(uploadsDir, `${fileId}.pdf`);

    // Read the PDF file
    const pdfBuffer = await fs.readFile(pdfPath);

    // Convert to JPG
    const jpgBuffer = await convertAsync(pdfBuffer, '.jpg', undefined);

    // Save the converted file
    const newFileId = uuidv4();
    const jpgPath = path.join(uploadsDir, `${newFileId}.jpg`);
    await fs.writeFile(jpgPath, jpgBuffer);

    res.status(200).json({
      success: true,
      message: 'PDF converted to JPG successfully',
      data: {
        fileId: newFileId,
        filename: 'converted.jpg'
      }
    });
  } catch (error) {
    next(error);
  }
};

const convertPdfToPpt = async (req, res, next) => {
  try {
    const { fileId } = req.body;
    const uploadsDir = await ensureUploadsDir();
    const pdfPath = path.join(uploadsDir, `${fileId}.pdf`);

    // Read the PDF file
    const pdfBuffer = await fs.readFile(pdfPath);

    // Convert to PPT
    const pptBuffer = await convertAsync(pdfBuffer, '.pptx', undefined);

    // Save the converted file
    const newFileId = uuidv4();
    const pptPath = path.join(uploadsDir, `${newFileId}.pptx`);
    await fs.writeFile(pptPath, pptBuffer);

    res.status(200).json({
      success: true,
      message: 'PDF converted to PowerPoint successfully',
      data: {
        fileId: newFileId,
        filename: 'converted.pptx'
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadPdf,
  editPdf,
  downloadPdf,
  getPdfInfo,
  convertPdfToWord,
  convertPdfToExcel,
  convertPdfToJpg,
  convertPdfToPpt
}; 