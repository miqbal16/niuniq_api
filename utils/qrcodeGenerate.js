const QRcode = require('qrcode');
const textOverlay = require('./imageManipulation');

const generateQRCode = async (url, productId, nameFile) => {
  const path = `${process.env.FILE_UPLOAD_QRCODE_PRODUCT_PATH}/${nameFile}`;
  try {
    // Create QRCode Image
    await QRcode.toFile(path, url, { width: 800, margin: 8 });
    // Edit Image QRCode With Add ProductId in Image
    textOverlay(path, productId);
  } catch (err) {
    console.log(err);
  }
};

module.exports = generateQRCode;
