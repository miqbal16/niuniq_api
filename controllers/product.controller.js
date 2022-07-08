const fs = require('fs');
const asyncHandler = require('../middlewares/asyncHandler');
const Product = require('../models/Product.model');
const Store = require('../models/Store.model');
const generateQRCode = require('../utils/qrcodeGenerate');
const ErrorResponse = require('../utils/ErrorResponse');

// @desc:         Get All Products
// @route:        GET /api/web/niuniq/markets/:storeId/products || /api/web/niuniq/products
// @access:       Public
exports.getProducts = asyncHandler(async (req, res, next) => {
  let query;

  // copy request query
  const reqQuery = { ...req.body };

  // menghapus field select,sort agar tidak ambigu dengan field data
  const removeField = ['select', 'sort', 'page', 'limit'];

  // hapus field dari reqQuery
  removeField.forEach((param) => delete reqQuery[param]);

  let queryStr = JSON.stringify(req.query);

  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, (match) => `$${match}`);

  if (req.params.storeId) {
    query = Product.find({ store: req.params.storeId, ...JSON.parse(queryStr) });
  } else {
    query = Product.find(JSON.parse(queryStr));
  }

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
  const total = await Product.countDocuments(JSON.parse(queryStr));

  query = query.skip(startIndex).limit(limit);

  // Executing query
  const products = await query;

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
      count: products.length,
      pagination,
      data: products,
    });
});

// @desc:         Get Single Product
// @route:        GET /api/web/niuniq/products/:id
// @access:       Public
exports.getProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id).populate({ path: 'store' });
  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
  }
  res
    .status(200)
    .json({
      success: true,
      data: product,
    });
});

