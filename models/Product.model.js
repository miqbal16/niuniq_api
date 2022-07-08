const mongoose = require('mongoose');
const ShortUniqueId = require('short-unique-id');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name must be entered'],
    trim: true,
  },
  productId: {
    type: String,
    unique: true,
  },
  rawMaterials: {
    type: String,
    required: [true, 'Raw materials be entered'],
  },
  description: {
    type: String,
    required: [true, 'Description must be entered'],
  },
  productStorage: {
    type: String,
    required: [true, 'Product storage must be entered'],
  },
  photos: [String],
  video: {
    type: String,
    required: [true, 'Video must be entered'],
  },
  isVerification: {
    type: Boolean,
    default: null,
  },
  qrCode: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  store: {
    type: mongoose.Schema.ObjectId,
    ref: 'Store',
    required: true,
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
});

// Menambahakan productId sebelum data di save ke database
ProductSchema.pre('save', function (next) {
  const uid = new ShortUniqueId({ length: 10 });
  this.productId = uid();
  next();
});

module.exports = mongoose.model('Product', ProductSchema);
