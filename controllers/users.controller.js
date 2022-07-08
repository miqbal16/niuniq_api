const bcrypt = require('bcryptjs');
const fs = require('fs');
const ErrorResponse = require('../utils/ErrorResponse');
const asyncHandler = require('../middlewares/asyncHandler');
const User = require('../models/User.model');
const Store = require('../models/Store.model');

// @desc      Get all users
// @route     GET /api/web/niuniq/users
// @access    Private/Admin
exports.getUsers = asyncHandler(async (req, res, next) => {
  let query;

  // copy request query
  const reqQuery = { ...req.body };

  // menghapus field select,sort agar tidak ambigu dengan field data
  const removeField = ['select', 'sort', 'page', 'limit'];

  // hapus field dari reqQuery
  removeField.forEach((param) => delete reqQuery[param]);

  let queryStr = JSON.stringify(req.query);

  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, (match) => `$${match}`);

  query = User.find(JSON.parse(queryStr)).populate({ path: 'store', select: 'name' }).select('+password');

  // select fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }

  // sort
  if (req.query.sort) {
    const fields = req.query.sort.split(',').join(' ');
    query = query.sort(fields);
  } else {
    query = query.sort('-createdAt');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 5;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Store.countDocuments(JSON.parse(queryStr));

  query = query.skip(startIndex).limit(limit);

  // Executing query
  const users = await query;

  // Pagination result
  const pagination = {};

  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit,
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit,
    };
  }

  res
    .status(200)
    .json({
      success: true,
      count: users.length,
      pagination,
      data: users,
    });
});

// @desc      Get single user
// @route     GET /api/web/niuniq/users/:id
// @access    Private/Admin
exports.getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('+password');

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc      Create users
// @route     POST /api/web/niuniq/users
// @access    Private/Admin
exports.createUser = asyncHandler(async (req, res, next) => {
  const user = await User.create(req.body);

  res.status(201).json({
    success: true,
    data: user,
  });
});

// @desc      Update user
// @route     PUT /api/web/niuniq/users/:id
// @access    Private/Admin
exports.updateUser = asyncHandler(async (req, res, next) => {
  const salt = await bcrypt.genSalt(10);
  req.body.password = await bcrypt.hash(req.body.password, salt);

  const store = await Store.findOne({ user: req.params.id });

  if (!store) {
    return next(new ErrorResponse(`User with id ${req.params.id} not have market`, 404));
  }

  if (req.body.storeName) {
    store.name = req.body.storeName;
    await store.save();
  }

  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).select('+password').populate({ path: 'store', select: 'name' });

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc      Delete user
// @route     DELETE /api/web/niuniq/users/:id
// @access    Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id).populate('store');

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  const store = await Store.findOne({ user: req.params.id }).populate('products');

  // Hapus semua foto dan video product yang dimiliki oleh market
  if (store) {
    for (let i = 0; i < store.products.length; i += 1) {
      for (let j = 0; j < store.products[i].photos.length; j += 1) {
        fs.unlinkSync(`${process.env.FILE_UPLOAD_PHOTO_PRODUCT_PATH}photo_${store.products[i]._id}_${j + 1}.jpg`);
      }

      // if (store.products[i].video) {
      //   fs.unlinkSync(`public/documents/videos/${store.products[i].video}`);
      // }
      // Hapus QRCode Image Seluruh Produk
      if (store.products[i].qrCode) {
        fs.unlinkSync(`${process.env.FILE_UPLOAD_QRCODE_PRODUCT_PATH}qrcode_${store.products[i]._id}.png`);
      }
    }

    // Hapus photo store
    if (store.photo) {
      fs.unlinkSync(`${process.env.FILE_UPLOAD_PHOTO_STORE_PATH}photo_${store._id}.jpg`);
    }

    // Hapus logo store
    if (store.logo) {
      fs.unlinkSync(`${process.env.FILE_UPLOAD_LOGO_STORE_PATH}logo_${store._id}.png`);
    }
  }

  user.remove();

  res.status(200).json({
    success: true,
    data: {},
  });
});
