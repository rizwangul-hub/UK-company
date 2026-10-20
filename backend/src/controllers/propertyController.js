import Property from '../models/Property.js';
import Unit from '../models/Unit.js';
import Mortgage from '../models/Mortgage.js';
import Tenant from '../models/Tenant.js';
import TenancyAgreement from '../models/TenancyAgreement.js';
import RentSchedule from '../models/RentSchedule.js';
import Transaction from '../models/Transaction.js';
import Appliance from '../models/Appliance.js';
import { apiSuccess, apiError } from '../utils/apiResponse.js';

export const getProperties = async (req, res) => {
  try {
    const { search, tenure, status } = req.query;
    const query = { companyId: req.companyId };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { postcode: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { addressLine1: { $regex: search, $options: 'i' } },
      ];
    }
    if (tenure) query.tenure = tenure;
    if (status) query.isActive = status === 'active';

    const properties = await Property.find(query).sort({ createdAt: -1 }).lean();

    // Populate units count, active mortgages & tenancies for each property
    const propertyIds = properties.map((p) => p._id);
    const [units, mortgages, tenancies] = await Promise.all([
      Unit.find({ companyId: req.companyId, propertyId: { $in: propertyIds }, isActive: true }).lean(),
      Mortgage.find({ companyId: req.companyId, propertyId: { $in: propertyIds }, status: 'ACTIVE' }).lean(),
      TenancyAgreement.find({ companyId: req.companyId, propertyId: { $in: propertyIds } }).sort({ createdAt: -1 }).populate('tenantId', 'fullName email phone').lean(),
    ]);

    const enriched = properties.map((prop) => {
      const propUnitsRaw = units.filter((u) => u.propertyId.toString() === prop._id.toString());
      const propUnits = propUnitsRaw.map((u) => {
        const activeTenancy = tenancies.find((t) => t.unitId && t.unitId.toString() === u._id.toString() && t.status === 'ACTIVE');
        const latestTenancy = tenancies.find((t) => t.unitId && t.unitId.toString() === u._id.toString());
        const uTenancy = activeTenancy || latestTenancy;
        const isOccupied = !!activeTenancy;
        return {
          ...u,
          tenantName: activeTenancy ? (activeTenancy.tenantId?.fullName || '') : (latestTenancy?.tenantId?.fullName ? `${latestTenancy.tenantId.fullName} (Previous)` : ''),
          tenantEmail: uTenancy?.tenantId?.email || '',
          tenantPhone: uTenancy?.tenantId?.phone || '',
          contractualRent: activeTenancy?.rentAmount || u.targetRent || 0,
          status: isOccupied ? 'OCCUPIED' : (u.status || 'AVAILABLE'),
        };
      });
      const propMortgages = mortgages.filter((m) => m.propertyId.toString() === prop._id.toString());
      const totalDebt = propMortgages.reduce((sum, m) => sum + (m.outstandingPrincipalBalance || 0), 0);
      
      const hasUnits = propUnits.length > 0;
      const occupiedUnits = hasUnits
        ? propUnits.filter((u) => u.status === 'OCCUPIED').length
        : (prop.status === 'Occupied' || !!prop.tenantName ? 1 : 0);
      const totalUnits = hasUnits ? propUnits.length : 1;
      const vacantUnits = totalUnits - occupiedUnits;
      const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

      return {
        ...prop,
        units: propUnits,
        mortgages: propMortgages,
        totalUnits,
        occupiedUnits,
        vacantUnits,
        occupancyRate,
        contractualRent: prop.contractualRent || 0,
        rentFrequency: prop.rentFrequency || 'MONTHLY',
        status: prop.status || (occupiedUnits > 0 ? 'Occupied' : 'Available'),
        tenantName: prop.tenantName || '',
        activeMortgagesCount: propMortgages.length,
        totalMortgageDebt: totalDebt,
        equity: Math.max(0, (prop.currentValuation || prop.purchasePrice || 0) - totalDebt),
      };
    });

    // Flatten so every individual unit/property is displayed as its OWN independent property
    const individualProperties = [];

    enriched.forEach((prop) => {
      if (prop.units && prop.units.length > 1) {
        prop.units.forEach((u) => {
          const isShop = u.unitType === 'RETAIL_SHOP' || u.unitName?.toLowerCase().includes('shop');
          individualProperties.push({
            _id: u._id,
            unitId: u._id,
            parentPropertyId: prop._id,
            parentPropertyName: prop.name,
            name: u.unitName,
            addressLine1: prop.addressLine1,
            addressLine2: prop.addressLine2,
            city: prop.city,
            postcode: prop.postcode,
            propertyType: isShop ? 'Shop' : 'Flat',
            contractualRent: u.contractualRent || u.targetRent || 0,
            rentFrequency: 'MONTHLY',
            status: u.status === 'OCCUPIED' ? 'Occupied' : 'Available',
            tenantName: u.tenantName || '',
            tenantPhone: u.tenantPhone || '',
            tenantEmail: u.tenantEmail || '',
            floor: u.floor || 'Ground',
            floorAreaSqFt: u.floorAreaSqFt || 0,
            notes: u.notes || prop.notes,
            tenure: prop.tenure,
            compliance: prop.compliance,
            purchasePrice: Math.round((prop.purchasePrice || 0) / prop.units.length),
            currentValuation: Math.round((prop.currentValuation || prop.purchasePrice || 0) / prop.units.length),
            totalMortgageDebt: Math.round((prop.totalMortgageDebt || 0) / prop.units.length),
            activeMortgagesCount: prop.activeMortgagesCount || 0,
            isMultiUnitChild: true,
            units: [u],
          });
        });
      } else {
        individualProperties.push(prop);
      }
    });

    const portfolioSummary = {
      totalProperties: individualProperties.length,
      totalBuildings: enriched.length,
      totalContractualRent: individualProperties.reduce((sum, p) => sum + (p.contractualRent || 0), 0),
      totalValuation: enriched.reduce((sum, p) => sum + (p.currentValuation || p.purchasePrice || 0), 0),
      totalMortgageDebt: enriched.reduce((sum, p) => sum + (p.totalMortgageDebt || 0), 0),
      occupiedCount: individualProperties.filter((p) => p.status === 'Occupied' || p.tenantName).length,
      availableCount: individualProperties.filter((p) => p.status !== 'Occupied' && !p.tenantName).length,
    };

    return apiSuccess(res, {
      properties: individualProperties,
      buildings: enriched,
      total: individualProperties.length,
      summary: portfolioSummary,
    });
  } catch (error) {
    return apiError(res, 'Failed to fetch properties', 500, error);
  }
};

