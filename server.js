const express = require('express');
const dotenv = require('dotenv');
const colors = require('colors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const connectDB = require('./config/db');

dotenv.config({ path: './config/config.env' });

// cennect to database mongoDB
connectDB();

const app = express();

// Use third party middleware

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 1000,
});

app.use(limiter);
app.use(hpp());
app.use(express.json());
app.use(fileUpload());
app.use(cookieParser());
app.use((helmet()));
app.use(xss());
app.use(cors());
app.use(mongoSanitize());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, UPDATE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
  res.header('Access-Control-Allow-Credentials', true);
  next();
});

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// calling routes and utility files
const storeRoute = require('./routes/store.routes');
const productRoute = require('./routes/product.routes');
const buyerProductRoute = require('./routes/buyerProduct.routes');
const authRoute = require('./routes/auth.routes');
const userRoute = require('./routes/users.routes');
const errorHandler = require('./middlewares/errorHandler');

// route and utility handler
app.use('/api/web/niuniq/stores', storeRoute);
app.use('/api/web/niuniq/products', productRoute);
app.use('/api/web/niuniq/auth', authRoute);
app.use('/api/web/niuniq/users', userRoute);
app.use('/api/web/niuniq/search', buyerProductRoute);
app.use(errorHandler);

const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
  console.log(`server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold);
});

// Handle promise rejection
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`.red);
  server.close(() => process.exit(1));
});
