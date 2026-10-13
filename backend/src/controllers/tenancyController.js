import Tenant from '../models/Tenant.js';
import TenancyAgreement from '../models/TenancyAgreement.js';
import Unit from '../models/Unit.js';
import { apiSuccess, apiError } from '../utils/apiResponse.js';

import Property from '../models/Property.js';

export const getTenants = async (req, res) => {
  try {
    const { search } = req.query;
    const query = { companyId: req.companyId, isActive: true };
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { postcode: { $regex: search, $options: 'i' } },
      ];
    }
    const tenants = await Tenant.find(query).sort({ fullName: 1 }).lean();
    return apiSuccess(res, { tenants, total: tenants.length });
  } catch (error) {
    return apiError(res, 'Failed to fetch tenants', 500, error);
  }
};

export const getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ _id: req.params.id, companyId: req.companyId }).lean();
    if (!tenant) return apiError(res, 'Tenant not found', 404);

    const agreements = await TenancyAgreement.find({ tenantId: tenant._id, companyId: req.companyId })
      .populate('propertyId', 'name addressLine1 postcode')
      .populate('unitId', 'unitName unitType')
      .sort({ startDate: -1 })
      .lean();

    return apiSuccess(res, { ...tenant, agreements });
  } catch (error) {
    return apiError(res, 'Failed to fetch tenant', 500, error);
  }
};

export const createTenant = async (req, res) => {
  try {
    const payload = { ...req.body, companyId: req.companyId };
    const tenant = await Tenant.create(payload);
    return apiSuccess(res, tenant, 'Tenant created successfully', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to create tenant', 400, error);
  }
};

export const updateTenant = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.companyId;

    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      updateData,
      { new: true }
    );
    if (!tenant) return apiError(res, 'Tenant not found', 404);
    return apiSuccess(res, tenant, 'Tenant updated successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to update tenant', 400, error);
  }
};

// Tenancies / Leases
export const getTenancies = async (req, res) => {
  try {
    const { status, propertyId } = req.query;
    const query = { companyId: req.companyId };
    if (status) query.status = status;
    if (propertyId) query.propertyId = propertyId;

    const tenancies = await TenancyAgreement.find(query)
      .populate('tenantId', 'fullName email phone')
      .populate('propertyId', 'name addressLine1 postcode')
      .populate('unitId', 'unitName unitType')
      .sort({ startDate: -1 })
      .lean();

    return apiSuccess(res, { tenancies, total: tenancies.length });
  } catch (error) {
    return apiError(res, 'Failed to fetch tenancies', 500, error);
  }
};

export const createTenancy = async (req, res) => {
  try {
    const { agreementRef, tenantId, propertyId, unitId, rentAmount } = req.body;

    // Cross-company validation
    if (tenantId) {
      const tenant = await Tenant.findOne({ _id: tenantId, companyId: req.companyId });
      if (!tenant) {
        return apiError(res, 'Tenant does not belong to the selected company', 400);
      }
    }
    if (propertyId) {
      const property = await Property.findOne({ _id: propertyId, companyId: req.companyId });
      if (!property) {
        return apiError(res, 'Property does not belong to the selected company', 400);
      }
    }
    if (unitId) {
      const unit = await Unit.findOne({ _id: unitId, companyId: req.companyId });
      if (!unit) {
        return apiError(res, 'Unit does not belong to the selected company', 400);
      }
    }

    const ref = agreementRef || `AST-${Date.now().toString().slice(-6)}`;
    const tenancy = await TenancyAgreement.create({
      ...req.body,
      companyId: req.companyId,
      agreementRef: ref,
    });

    // Mark unit as OCCUPIED
    if (unitId) {
      await Unit.findOneAndUpdate({ _id: unitId, companyId: req.companyId }, { status: 'OCCUPIED' });
    }

    return apiSuccess(res, tenancy, 'Tenancy agreement created successfully', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to create tenancy agreement', 400, error);
  }
};

export const updateTenancy = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.companyId;

    if (updateData.tenantId) {
      const tenant = await Tenant.findOne({ _id: updateData.tenantId, companyId: req.companyId });
      if (!tenant) return apiError(res, 'Tenant does not belong to the selected company', 400);
    }
    if (updateData.propertyId) {
      const property = await Property.findOne({ _id: updateData.propertyId, companyId: req.companyId });
      if (!property) return apiError(res, 'Property does not belong to the selected company', 400);
    }
    if (updateData.unitId) {
      const unit = await Unit.findOne({ _id: updateData.unitId, companyId: req.companyId });
      if (!unit) return apiError(res, 'Unit does not belong to the selected company', 400);
    }

    const tenancy = await TenancyAgreement.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      updateData,
      { new: true }
    );
    if (!tenancy) return apiError(res, 'Tenancy agreement not found', 404);

    if (tenancy.status === 'TERMINATED' && tenancy.unitId) {
      await Unit.findOneAndUpdate({ _id: tenancy.unitId, companyId: req.companyId }, { status: 'VACANT' });
    }

    return apiSuccess(res, tenancy, 'Tenancy agreement updated successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to update tenancy agreement', 400, error);
  }
};