export const getPropertyById = async (req, res) => {
  try {
    let property = await Property.findOne({ _id: req.params.id, companyId: req.companyId }).lean();
    let targetUnit = null;

    if (!property) {
      targetUnit = await Unit.findOne({ _id: req.params.id, companyId: req.companyId }).lean();
      if (targetUnit) {
        property = await Property.findOne({ _id: targetUnit.propertyId, companyId: req.companyId }).lean();
      }
    }

    if (!property) return apiError(res, 'Property not found', 404);

    if (targetUnit) {
      // Return dedicated property details for this specific individual unit
      const [mortgages, activeTenancy, latestTenancy, schedules, recentTx, appliances] = await Promise.all([
        Mortgage.find({ companyId: req.companyId, propertyId: property._id, status: 'ACTIVE' }).populate('paymentAccountId', 'name sortCode accountNumber').lean(),
        TenancyAgreement.findOne({ companyId: req.companyId, unitId: targetUnit._id, status: 'ACTIVE' }).populate('tenantId', 'fullName email phone').lean(),
        TenancyAgreement.findOne({ companyId: req.companyId, unitId: targetUnit._id }).sort({ createdAt: -1 }).populate('tenantId', 'fullName email phone').lean(),
        RentSchedule.find({ companyId: req.companyId, unitId: targetUnit._id }).sort({ billingMonth: -1 }).limit(12).lean(),
        Transaction.find({ companyId: req.companyId, unitId: targetUnit._id, status: 'POSTED', isDeleted: { $ne: true } }).populate('accountId', 'name').populate('categoryId', 'name code').sort({ transactionDate: -1 }).limit(10).lean(),
        Appliance.find({ companyId: req.companyId, $or: [{ unitId: targetUnit._id }, { propertyId: property._id }] }).sort({ createdAt: -1 }).lean(),
      ]);

      const effectiveTenancy = activeTenancy || latestTenancy;
      const isOccupied = Boolean(activeTenancy);
      const contractualRent = activeTenancy?.rentAmount || targetUnit.targetRent || 0;
      const annualRent = contractualRent * 12;

      const totalBuildingDebt = mortgages.reduce((sum, m) => sum + (m.outstandingPrincipalBalance || 0), 0);
      const totalUnitsInBuilding = await Unit.countDocuments({ propertyId: property._id, isActive: true });
      const unitShare = totalUnitsInBuilding > 0 ? (1 / totalUnitsInBuilding) : 1;

      const assetVal = Math.round((property.currentValuation || property.purchasePrice || 0) * unitShare);
      const unitDebt = Math.round(totalBuildingDebt * unitShare);
      const equity = Math.max(0, assetVal - unitDebt);
      const ltv = assetVal > 0 ? Number(((unitDebt / assetVal) * 100).toFixed(1)) : 0;
      const grossYield = assetVal > 0 ? Number(((annualRent / assetVal) * 100).toFixed(2)) : 0;
      const isShop = targetUnit.unitType === 'RETAIL_SHOP' || targetUnit.unitName?.toLowerCase().includes('shop');

      return apiSuccess(res, {
        _id: targetUnit._id,
        unitId: targetUnit._id,
        parentPropertyId: property._id,
        parentPropertyName: property.name,
        name: targetUnit.unitName,
        propertyType: isShop ? 'Shop' : 'Flat',
        contractualRent,
        rentFrequency: 'MONTHLY',
        status: isOccupied ? 'Occupied' : 'Available',
        tenantName: activeTenancy ? (activeTenancy.tenantId?.fullName || '') : (latestTenancy?.tenantId?.fullName ? `${latestTenancy.tenantId.fullName} (Previous)` : ''),
        addressLine1: property.addressLine1,
        addressLine2: property.addressLine2,
        city: property.city,
        postcode: property.postcode,
        tenure: property.tenure,
        compliance: property.compliance,
        tenancy: effectiveTenancy,
        schedules,
        recentTransactions: recentTx,
        appliances,
        mortgages,
        totalMortgageDebt: unitDebt,
        equity,
        ltv,
        annualRent,
        grossYield,
        floor: targetUnit.floor || 'Ground',
        floorAreaSqFt: targetUnit.floorAreaSqFt || 0,
        notes: targetUnit.notes || property.notes,
        isUnit: true,
      });
    }

    const [unitsRaw, mortgages, tenancy, schedules, recentTx, appliances, unitTenancies] = await Promise.all([
      Unit.find({ companyId: req.companyId, propertyId: property._id, isActive: true }).sort({ unitName: 1 }).lean(),
      Mortgage.find({ companyId: req.companyId, propertyId: property._id }).populate('paymentAccountId', 'name sortCode accountNumber').lean(),
      TenancyAgreement.findOne({ companyId: req.companyId, propertyId: property._id, status: 'ACTIVE' }).populate('tenantId', 'fullName email phone').lean(),
      RentSchedule.find({ companyId: req.companyId, propertyId: property._id }).sort({ billingMonth: -1 }).limit(12).lean(),
      Transaction.find({ companyId: req.companyId, propertyId: property._id, status: 'POSTED', isDeleted: { $ne: true } }).populate('accountId', 'name').populate('categoryId', 'name code').sort({ transactionDate: -1 }).limit(10).lean(),
      Appliance.find({ companyId: req.companyId, propertyId: property._id }).sort({ createdAt: -1 }).lean(),
      TenancyAgreement.find({ companyId: req.companyId, propertyId: property._id }).sort({ createdAt: -1 }).populate('tenantId', 'fullName email phone').lean(),
    ]);

    const units = unitsRaw.map((u) => {
      const activeTenancy = unitTenancies.find((t) => t.unitId && t.unitId.toString() === u._id.toString() && t.status === 'ACTIVE');
      const latestTenancy = unitTenancies.find((t) => t.unitId && t.unitId.toString() === u._id.toString());
      const uTenancy = activeTenancy || latestTenancy;
      const isOccupied = !!activeTenancy;
      return {
        ...u,
        tenantName: activeTenancy ? (activeTenancy.tenantId?.fullName || '') : (latestTenancy?.tenantId?.fullName ? `${latestTenancy.tenantId.fullName} (Previous)` : ''),
        tenantEmail: uTenancy?.tenantId?.email || '',
        tenantPhone: uTenancy?.tenantId?.phone || '',
        contractualRent: activeTenancy?.rentAmount || u.targetRent || 0,
        status: isOccupied ? 'OCCUPIED' : (u.status || 'AVAILABLE'),
      };
    });

    const totalDebt = mortgages
      .filter((m) => m.status === 'ACTIVE')
      .reduce((sum, m) => sum + (m.outstandingPrincipalBalance || 0), 0);

    const assetVal = property.currentValuation || property.purchasePrice || 0;
    const equity = Math.max(0, assetVal - totalDebt);
    const ltv = assetVal > 0 ? Number(((totalDebt / assetVal) * 100).toFixed(1)) : 0;
    const annualRent = (property.contractualRent || 0) * (property.rentFrequency === 'ANNUALLY' ? 1 : 12);
    const grossYield = assetVal > 0 ? Number(((annualRent / assetVal) * 100).toFixed(2)) : 0;

    return apiSuccess(res, {
      ...property,
      units,
      mortgages,
      tenancy,
      schedules,
      recentTransactions: recentTx,
      appliances: appliances || [],
      totalMortgageDebt: totalDebt,
      equity,
      ltv,
      annualRent,
      grossYield,
    });
  } catch (error) {
    return apiError(res, 'Failed to fetch property details', 500, error);
  }
};

