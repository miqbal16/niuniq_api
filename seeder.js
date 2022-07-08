const mongoose = require('mongoose');
const colors = require('colors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: './config/config.env' });

// Call model data
const Store = require('./models/Store.model');
const Product = require('./models/Product.model');
const User = require('./models/User.model');

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Read images file
const storeLogo = fs.readFileSync(path.join('_data', 'images', 'logo.png'));
const productPhoto = fs.readFileSync(path.join('_data', 'images', 'product.png'));
const storePhoto = fs.readFileSync(path.join('_data', 'images', 'store.jpg'));
const qrcodeImage = fs.readFileSync(path.join('_data', 'images', 'qrcode.png'));

const hostName = 'https://niuniq.herokuapp.com/documents/images/';

// Import Into DB
const importData = async () => {
  try {
    const storesData = JSON.parse(fs.readFileSync(path.join('_data', 'store.json'), 'utf-8'));
    const productsData = JSON.parse(fs.readFileSync(path.join('_data', 'product.json'), 'utf-8'));
    const copyStoreData = [...storesData];
    const copyProductData = [...productsData];
    const newStoreData = [];
    const newProductData = [];

    for (let i = 0; i < copyStoreData.length; i += 1) {
      const store = copyStoreData[i];
      store.photo = `${hostName}stores/photo_${store._id}.jpg`;
      store.logo = `${hostName}logos/logo_${store._id}.png`;
      newStoreData.push(store);
    }

    for (let i = 0; i < copyProductData.length; i += 1) {
      const product = copyProductData[i];
      const productPhotos = [];
      for (let j = 0; j < 5; j += 1) {
        productPhotos.push(`${hostName}products/photo_${product._id}_${j + 1}.jpg`);
      }
      product.qrCode = `${hostName}QRcodes/qrcode_${product._id}.png`;
      product.photos = productPhotos;
      newProductData.push(product);
    }

    fs.writeFileSync(path.join('_data', 'product.json'), JSON.stringify(newProductData), 'utf-8');
    fs.writeFileSync(path.join('_data', 'store.json'), JSON.stringify(newStoreData), 'utf-8');

    const stores = JSON.parse(fs.readFileSync(`${__dirname}/_data/store.json`, 'utf-8'));
    const products = JSON.parse(fs.readFileSync(`${__dirname}/_data/product.json`, 'utf-8'));
    const users = JSON.parse(fs.readFileSync(`${__dirname}/_data/user.json`, 'utf-8'));

    const store = await Store.create(stores);
    const product = await Product.create(products);
    await User.create(users);

    // Save photo dan logo store ke folder public
    for (let i = 0; i < store.length; i += 1) {
      fs.writeFileSync(path.join('public', 'documents', 'images', 'stores', `photo_${store[i]._id}.jpg`), storePhoto);
      fs.writeFileSync(path.join('public', 'documents', 'images', 'logos', `logo_${store[i]._id}.png`), storeLogo);
    }

    // Save photo dan qrcode product ke folder public
    for (let i = 0; i < product.length; i += 1) {
      for (let j = 0; j < 5; j += 1) {
        fs.writeFileSync(path.join('public', 'documents', 'images', 'products', `photo_${product[i]._id}_${j + 1}.jpg`), productPhoto);
      }

      fs.writeFileSync(path.join('public', 'documents', 'images', 'QRcodes', `qrcode_${product[i]._id}.png`), qrcodeImage);
    }

    console.log('Data Imported...'.green.inverse);
    process.exit();
  } catch (err) {
    console.log(err);
  }
};

// Delete data in DB
const destroyData = async () => {
  try {
    const stores = await Store.find();
    const products = await Product.find();

    await User.deleteMany();
    await Product.deleteMany();
    await Store.deleteMany();

    // Hapus semua photo store
    for (let i = 0; i < stores.length; i += 1) {
      fs.unlinkSync(`public/documents/images/stores/photo_${stores[i]._id}.jpg`);
      fs.unlinkSync(`public/documents/images/logos/logo_${stores[i]._id}.png`);
    }

    // Hapus semua photo dan qrcode product
    for (let i = 0; i < products.length; i += 1) {
      for (let j = 0; j < 5; j += 1) {
        fs.unlinkSync(`public/documents/images/products/photo_${products[i]._id}_${j + 1}.jpg`);
      }
      fs.unlinkSync(`public/documents/images/QRcodes/qrcode_${products[i]._id}.png`);
    }

    console.log('Data Destroyed...'.red.inverse);
    process.exit();
  } catch (err) {
    console.log(err);
  }
};

if (process.argv[2] === '-i') {
  importData();
} else if (process.argv[2] === '-d') {
  destroyData();
}
