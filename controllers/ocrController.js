const { createWorker } = require('tesseract.js');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

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

// Helper function to convert PDF page to image
const convertPdfPageToImage = async (pdfBytes, pageIndex) => {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const page = pdfDoc.getPage(pageIndex);
  const { width, height } = page.getSize();
  
  // Create a PNG image from the PDF page
  const pngBytes = await page.png({
    width: width * 2, // Double the resolution for better OCR
    height: height * 2
  });
  
  return pngBytes;
};

// Helper function to preprocess image for better OCR
const preprocessImage = async (imageBuffer) => {
  return sharp(imageBuffer)
    .grayscale() // Convert to grayscale
    .normalize() // Normalize contrast
    .sharpen() // Sharpen the image
    .toBuffer();
};

const extractTextFromPdf = async (req, res, next) => {
  try {
    const { fileId, pageIndex } = req.body;
    const uploadsDir = await ensureUploadsDir();
    const filePath = path.join(uploadsDir, `${fileId}.pdf`);

    // Read the PDF
    const pdfBytes = await fs.readFile(filePath);
    
    // Convert PDF page to image
    const imageBytes = await convertPdfPageToImage(pdfBytes, pageIndex);
    
    // Preprocess the image
    const processedImage = await preprocessImage(imageBytes);
    
    // Initialize Tesseract worker
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    // Perform OCR
    const { data: { text } } = await worker.recognize(processedImage);
    
    // Terminate worker
    await worker.terminate();

    // Save the extracted text
    const textId = uuidv4();
    const textPath = path.join(uploadsDir, `${textId}.txt`);
    await fs.writeFile(textPath, text);

    res.status(200).json({
      success: true,
      message: 'Text extracted successfully',
      data: {
        textId,
        text,
        pageIndex
      }
    });
  } catch (error) {
    next(error);
  }
};

const extractTextFromImage = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Read the image
    const imageBytes = await fs.readFile(file.path);
    
    // Preprocess the image
    const processedImage = await preprocessImage(imageBytes);
    
    // Initialize Tesseract worker
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    // Perform OCR
    const { data: { text } } = await worker.recognize(processedImage);
    
    // Terminate worker
    await worker.terminate();

    // Save the extracted text
    const uploadsDir = await ensureUploadsDir();
    const textId = uuidv4();
    const textPath = path.join(uploadsDir, `${textId}.txt`);
    await fs.writeFile(textPath, text);

    // Clean up the uploaded file
    await fs.unlink(file.path);

    res.status(200).json({
      success: true,
      message: 'Text extracted successfully',
      data: {
        textId,
        text
      }
    });
  } catch (error) {
    next(error);
  }
};

const batchExtractTextFromPdf = async (req, res, next) => {
  try {
    const { fileId } = req.body;
    const uploadsDir = await ensureUploadsDir();
    const filePath = path.join(uploadsDir, `${fileId}.pdf`);

    // Read the PDF
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();

    // Initialize Tesseract worker
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    const results = [];
    
    // Process each page
    for (let i = 0; i < pageCount; i++) {
      // Convert PDF page to image
      const imageBytes = await convertPdfPageToImage(pdfBytes, i);
      
      // Preprocess the image
      const processedImage = await preprocessImage(imageBytes);
      
      // Perform OCR
      const { data: { text } } = await worker.recognize(processedImage);
      
      results.push({
        pageIndex: i,
        text
      });
    }

    // Terminate worker
    await worker.terminate();

    // Save all extracted text
    const textId = uuidv4();
    const textPath = path.join(uploadsDir, `${textId}.txt`);
    await fs.writeFile(textPath, JSON.stringify(results, null, 2));

    res.status(200).json({
      success: true,
      message: 'Text extracted from all pages successfully',
      data: {
        textId,
        results
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  extractTextFromPdf,
  extractTextFromImage,
  batchExtractTextFromPdf
}; 