export const createProperty = async (req, res) => {
  try {
    const payload = { ...req.body, companyId: req.companyId };
    const property = await Property.create(payload);
    return apiSuccess(res, property, 'Property created successfully', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to create property', 400, error);
  }
};

export const updateProperty = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.companyId; // Never permit client to reassign companyId

    let property = await Property.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );
    if (!property) {
      // Check if this id belongs to a Unit
      const unit = await Unit.findOne({ _id: req.params.id, companyId: req.companyId });
      if (unit) {
        if (updateData.name) unit.unitName = updateData.name;
        if (updateData.contractualRent !== undefined) unit.contractualRent = updateData.contractualRent;
        if (updateData.status) unit.status = updateData.status.toUpperCase() === 'OCCUPIED' ? 'OCCUPIED' : updateData.status.toUpperCase();
        if (updateData.tenantName !== undefined) unit.tenantName = updateData.tenantName;
        if (updateData.notes !== undefined) unit.notes = updateData.notes;
        if (updateData.propertyType) {
          unit.unitType = updateData.propertyType.toUpperCase().includes('SHOP') ? 'RETAIL_SHOP' : 'FLAT';
        }
        await unit.save();
        return apiSuccess(res, unit, 'Unit updated successfully');
      }
      return apiError(res, 'Property not found', 404);
    }
    return apiSuccess(res, property, 'Property updated successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to update property', 400, error);
  }
};

