import test from 'node:test';
import assert from 'node:assert/strict';
import Property from '../src/models/Property.js';
import TenancyAgreement from '../src/models/TenancyAgreement.js';
import RentSchedule from '../src/models/RentSchedule.js';
import RentPayment from '../src/models/RentPayment.js';
import Mortgage from '../src/models/Mortgage.js';
import { VALID_COMPANY_IDS } from '../src/config/companies.js';

test('DIRECT PROPERTY MODEL: Property schema holds direct rent, status, and tenant fields', () => {
  const paths = Property.schema.paths;

  assert.ok(paths.companyId, 'Property must require companyId');
  assert.equal(paths.companyId.isRequired, true, 'Property companyId must be required');

  assert.ok(paths.contractualRent, 'Property must have contractualRent path');
  assert.equal(paths.contractualRent.instance, 'Number', 'contractualRent must be a Number');

  assert.ok(paths.rentFrequency, 'Property must have rentFrequency path');
  assert.equal(paths.rentFrequency.defaultValue, 'MONTHLY', 'rentFrequency must default to MONTHLY');

  assert.ok(paths.status, 'Property must have status path');
  assert.equal(paths.status.defaultValue, 'Available', 'status must default to Available');

  assert.ok(paths.tenantName, 'Property must have tenantName path');
  assert.ok(paths.tenancyStartDate, 'Property must have tenancyStartDate path');
  assert.ok(paths.tenancyEndDate, 'Property must have tenancyEndDate path');
  assert.ok(paths.sourceReference, 'Property must have sourceReference path');
});

test('DIRECT PROPERTY MODEL: unitId is optional across TenancyAgreement, RentSchedule, and RentPayment', () => {
  const tenancyUnit = TenancyAgreement.schema.path('unitId');
  assert.ok(tenancyUnit, 'TenancyAgreement must have unitId path');
  assert.equal(Boolean(tenancyUnit.isRequired), false, 'TenancyAgreement unitId must not be required');

  const scheduleUnit = RentSchedule.schema.path('unitId');
  assert.ok(scheduleUnit, 'RentSchedule must have unitId path');
  assert.equal(Boolean(scheduleUnit.isRequired), false, 'RentSchedule unitId must not be required');

  const paymentUnit = RentPayment.schema.path('unitId');
  assert.ok(paymentUnit, 'RentPayment must have unitId path');
  assert.equal(Boolean(paymentUnit.isRequired), false, 'RentPayment unitId must not be required');
});

test('DIRECT PROPERTY MODEL: Mortgage facilities support property-level facilities without unit dependencies', () => {
  const mortgagePaths = Mortgage.schema.paths;
  assert.ok(mortgagePaths.propertyId, 'Mortgage must link to propertyId');
  assert.equal(mortgagePaths.propertyId.isRequired, true, 'Mortgage propertyId must be required');
  assert.equal(Boolean(mortgagePaths.unitId), false, 'Mortgage must not require unitId');
  assert.equal(mortgagePaths.repaymentType.options.enum.includes('INTEREST_ONLY'), true, 'Mortgage must support INTEREST_ONLY');
});

test('DIRECT PROPERTY MODEL: All 6 companies are supported in Property model', () => {
  assert.equal(VALID_COMPANY_IDS.length, 6, 'Must have 6 valid company IDs');
  assert.deepEqual(VALID_COMPANY_IDS, [
    'old-street',
    'best-standard',
    'sk-hamilton',
    'homewards',
    'mile-end-road',
    'global-standard',
  ]);
});
