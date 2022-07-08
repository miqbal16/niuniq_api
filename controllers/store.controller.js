const fs = require('fs');
const Store = require('../models/Store.model');
const User = require('../models/User.model');
const ErrorResponse = require('../utils/ErrorResponse');
const asyncHandler = require('../middlewares/asyncHandler');

// @desc:         Get All Stores
// @route:        GET /api/web/niuniq/stores
// @access:       Public
exports.getStores = asyncHandler(async (req, res, next) => {
  let query;

  // copy request query
  const reqQuery = { ...req.body };

  // menghapus field select,sort agar tidak ambigu dengan field data
  const removeField = ['select', 'sort', 'page', 'limit'];

  // hapus field dari reqQuery
  removeField.forEach((param) => delete reqQuery[param]);

  let queryStr = JSON.stringify(req.query);

  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, (match) => `$${match}`);

  query = Store.find(JSON.parse(queryStr));

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
  const stores = await query;

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
      count: stores.length,
      pagination,
      data: stores,
    });
});

// @desc:         GeT Single Store
// @route:        GET /api/web/niuniq/stores/:id
// @access:       Public
exports.getStore = asyncHandler(async (req, res, next) => {
  const store = await Store.findById(req.params.id);
  if (!store) {
    return next(new ErrorResponse(`Store not found with id of ${req.params.id}`, 404));
  }
  res
    .status(200)
    .json({
      success: true,
      data: store,
    });
});

// @desc:         Create Store
// @route:        POST /api/web/niuniq/stores
// @access:       Private (Need Auth)
exports.createStore = asyncHandler(async (req, res, next) => {
  let storePhoto;
  let logo;

  // Add user to req.body
  req.body.user = req.user.id;

  // Cek apakah user telah memiliki market
  const publishedStore = await Store.findOne({ user: req.user.id });

  if (publishedStore && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `The user with ID ${req.user.id} has already create a store`,
        400,
      ),
    );
  }

  const upload = req.files;

  // Cek apakah photo dan logo sudah di input
  if (!upload
    || !upload.logo
    || !upload.photo) {
    return next(new ErrorResponse('Logo and photo must be input', 400));
  }

  // Cek apakah photo dan logo sudah sesuai formatnya
  if ((upload.logo.mimetype !== 'image/jpeg'
    && upload.logo.mimetype !== 'image/jpg'
    && upload.logo.mimetype !== 'image/png')
    || (upload.photo.mimetype !== 'image/jpeg'
    && upload.photo.mimetype !== 'image/jpg'
    && upload.photo.mimetype !== 'image/png')) {
    return next(new ErrorResponse('The file logo and photo must be in jpeg, jpg, or png format', 400));
  }

  if (upload.logo.size > process.env.MAX_FILE_PHOTO
    || upload.photo.size > process.env.MAX_FILE_PHOTO) {
    return next(
      new ErrorResponse(`Logo and photo size cannot be more than ${process.env.MAX_FILE_VIDEO / 1000000} mb`),
    );
  }

  let store = await Store.create(req.body);

  upload.logo.name = `logo_${store._id}.png`;
  upload.photo.name = `photo_${store._id}.jpg`;

  upload.logo.mv(`${process.env.FILE_UPLOAD_LOGO_STORE_PATH}/${upload.logo.name}`, async (err) => {
    if (err) {
      await store.remove();
      console.error(err);
      return next(new ErrorResponse('Problem with file upload', 500));
    }
  });

  upload.photo.mv(`${process.env.FILE_UPLOAD_PHOTO_STORE_PATH}/${upload.photo.name}`, async (err) => {
    if (err) {
      await store.remove();
      console.error(err);
      return next(new ErrorResponse('Problem with file upload', 500));
    }
  });

  const photoDir = `${req.protocol}://${req.get('host')}/documents/images/stores/`;
  const logoDir = `${req.protocol}://${req.get('host')}/documents/images/logos/`;

  storePhoto = photoDir + upload.photo.name;
  logo = logoDir + upload.logo.name;

  store = await Store.findByIdAndUpdate(
    store._id,
    { photo: storePhoto, logo },
    {
      new: true,
      runValidators: true,
    },
  );

  await User.findByIdAndUpdate(
    req.user._id,
    { hasCreatedStore: true },
    { new: true, runValidators: true },
  );

  res
    .status(201)
    .json({
      success: true,
      data: store,
    });
});

