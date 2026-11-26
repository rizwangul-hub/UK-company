import express from 'express';
import {
  getConversations,
  startConversation,
  getConversationById,
  removeConversation,
  chatWithAssistant,
  getPendingApprovals,
  approveAction,
  rejectAction,
  getUsageStats,
  getAuditHistory,
  getAiHealth,
} from '../controllers/aiController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Diagnostic health endpoint (authenticated admin tool)
router.get('/health', getAiHealth);

router.get('/conversations', getConversations);
router.post('/conversations', startConversation);
router.get('/conversations/:id', getConversationById);
router.delete('/conversations/:id', removeConversation);

router.post('/chat', chatWithAssistant);

router.get('/approvals', getPendingApprovals);
router.post('/approvals/:id/approve', approveAction);
router.post('/approvals/:id/reject', rejectAction);

router.get('/usage', getUsageStats);
router.get('/audit', getAuditHistory);

export default router;
