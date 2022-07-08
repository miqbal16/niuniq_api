const crypto = require('crypto');
const User = require('../models/User.model');
const ErrorResponse = require('../utils/ErrorResponse');
const sendEmail = require('../utils/sendEmail');
const asyncHandler = require('../middlewares/asyncHandler');

// @desc:         Register User
// @route:        POST /api/web/niuniq/auth/register
// @access:       Public
exports.register = asyncHandler(async (req, res, next) => {
  const { email, noTelepon, role, password } = req.body;
  const user = await User.create({ email, noTelepon, role, password });

  sendTokenResponse(user, 200, res);
});

// @desc:         Login User
// @route:        POST /api/web/niuniq/auth/login
// @access:       Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Melakukan validasi email dan password
  if (!email || !password) {
    return next(new ErrorResponse('Masukan email dan password', 400));
  }

  // Periksa apakah user terdaftar
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Cek apakah password yang di input salah
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  sendTokenResponse(user, 200, res);
});

// Mendapatkan token dari model untuk di buat cookie dan mengirim respon
const sendTokenResponse = (user, statusCode, res) => {
  // Membuat token jwt untuk login
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res.status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
    });
};

// @desc:         Log User Out / Remove Cookies
// @route:        GET /api/web/niuniq/auth/logout
// @access:       Private (Need Auth)
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc:         Get Current logged in user
// @route:        GET /api/web/niuniq/auth/me
// @access:       Private (Need Auth)
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).populate('store');

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc:         Update User Details
// @route:        PUT /api/web/niuniq/auth/updatedetails
// @access:       Private (Need Auth)
exports.updateDetails = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = {
    noTelepon: req.body.noTelepon,
  };

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc:         Update Password
// @route:        PUT /api/web/niuniq/auth/updatepassword
// @access:       Private (Need Auth)
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');
  const currentPassword = req.body.currentPassword;
  const newPassword = req.body.newPassword;
  const confirmPassword = req.body.confirmPassword;

  // Cek apakah currentPassword sama dengan password user sedang login
  if (!(await user.matchPassword(currentPassword))) {
    return next(new ErrorResponse('Password is incorrect', 401));
  }

  // Cek apakah newPassword sama dengan confirmPassword
  if (newPassword !== confirmPassword) {
    return next(new ErrorResponse('New password and confirm password is not same', 400));
  }

  user.password = req.body.newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// @desc:         Reset Password
// @route:        GET /api/web/niuniq/auth/resetpassword/:resettoken
// @access:       Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  // Get hashed token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resettoken)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ErrorResponse('Invalid token', 400));
  }

  // Set new password
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// @desc:         Forgot password
// @route:        POST /api/web/niuniq/auth/forgotPassword
// @access:       Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ErrorResponse('There is no user with that email', 404));
  }

  // Get reset token
  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });

  // // Create reset url
  const resetUrl = `${req.protocol}://${req.get(
    'host',
  )}/api/web/niuniq/auth/resetpassword/${resetToken}`;

  const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Password reset token',
      message,
    });

    res.status(200).json({ success: true, data: 'Email sent' });
  } catch (err) {
    console.log(err);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save({ validateBeforeSave: false });

    return next(new ErrorResponse('Email could not be sent', 500));
  }
});
