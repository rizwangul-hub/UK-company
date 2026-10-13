import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getJwtSecret, JWT_EXPIRES_IN } from '../config/jwt.js';
import { apiSuccess, apiError } from '../utils/apiResponse.js';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Check if the application has an authorized user configured
 * GET /api/auth/setup-status
 */
export const getSetupStatus = async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    return apiSuccess(res, {
      isConfigured: userCount > 0,
      needsSetup: userCount === 0,
    });
  } catch (error) {
    return apiError(res, 'Failed to check setup status', 500, error);
  }
};

/**
 * First-run setup: creates the single authorized operator account
 * POST /api/auth/setup
 */
export const setupInitialUser = async (req, res) => {
  try {
    const existingCount = await User.countDocuments();
    if (existingCount > 0) {
      return apiError(res, 'Setup already completed. Initial operator account exists.', 403);
    }

    const { name, email, password } = req.body;
    if (!email || !password || password.length < 6) {
      return apiError(res, 'Valid email and password (minimum 6 characters) are required.', 400);
    }

    const newUser = await User.create({
      name: name?.trim() || 'Authorized Operator',
      email: email.trim().toLowerCase(),
      password,
      isActive: true,
    });

    const token = generateToken(newUser._id);

    return apiSuccess(
      res,
      {
        token,
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
        },
      },
      'Authorized operator account successfully created.',
      201
    );
  } catch (error) {
    if (error.code === 11000) {
      return apiError(res, 'Setup already completed. Initial operator account exists.', 403);
    }
    return apiError(res, 'Setup failed', 500, error);
  }
};

/**
 * Authenticate single operator
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return apiError(res, 'Email and password are required.', 400);
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');

    if (!user) {
      return apiError(res, 'Invalid credentials.', 401);
    }

    if (!user.isActive) {
      return apiError(res, 'User account has been deactivated.', 403);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return apiError(res, 'Invalid credentials.', 401);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user._id);

    return apiSuccess(res, {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        lastLoginAt: user.lastLoginAt,
      },
    }, 'Sign in successful.');
  } catch (error) {
    return apiError(res, 'Login failed', 500, error);
  }
};

/**
 * Verify current session
 * GET /api/auth/me
 */
export const getMe = async (req, res) => {
  return apiSuccess(res, {
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      lastLoginAt: req.user.lastLoginAt,
    },
  });
};

/**
 * Update operator password
 * PUT /api/auth/password
 */
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return apiError(res, 'Current password and new password (min 6 chars) required.', 400);
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return apiError(res, 'Incorrect current password.', 400);
    }

    user.password = newPassword;
    await user.save();

    return apiSuccess(res, null, 'Password updated successfully.');
  } catch (error) {
    return apiError(res, 'Failed to update password', 500, error);
  }
};
