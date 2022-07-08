const express = require('express');

const router = express.Router();

// Call products route file
const productRoute = require('./product.routes');

router.use('/:storeId/products', productRoute);

const {
  getStores,
  getStore,
  createStore,
  updateStore,
  deleteStore,
} = require('../controllers/store.controller');

const { protect, authorize } = require('../middlewares/auth');

router
  .route('/')
  .get(protect, authorize('admin'), getStores)
  .post(protect, createStore);

router
  .route('/:id')
  .get(protect, getStore)
  .put(protect, updateStore)
  .delete(protect, deleteStore);

module.exports = router;
