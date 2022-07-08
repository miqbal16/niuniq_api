const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email must be entered'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Masukan email yang valid',
    ],
  },
  noTelepon: {
    type: String,
    required: [true, 'Phone number must be entered'],
    trim: true,
    maxlength: [14, 'Phone number cannot be more than 14 digits'],
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Password must be entered'],
    minlength: 6,
    select: false,
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  hasCreatedStore: {
    type: Boolean,
    default: false,
  },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Menghapus semua produk yang berkaitan ketika market di hapus
UserSchema.pre('remove', async function (next) {
  const Product = this.model('Product');
  const Store = this.model('Store');
  await Product.deleteMany({ user: this._id });
  await Store.deleteMany({ user: this._id });
  next();
});

// Menampilkan data market secara virtual di user
UserSchema.virtual('store', {
  ref: 'Store',
  localField: '_id',
  foreignField: 'user',
  justOne: false,
});

// Encrypt Password Using Bycrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and Return
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password token
UserSchema.methods.getResetPasswordToken = function () {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model('User', UserSchema);
