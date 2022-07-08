const Jimp = require('jimp');

const textOverlay = async (fileImage, text) => {
  // Reading image
  const image = await Jimp.read(fileImage);
  // Defining the text font
  const font = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);
  image.print(font, 223, 700, text);
  // Writing image after processing
  await image.writeAsync(fileImage);
};

module.exports = textOverlay;
