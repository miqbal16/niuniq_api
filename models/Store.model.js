const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const indonesiaTerritory = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_data', 'indonesiaTerritory.json'), 'utf-8'));

const StoreSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Store name must be entered'],
    trim: true,
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  logo: String,
  photo: String,
  ecommerces: [String],
  ecommercesUrl: [String],
  yearProduction: {
    type: Number,
    required: [true, 'Year production must be entered'],
  },
  regency: {
    type: String,
    required: [true, 'Regency must be entered'],
    enum: indonesiaTerritory.regencies,
  },
  province: {
    type: String,
    required: [true, 'Province must be entered'],
    enum: indonesiaTerritory.provinces,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Menghapus semua produk yang berkaitan ketika market di hapus
StoreSchema.pre('remove', async function (next) {
  const Product = this.model('Product');
  await Product.deleteMany({ store: this._id });
  next();
});

// Menampilkan data product secara virtual di market
StoreSchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'store',
  justOne: false,
});

module.exports = mongoose.model('Store', StoreSchema);