export const deleteProperty = async (req, res) => {
  try {
    const propertyId = req.params.id;

    const property = await Property.findOne({ _id: propertyId, companyId: req.companyId });
    if (!property) return apiError(res, 'Property not found', 404);

    // Financial protection: Check for active mortgages in this company
    const activeMortgages = await Mortgage.countDocuments({ companyId: req.companyId, propertyId, status: 'ACTIVE' });
    if (activeMortgages > 0) {
      return apiError(
        res,
        `Cannot archive property: ${activeMortgages} active mortgage facility/facilities are linked. Please redeem or close mortgages first.`,
        400
      );
    }

    // Tenancy protection: Check for active tenancy agreements in this company
    const activeTenancies = await TenancyAgreement.countDocuments({ companyId: req.companyId, propertyId, status: 'ACTIVE' });
    if (activeTenancies > 0) {
      return apiError(
        res,
        `Cannot archive property: ${activeTenancies} active tenancy agreement(s) are linked. Please end or reassign tenancies first.`,
        400
      );
    }

    property.isActive = false;
    await property.save();
    return apiSuccess(res, null, 'Property archived successfully');
  } catch (error) {
    return apiError(res, 'Failed to delete property', 500, error);
  }
};

// Unit operations
export const addUnit = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.propertyId, companyId: req.companyId });
    if (!property) return apiError(res, 'Property not found in active company', 404);

    const unit = await Unit.create({
      ...req.body,
      propertyId: property._id,
      companyId: req.companyId,
    });
    return apiSuccess(res, unit, 'Unit added successfully', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to add unit', 400, error);
  }
};

export const updateUnit = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.companyId;
    delete updateData.propertyId; // Units remain anchored to their parent property asset

    const unit = await Unit.findOneAndUpdate(
      { _id: req.params.unitId, propertyId: req.params.propertyId, companyId: req.companyId },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );
    if (!unit) return apiError(res, 'Unit not found in active company property', 404);
    return apiSuccess(res, unit, 'Unit updated successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to update unit', 400, error);
  }
};

export const deleteUnit = async (req, res) => {
  try {
    const unit = await Unit.findOneAndUpdate(
      { _id: req.params.unitId, propertyId: req.params.propertyId, companyId: req.companyId },
      { isActive: false },
      { new: true }
    );
    if (!unit) return apiError(res, 'Unit not found in active company property', 404);
    return apiSuccess(res, null, 'Unit archived successfully');
  } catch (error) {
    return apiError(res, 'Failed to delete unit', 500, error);
  }
};
