import express from 'express';
import {
  getSetupStatus,
  setupInitialUser,
  login,
  getMe,
  updatePassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/setup-status', getSetupStatus);
router.post('/setup', setupInitialUser);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/password', protect, updatePassword);

export default router;
