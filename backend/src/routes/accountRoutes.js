import express from 'express';
import {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  getAccountStatement,
  executeTransfer,
} from '../controllers/accountController.js';
import { protect } from '../middleware/auth.js';
import { requireCompanyContext } from '../middleware/companyContext.js';

const router = express.Router();

router.use(protect, requireCompanyContext);

router.get('/', getAccounts);
router.get('/:id', getAccountById);
router.post('/', createAccount);
router.put('/:id', updateAccount);
router.get('/:id/statement', getAccountStatement);
router.post('/transfer', executeTransfer);

export default router;
