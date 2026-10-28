import express from 'express';
import {
  getSetupStatus,
  setupInitialUser,
  login,
  getMe,
  updatePassword,
} from '../controllers/authController.js';
import { ssoExchange } from '../controllers/ssoController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/setup-status', getSetupStatus);
router.post('/setup', setupInitialUser);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/password', protect, updatePassword);

// Phase 6A: Central Portal Single Sign-On (SSO) ticket exchange
router.post('/sso/exchange', ssoExchange);

export default router;