// @desc:         Add Product
// @route:        POST /api/web/niuniq/markets/:storeId/products
// @access:       Private (Need Auth)
exports.addProduct = asyncHandler(async (req, res, next) => {
  req.body.store = req.params.storeId;
  req.body.user = req.user.id;

  const store = await Store.findById(req.params.storeId);

  if (!store) {
    return next(
      new ErrorResponse(
        `No store with the id of ${req.params.storeId}`,
        404,
      ),
    );
  }

  // Memastikan bahwa user adalah pemilik dari market
  if (store.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to add a product to store ${store._id}`,
        401,
      ),
    );
  }

  const upload = req.files;

  const fileImage = [];
  // let fileVideo;

  // Cek apakah photo telah di input semua
  if (!upload
    || !upload.images
    || !upload.images.length
    || upload.images.length < 5) {
    return next(new ErrorResponse('All photos must be entered', 400));
  }

  // Validasi format photo
  for (let i = 0; i < upload.images.length; i += 1) {
    if (upload.images[i].mimetype !== 'image/jpeg'
    && upload.images[i].mimetype !== 'image/jpg'
    && upload.images[i].mimetype !== 'image/png') {
      return next(new ErrorResponse('The file photo must be in jpeg, jpg, or png format', 400));
    }
  }

  // Validasi format video
  // if (upload.video.mimetype !== 'video/mp4'
  // && upload.video.mimetype !== 'video/3gp'
  // && upload.video.mimetype !== 'video/mkv'
  // && upload.video.mimetype !== 'video/x-matroska') {
  //   await product.remove();
  //   return next(new ErrorResponse('The file video must be in 3gp, mp4, or mkv format', 400));
  // }

  // Cek apakah photo yg di upload melebihi limit size
  for (let i = 0; i < upload.images.length; i += 1) {
    if (upload.images[i].size > process.env.MAX_FILE_PHOTO) {
      return next(
        new ErrorResponse(`Uploaded photos cannot be more than ${process.env.MAX_FILE_PHOTO / 1000000} mb`, 400),
      );
    }
  }

  // Cek apakah video yg di upload melebihi limit size
  // if (upload.video.size > process.env.MAX_FILE_VIDEO) {
  //   await product.remove();
  //   return next(
  //     new ErrorResponse(`Uploaded videos cannot be more than ${process.env.MAX_FILE_VIDEO /
  // 1000000} mb`),
  //   );
  // }

  let product = await Product.create(req.body);

  // Membuat nama photo yang baru
  for (let i = 0; i < upload.images.length; i += 1) {
    upload.images[i].name = `photo_${product._id}_${i + 1}.jpg`;
  }

  // Membuat nama video yang baru
  // upload.video.name = `video_${product._id}.mp4`;

  // Image direction save
  const photoDir = `${req.protocol}://${req.get('host')}/documents/images/products/`;
  const qrCodeDir = `${req.protocol}://${req.get('host')}/documents/images/QRcodes/`;

  // Save photo ke folder public
  for (let i = 0; i < upload.images.length; i += 1) {
    upload.images[i].mv(`${process.env.FILE_UPLOAD_PHOTO_PRODUCT_PATH}/${upload.images[i].name}`, async (err) => {
      if (err) {
        await product.remove();
        console.error(err);
        return next(new ErrorResponse('Problem with file upload'), 500);
      }
    });
    fileImage.push(photoDir + upload.images[i].name);
  }

  // Save video ke folder public
  // upload.video.mv(`${process.env.FILE_UPLOAD_VIDEO_PATH}/${upload.video.name}`, async (err) => {
  //   if (err) {
  //     await product.remove();
  //     console.error(err);
  //     return next(new ErrorResponse('Problem with file upload', 500));
  //   }
  // });

  // fileVideo = upload.video.name;

  // Membuat QRCode
  const url = `${req.protocol}://${req.headers.host}/api/web/niuniq/search?productId=${product.productId}`;
  const QRcodeFileName = `${qrCodeDir}qrcode_${product._id}.png`;
  generateQRCode(url, product.productId, `qrcode_${product._id}.png`);

  // Save photo dan qrcode
  product = await Product.findByIdAndUpdate(
    product._id,
    { photos: fileImage, qrCode: QRcodeFileName },
    {
      new: true,
      runValidators: true,
    },
  );

  res
    .status(201)
    .json({
      success: true,
      data: product,
    });
});

// @desc:         Update Product
// @route:        PUT /api/web/niuniq/products/:id
// @access:       Private (Need Auth)
exports.updateProduct = asyncHandler(async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(
      new ErrorResponse(`No product with the id of ${req.params.id}`, 404),
    );
  }

  // Memastikan bahwa user adalah pemilik product
  if (product.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update product ${product._id}`,
        401,
      ),
    );
  }

  const upload = req.files;

  const fileImage = [];
  // let fileVideo;

  // Cek apakah photo telah di input semua
  if (!upload
    || !upload.images
    || !upload.images.length
    || upload.images.length < 5) {
    return next(new ErrorResponse('All photos must be entered', 400));
  }

  // Validasi format photo
  for (let i = 0; i < upload.images.length; i += 1) {
    if (upload.images[i].mimetype !== 'image/jpeg'
    && upload.images[i].mimetype !== 'image/jpg'
    && upload.images[i].mimetype !== 'image/png') {
      return next(new ErrorResponse('The file photo must be in jpeg, jpg, or png format', 400));
    }
  }

  // Validasi format video
  // if (upload.video.mimetype !== 'video/mp4'
  // && upload.video.mimetype !== 'video/3gp'
  // && upload.video.mimetype !== 'video/mkv'
  // && upload.video.mimetype !== 'video/x-matroska') {
  //   return next(new ErrorResponse('The file video must be in 3gp, mp4, or mkv format', 400));
  // }

  // Cek apakah photo yg di upload melebihi limit size
  for (let i = 0; i < upload.images.length; i += 1) {
    if (upload.images[i].size > process.env.MAX_FILE_PHOTO) {
      return next(
        new ErrorResponse(`Uploaded photos cannot be more than ${process.env.MAX_FILE_PHOTO / 1000000} mb`, 400),
      );
    }
  }

  // Cek apakah video yg di upload melebihi limit size
  // if (upload.video.size > process.env.MAX_FILE_VIDEO) {
  //   return next(
  //     new ErrorResponse(`Uploaded videos cannot be more than ${process.env.MAX_FILE_VIDEO /
  // 1000000} mb`),
  //   );
  // }

  // Membuat nama photo yang baru
  for (let i = 0; i < upload.images.length; i += 1) {
    upload.images[i].name = `photo_${product._id}_${i + 1}.jpg`;
  }

  // Membuat nama video yang baru
  // upload.video.name = `video_${product._id}.mp4`;

  // Image direction save
  const photoDir = `${req.protocol}://${req.get('host')}/documents/images/products/`;

  // Save photo ke folder public
  for (let i = 0; i < upload.images.length; i += 1) {
    upload.images[i].mv(`${process.env.FILE_UPLOAD_PHOTO_PRODUCT_PATH}/${upload.images[i].name}`, async (err) => {
      if (err) {
        console.error(err);
        return next(new ErrorResponse('Problem with file upload'), 500);
      }
    });
    fileImage.push(photoDir + upload.images[i].name);
  }

  // Save video ke folder public
  // upload.video.mv(`${process.env.FILE_UPLOAD_VIDEO_PATH}/${upload.video.name}`, async (err) => {
  //   if (err) {
  //     console.error(err);
  //     return next(new ErrorResponse('Problem with file upload', 500));
  //   }
  // });

  // fileVideo = upload.video.name;
  req.body.photos = fileImage;
  // req.body.video = fileVideo;

  product = await Product.findByIdAndUpdate(
    product._id,
    req.body,
    {
      new: true,
      runValidators: true,
    },
  );

  res
    .status(200)
    .json({
      success: true,
      data: product,
    });
});

// @desc      Delete Product
// @route     DELETE /api/web/niuniq/products/:id
// @access    Private (Need Auth)
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(
      new ErrorResponse(`No product with the id of ${req.params.id}`, 404),
    );
  }

  // Memastikan bahwa user adalah pemilik dari product
  if (product.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to delete product ${product._id}`,
        401,
      ),
    );
  }

  await product.remove();

  // Menghapus semua photo dari product yang di hapus
  for (let i = 0; i < product.photos.length; i += 1) {
    fs.unlinkSync(`public/documents/images/products/photo_${product._id}_${i + 1}.jpg`);
  }

  // Menghapus video product
  // fs.unlinkSync(`public/documents/videos/${product.video}`);

  // Menghapus QRcode image dari product
  if (product.qrCode) {
    fs.unlinkSync(`public/documents/images/QRcodes/qrcode_${product._id}.png`);
  }

  res
    .status(200)
    .json({
      success: true,
      data: {},
    });
});

// @desc:         Search Product By ProductId
// @route:        GET /api/web/niuniq/search
// @access:       Public
exports.searchProductByProductId = asyncHandler(async (req, res, next) => {
  const product = await Product.findOne({ productId: req.query.product })
    .populate({ path: 'store' });

  if (!product) {
    return next(new ErrorResponse('Product not registered', 404));
  }
  res
    .status(200)
    .json({
      success: true,
      data: product,
    });
});
