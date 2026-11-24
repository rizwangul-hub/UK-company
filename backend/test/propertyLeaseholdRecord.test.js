import test from 'node:test';
import assert from 'node:assert/strict';
import Property from '../src/models/Property.js';

test('PROPERTY LEASEHOLD RECORD: validates all 9 sections of leaseholdRecord schema', () => {
  const prop = new Property({
    companyId: 'old-street',
    name: 'Flat 4, 304 Brixton Road',
    tenure: 'LEASEHOLD',
    leaseholdRecord: {
      propertyAddress: 'Flat 4, 304 Brixton Road, London SW9 6AE',
      titleNumber: 'NGL987654',
      completionDate: new Date('2025-05-01'),
      purchasePrice: 350000,
      conveyancingSolicitor: 'Smith & Co Solicitors',
      solicitorReferenceAndContact: 'REF-1001 · 020 7946 0000',
      originalLeaseDate: new Date('2015-01-01'),
      originalLeaseTermYears: 125,
      leaseStartDate: new Date('2015-01-01'),
      leaseExpiryDate: new Date('2140-01-01'),
      remainingYearsAtPurchase: 115,
      eightyYearThresholdDate: new Date('2060-01-01'),
      freeholderName: 'Brixton Estates Ltd',
      freeholderTitleNumber: 'NGL112233',
      freeholderRegisteredAddress: '10 Victoria Street, London',
      freeholderContactName: 'Ground Rent Dept',
      freeholderTelephone: '020 7946 0111',
      freeholderEmail: 'freeholder@example.co.uk',
      shareOfFreeholdIncluded: 'NO',
      managementCompanyNameAndNo: '',
      managingAgentName: 'Premier Block Management Ltd',
      managingAgentAddress: '20 Fleet Street, London',
      propertyManagerName: 'Sarah Jenkins',
      managingAgentTelephone: '020 7946 0222',
      managingAgentEmail: 'sarah@premierblock.co.uk',
      onlinePortalUrlAndRef: 'https://portal.premierblock.co.uk · ACC-445',
      currentAnnualGroundRent: 250,
      groundRentFrequency: 'HALF_YEARLY',
      groundRentDueDates: '1 Jan & 1 Jul',
      groundRentPayableTo: 'MANAGING_AGENT',
      groundRentPaymentMethodRef: 'BACS · GR-445',
      groundRentReviewClause: 'RPI every 10 years',
      groundRentNextReviewDate: new Date('2035-01-01'),
      currentAnnualServiceCharge: 2400,
      serviceChargeFinancialYear: '1 Apr - 31 Mar',
      serviceChargeFrequency: 'QUARTERLY',
      serviceChargeDueDates: '1 Apr, 1 Jul, 1 Oct, 1 Jan',
      apportionmentSharePercent: 12.5,
      serviceChargePayableTo: 'Premier Block Management Ltd',
      serviceChargePaymentMethodRef: 'DD · SC-445',
      sinkingFundIncluded: 'YES',
      currentReserveFundBalance: 18500,
      plannedMajorWorksDisclosed: 'Roof works scheduled 2027',
      insuranceArrangedBy: 'FREEHOLDER_MANAGING_AGENT',
      insurerName: 'Allianz UK',
      policyNumber: 'ALZ-998877',
      insuranceRenewalDate: new Date('2027-04-01'),
      annualInsurancePremium: 620,
      claimsContactNumber: '0800 123 4567',
      sublettingPermitted: 'WITH_CONSENT',
      petsPermitted: 'NO',
      alterationsPermitted: 'WITH_CONSENT',
      deedOfCovenantFeePaid: 150,
      shareCertificateReceived: 'N/A',
      keyDocumentsChecklist: [
        { documentName: 'Official Copy of Lease', received: true, storedLocation: 'Google Drive / Leases' },
        { documentName: 'Land Registry Title Register & Title Plan', received: true, storedLocation: 'Solicitor Vault' },
      ],
    },
  });

  const validationError = prop.validateSync();
  assert.equal(validationError, undefined);
  assert.equal(prop.leaseholdRecord.titleNumber, 'NGL987654');
  assert.equal(prop.leaseholdRecord.keyDocumentsChecklist.length, 2);
  assert.equal(prop.leaseholdRecord.keyDocumentsChecklist[0].received, true);
});