// @desc:         Update Store
// @route:        PUT /api/niuniq/stores/:id
// @access:       Private (Need Auth)
exports.updateStore = asyncHandler(async (req, res, next) => {
  let storePhoto;
  let logo;

  let store = await Store.findById(req.params.id);
  if (!store) {
    return next(new ErrorResponse(`Store not found with id of ${req.params.id}`, 404));
  }

  // Memastikan bahwa market yang di ubah adalah milik user
  if (store.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this store`,
        401,
      ),
    );
  }

  const upload = req.files;
  if (!upload
    || !upload.logo
    || !upload.photo) {
    return next(new ErrorResponse('Photo and logo must be entered', 400));
  }

  if ((upload.logo.mimetype !== 'image/jpeg'
    && upload.logo.mimetype !== 'image/jpg'
    && upload.logo.mimetype !== 'image/png')
    || (upload.photo.mimetype !== 'image/jpeg'
    && upload.photo.mimetype !== 'image/jpg'
    && upload.photo.mimetype !== 'image/png')) {
    return next(new ErrorResponse('The file logo and photo must be in jpeg, jpg, or png format', 400));
  }

  if (upload.logo.size > process.env.MAX_FILE_PHOTO
    || upload.photo.size > process.env.MAX_FILE_PHOTO) {
    return next(
      new ErrorResponse(`logo and photo size cannot be more than ${process.env.MAX_FILE_VIDEO / 1000000} mb`),
    );
  }
  upload.logo.name = `logo_${store._id}.png`;
  upload.photo.name = `photo_${store._id}.jpg`;

  upload.logo.mv(`${process.env.FILE_UPLOAD_LOGO_STORE_PATH}${upload.logo.name}`, async (err) => {
    if (err) {
      console.error(err);
      return next(new ErrorResponse('Problem with file upload', 500));
    }
  });

  upload.photo.mv(`${process.env.FILE_UPLOAD_PHOTO_STORE_PATH}${upload.photo.name}`, async (err) => {
    if (err) {
      console.error(err);
      return next(new ErrorResponse('Problem with file upload', 500));
    }
  });

  const photoDir = `${req.protocol}://${req.get('host')}/documents/images/stores/`;
  const logoDir = `${req.protocol}://${req.get('host')}/documents/images/logos/`;
  storePhoto = photoDir + upload.photo.name;
  logo = logoDir + upload.logo.name;

  // Menginput nama photo dan logo baru ke body
  req.body.photo = storePhoto;
  req.body.logo = logo;

  store = await Store.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res
    .status(200)
    .json({
      success: true,
      data: store,
    });
});

// @desc:         Delete Store
// @route:        DELETE /api/niuniq/stores/:id
// @access:       Private (Need Auth)
exports.deleteStore = asyncHandler(async (req, res, next) => {
  const store = await Store.findById(req.params.id).populate('products');

  if (!store) {
    return next(new ErrorResponse(`Store not found with id of ${req.params.id}`, 404));
  }

  // Memastikan bahwa market yang di hapus adalah milik user
  if (store.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to delete this store`,
        401,
      ),
    );
  }

  store.remove();

  // Hapus semua foto dan video product yang dimiliki oleh store
  for (let i = 0; i < store.products.length; i += 1) {
    for (let j = 0; j < store.products[i].photos.length; j += 1) {
      fs.unlinkSync(`${process.env.FILE_UPLOAD_PHOTO_PRODUCT_PATH}photo_${store.products[i]._id[j]}_${j + 1}.jpg`);
    }

    // if (store.products[i].video) {
    //   fs.unlinkSync(`public/documents/videos/${store.products[i].video}`);
    // }

    // Hapus QRCode Image
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

  await User.findByIdAndUpdate(
    req.user._id,
    { hasCreatedStore: false },
    { new: true, runValidators: true },
  );

  res
    .status(200)
    .json({
      success: true,
      data: {},
    });
});
