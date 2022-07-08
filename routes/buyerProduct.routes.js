const express = require('express');
const { searchProductByProductId } = require('../controllers/product.controller');

const router = express.Router();

router
  .route('/')
  .get(searchProductByProductId);

module.exports = router;
