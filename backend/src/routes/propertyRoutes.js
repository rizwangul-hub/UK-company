import express from 'express';
import {
  getProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  addUnit,
  updateUnit,
  deleteUnit,
} from '../controllers/propertyController.js';
import { protect } from '../middleware/auth.js';
import { requireCompanyContext } from '../middleware/companyContext.js';

const router = express.Router();

router.use(protect, requireCompanyContext);

router.get('/', getProperties);
router.get('/:id', getPropertyById);
router.post('/', createProperty);
router.put('/:id', updateProperty);
router.delete('/:id', deleteProperty);

// Unit routes
router.post('/:propertyId/units', addUnit);
router.put('/:propertyId/units/:unitId', updateUnit);
router.delete('/:propertyId/units/:unitId', deleteUnit);

export default router;
