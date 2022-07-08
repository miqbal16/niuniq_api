const express = require('express');

const router = express.Router({ mergeParams: true });

const {
  getProducts,
  getProduct,
  addProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/product.controller');

const { protect, authorize } = require('../middlewares/auth');

router
  .route('/')
  .get(protect, authorize('admin', 'user'), getProducts)
  .post(protect, authorize('admin', 'user'), addProduct);

router
  .route('/:id')
  .get(protect, getProduct)
  .put(protect, updateProduct)
  .delete(protect, deleteProduct);

module.exports = router;
