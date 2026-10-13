import express from 'express';
import {
  getMortgages,
  getMortgageById,
  createMortgage,
  updateMortgage,
  postMortgagePayment,
  getMortgagePayments,
  reconcileBalance,
} from '../controllers/mortgageController.js';
import { protect } from '../middleware/auth.js';
import { requireCompanyContext } from '../middleware/companyContext.js';

const router = express.Router();

router.use(protect, requireCompanyContext);

router.get('/', getMortgages);
router.get('/:id', getMortgageById);
router.post('/', createMortgage);
router.put('/:id', updateMortgage);
router.post('/:id/payments', postMortgagePayment);
router.get('/:id/payments', getMortgagePayments);
router.post('/:id/reconcile', reconcileBalance);

export default router;
