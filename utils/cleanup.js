const fs = require('fs').promises;
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const MAX_FILE_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

const cleanupOldFiles = async () => {
  try {
    const files = await fs.readdir(UPLOAD_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(UPLOAD_DIR, file);
      const stats = await fs.stat(filePath);

      // Check if file is older than MAX_FILE_AGE
      if (now - stats.mtime.getTime() > MAX_FILE_AGE) {
        await fs.unlink(filePath);
        console.log(`Deleted old file: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};

// Run cleanup every hour
setInterval(cleanupOldFiles, 60 * 60 * 1000);

module.exports = {
  cleanupOldFiles
}; 