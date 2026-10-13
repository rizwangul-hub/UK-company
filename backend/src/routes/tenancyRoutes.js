import express from 'express';
import {
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  getTenancies,
  createTenancy,
  updateTenancy,
} from '../controllers/tenancyController.js';
import { protect } from '../middleware/auth.js';
import { requireCompanyContext } from '../middleware/companyContext.js';

const router = express.Router();

router.use('/tenants', protect, requireCompanyContext);
router.use('/tenancies', protect, requireCompanyContext);

router.get('/tenants', getTenants);
router.get('/tenants/:id', getTenantById);
router.post('/tenants', createTenant);
router.put('/tenants/:id', updateTenant);

router.get('/tenancies', getTenancies);
router.post('/tenancies', createTenancy);
router.put('/tenancies/:id', updateTenancy);

export default router;
