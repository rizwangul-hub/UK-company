import React from 'react';
import { FileText, Shield, Building2, Calendar, PoundSterling, CheckSquare } from 'lucide-react';

export const DEFAULT_KEY_DOCUMENTS = [
  'Official Copy of Lease',
  'Land Registry Title Register & Title Plan',
  'Law Society Leasehold Information Form (TA7)',
  'LPE1 (Leasehold Property Enquiries) Pack',
  "Last 3 Years' Service Charge Accounts",
  'Buildings Insurance Schedule',
  'Fire Risk Assessment & Asbestos Survey',
];

export const createEmptyLeaseholdRecord = () => ({
  // 1. Property & Purchase Details
  propertyAddress: '',
  titleNumber: '',
  completionDate: '',
  purchasePrice: '',
  conveyancingSolicitor: '',
  solicitorReferenceAndContact: '',

  // 2. Lease Term & Key Dates
  originalLeaseDate: '',
  originalLeaseTermYears: '',
  leaseStartDate: '',
  leaseExpiryDate: '',
  remainingYearsAtPurchase: '',
  eightyYearThresholdDate: '',

  // 3. Freeholder (Landlord) Details
  freeholderName: '',
  freeholderTitleNumber: '',
  freeholderRegisteredAddress: '',
  freeholderContactName: '',
  freeholderTelephone: '',
  freeholderEmail: '',
  shareOfFreeholdIncluded: '',
  managementCompanyNameAndNo: '',

  // 4. Managing Agent Details
  managingAgentName: '',
  managingAgentAddress: '',
  propertyManagerName: '',
  managingAgentTelephone: '',
  managingAgentEmail: '',
  onlinePortalUrlAndRef: '',

  // 5. Ground Rent
  currentAnnualGroundRent: '',
  groundRentFrequency: '',
  groundRentDueDates: '',
  groundRentPayableTo: '',
  groundRentPaymentMethodRef: '',
  groundRentReviewClause: '',
  groundRentNextReviewDate: '',

  // 6. Service Charge & Reserve Fund
  currentAnnualServiceCharge: '',
  serviceChargeFinancialYear: '',
  serviceChargeFrequency: '',
  serviceChargeDueDates: '',
  apportionmentSharePercent: '',
  serviceChargePayableTo: '',
  serviceChargePaymentMethodRef: '',
  sinkingFundIncluded: '',
  currentReserveFundBalance: '',
  plannedMajorWorksDisclosed: '',

  // 7. Buildings Insurance
  insuranceArrangedBy: '',
  insurerName: '',
  policyNumber: '',
  insuranceRenewalDate: '',
  annualInsurancePremium: '',
  claimsContactNumber: '',

  // 8. Lease Covenants, Restrictions & Consents
  sublettingPermitted: '',
  petsPermitted: '',
  alterationsPermitted: '',
  deedOfCovenantFeePaid: '',
  shareCertificateReceived: '',

  // 9. Key Documents Checklist & Storage Location
  keyDocumentsChecklist: DEFAULT_KEY_DOCUMENTS.map((docName) => ({
    documentName: docName,
    received: false,
    storedLocation: '',
  })),
});

const toDateInput = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const toStr = (val) => (val !== undefined && val !== null ? String(val) : '');

export const normalizeLeaseholdRecord = (raw = {}) => {
  const base = createEmptyLeaseholdRecord();
  if (!raw || typeof raw !== 'object') return base;

  const existingDocs = Array.isArray(raw.keyDocumentsChecklist) ? raw.keyDocumentsChecklist : [];
  const mergedDocs = DEFAULT_KEY_DOCUMENTS.map((docName) => {
    const match = existingDocs.find((d) => d.documentName === docName);
    return {
      documentName: docName,
      received: Boolean(match?.received),
      storedLocation: match?.storedLocation || '',
    };
  });

  return {
    propertyAddress: raw.propertyAddress || '',
    titleNumber: raw.titleNumber || '',
    completionDate: toDateInput(raw.completionDate),
    purchasePrice: toStr(raw.purchasePrice),
    conveyancingSolicitor: raw.conveyancingSolicitor || '',
    solicitorReferenceAndContact: raw.solicitorReferenceAndContact || '',

    originalLeaseDate: toDateInput(raw.originalLeaseDate),
    originalLeaseTermYears: toStr(raw.originalLeaseTermYears),
    leaseStartDate: toDateInput(raw.leaseStartDate),
    leaseExpiryDate: toDateInput(raw.leaseExpiryDate),
    remainingYearsAtPurchase: toStr(raw.remainingYearsAtPurchase),
    eightyYearThresholdDate: toDateInput(raw.eightyYearThresholdDate),

    freeholderName: raw.freeholderName || '',
    freeholderTitleNumber: raw.freeholderTitleNumber || '',
    freeholderRegisteredAddress: raw.freeholderRegisteredAddress || '',
    freeholderContactName: raw.freeholderContactName || '',
    freeholderTelephone: raw.freeholderTelephone || '',
    freeholderEmail: raw.freeholderEmail || '',
    shareOfFreeholdIncluded: raw.shareOfFreeholdIncluded || '',
    managementCompanyNameAndNo: raw.managementCompanyNameAndNo || '',

    managingAgentName: raw.managingAgentName || '',
    managingAgentAddress: raw.managingAgentAddress || '',
    propertyManagerName: raw.propertyManagerName || '',
    managingAgentTelephone: raw.managingAgentTelephone || '',
    managingAgentEmail: raw.managingAgentEmail || '',
    onlinePortalUrlAndRef: raw.onlinePortalUrlAndRef || '',

    currentAnnualGroundRent: toStr(raw.currentAnnualGroundRent),
    groundRentFrequency: raw.groundRentFrequency || '',
    groundRentDueDates: raw.groundRentDueDates || '',
    groundRentPayableTo: raw.groundRentPayableTo || '',
    groundRentPaymentMethodRef: raw.groundRentPaymentMethodRef || '',
    groundRentReviewClause: raw.groundRentReviewClause || '',
    groundRentNextReviewDate: toDateInput(raw.groundRentNextReviewDate),

    currentAnnualServiceCharge: toStr(raw.currentAnnualServiceCharge),
    serviceChargeFinancialYear: raw.serviceChargeFinancialYear || '',
    serviceChargeFrequency: raw.serviceChargeFrequency || '',
    serviceChargeDueDates: raw.serviceChargeDueDates || '',
    apportionmentSharePercent: toStr(raw.apportionmentSharePercent),
    serviceChargePayableTo: raw.serviceChargePayableTo || '',
    serviceChargePaymentMethodRef: raw.serviceChargePaymentMethodRef || '',
    sinkingFundIncluded: raw.sinkingFundIncluded || '',
    currentReserveFundBalance: toStr(raw.currentReserveFundBalance),
    plannedMajorWorksDisclosed: raw.plannedMajorWorksDisclosed || '',

    insuranceArrangedBy: raw.insuranceArrangedBy || '',
    insurerName: raw.insurerName || '',
    policyNumber: raw.policyNumber || '',
    insuranceRenewalDate: toDateInput(raw.insuranceRenewalDate),
    annualInsurancePremium: toStr(raw.annualInsurancePremium),
    claimsContactNumber: raw.claimsContactNumber || '',

    sublettingPermitted: raw.sublettingPermitted || '',
    petsPermitted: raw.petsPermitted || '',
    alterationsPermitted: raw.alterationsPermitted || '',
    deedOfCovenantFeePaid: toStr(raw.deedOfCovenantFeePaid),
    shareCertificateReceived: raw.shareCertificateReceived || '',

    keyDocumentsChecklist: mergedDocs,
  };
};

const toNumOrNull = (val) => (val === '' || val === null || val === undefined ? null : Number(val));
const toDateOrNull = (val) => (val ? val : null);

export const buildLeaseholdPayload = (rec = {}) => ({
  propertyAddress: (rec.propertyAddress || '').trim(),
  titleNumber: (rec.titleNumber || '').trim(),
  completionDate: toDateOrNull(rec.completionDate),
  purchasePrice: toNumOrNull(rec.purchasePrice),
  conveyancingSolicitor: (rec.conveyancingSolicitor || '').trim(),
  solicitorReferenceAndContact: (rec.solicitorReferenceAndContact || '').trim(),

  originalLeaseDate: toDateOrNull(rec.originalLeaseDate),
  originalLeaseTermYears: toNumOrNull(rec.originalLeaseTermYears),
  leaseStartDate: toDateOrNull(rec.leaseStartDate),
  leaseExpiryDate: toDateOrNull(rec.leaseExpiryDate),
  remainingYearsAtPurchase: toNumOrNull(rec.remainingYearsAtPurchase),
  eightyYearThresholdDate: toDateOrNull(rec.eightyYearThresholdDate),

  freeholderName: (rec.freeholderName || '').trim(),
  freeholderTitleNumber: (rec.freeholderTitleNumber || '').trim(),
  freeholderRegisteredAddress: (rec.freeholderRegisteredAddress || '').trim(),
  freeholderContactName: (rec.freeholderContactName || '').trim(),
  freeholderTelephone: (rec.freeholderTelephone || '').trim(),
  freeholderEmail: (rec.freeholderEmail || '').trim(),
  shareOfFreeholdIncluded: rec.shareOfFreeholdIncluded || '',
  managementCompanyNameAndNo: (rec.managementCompanyNameAndNo || '').trim(),

  managingAgentName: (rec.managingAgentName || '').trim(),
  managingAgentAddress: (rec.managingAgentAddress || '').trim(),
  propertyManagerName: (rec.propertyManagerName || '').trim(),
  managingAgentTelephone: (rec.managingAgentTelephone || '').trim(),
  managingAgentEmail: (rec.managingAgentEmail || '').trim(),
  onlinePortalUrlAndRef: (rec.onlinePortalUrlAndRef || '').trim(),

  currentAnnualGroundRent: toNumOrNull(rec.currentAnnualGroundRent),
  groundRentFrequency: rec.groundRentFrequency || '',
  groundRentDueDates: (rec.groundRentDueDates || '').trim(),
  groundRentPayableTo: rec.groundRentPayableTo || '',
  groundRentPaymentMethodRef: (rec.groundRentPaymentMethodRef || '').trim(),
  groundRentReviewClause: (rec.groundRentReviewClause || '').trim(),
  groundRentNextReviewDate: toDateOrNull(rec.groundRentNextReviewDate),

  currentAnnualServiceCharge: toNumOrNull(rec.currentAnnualServiceCharge),
  serviceChargeFinancialYear: (rec.serviceChargeFinancialYear || '').trim(),
  serviceChargeFrequency: rec.serviceChargeFrequency || '',
  serviceChargeDueDates: (rec.serviceChargeDueDates || '').trim(),
  apportionmentSharePercent: toNumOrNull(rec.apportionmentSharePercent),
  serviceChargePayableTo: (rec.serviceChargePayableTo || '').trim(),
  serviceChargePaymentMethodRef: (rec.serviceChargePaymentMethodRef || '').trim(),
  sinkingFundIncluded: rec.sinkingFundIncluded || '',
  currentReserveFundBalance: toNumOrNull(rec.currentReserveFundBalance),
  plannedMajorWorksDisclosed: (rec.plannedMajorWorksDisclosed || '').trim(),

  insuranceArrangedBy: rec.insuranceArrangedBy || '',
  insurerName: (rec.insurerName || '').trim(),
  policyNumber: (rec.policyNumber || '').trim(),
  insuranceRenewalDate: toDateOrNull(rec.insuranceRenewalDate),
  annualInsurancePremium: toNumOrNull(rec.annualInsurancePremium),
  claimsContactNumber: (rec.claimsContactNumber || '').trim(),

  sublettingPermitted: rec.sublettingPermitted || '',
  petsPermitted: rec.petsPermitted || '',
  alterationsPermitted: rec.alterationsPermitted || '',
  deedOfCovenantFeePaid: toNumOrNull(rec.deedOfCovenantFeePaid),
  shareCertificateReceived: rec.shareCertificateReceived || '',

  keyDocumentsChecklist: Array.isArray(rec.keyDocumentsChecklist)
    ? rec.keyDocumentsChecklist.map((item) => ({
        documentName: item.documentName,
        received: Boolean(item.received),
        storedLocation: (item.storedLocation || '').trim(),
      }))
    : [],
});

const inputCls =
  'w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-indigo-500';
const labelCls = 'block text-slate-300 font-medium mb-1 text-[11px]';

function OptionPills({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(active ? '' : opt.value)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
              active
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function LeaseholdRecordForm({ value, onChange }) {
  const data = value || createEmptyLeaseholdRecord();
  const setField = (field, val) => onChange({ ...data, [field]: val });

  const updateChecklistItem = (idx, patch) => {
    const nextList = (data.keyDocumentsChecklist || []).map((item, i) =>
      i === idx ? { ...item, ...patch } : item
    );
    onChange({ ...data, keyDocumentsChecklist: nextList });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-indigo-500/30 bg-indigo-950/15 p-4 sm:p-5">
      <div className="border-b border-indigo-500/20 pb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
          <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-wide uppercase">
            Leasehold Property Information Record Form
          </h3>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Buyer&apos;s Master Record for Lease Terms, Freeholder, Managing Agent, Service Charges &amp; Covenants
        </p>
      </div>

      {/* 1. Property & Purchase Details */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" />
          <span>1. Property &amp; Purchase Details</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={labelCls}>Property Address</label>
            <input
              type="text"
              value={data.propertyAddress}
              onChange={(e) => setField('propertyAddress', e.target.value)}
              placeholder="Full leasehold property address"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Title Number (Leasehold)</label>
            <input
              type="text"
              value={data.titleNumber}
              onChange={(e) => setField('titleNumber', e.target.value)}
              placeholder="e.g. NGL123456"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Completion Date</label>
            <input
              type="date"
              value={data.completionDate}
              onChange={(e) => setField('completionDate', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Purchase Price (£)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={data.purchasePrice}
              onChange={(e) => setField('purchasePrice', e.target.value)}
              placeholder="£"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Conveyancing Solicitor / Firm</label>
            <input
              type="text"
              value={data.conveyancingSolicitor}
              onChange={(e) => setField('conveyancingSolicitor', e.target.value)}
              placeholder="Solicitor or law firm name"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Solicitor Reference &amp; Contact Details</label>
            <input
              type="text"
              value={data.solicitorReferenceAndContact}
              onChange={(e) => setField('solicitorReferenceAndContact', e.target.value)}
              placeholder="Reference no., phone, email"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* 2. Lease Term & Key Dates */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span>2. Lease Term &amp; Key Dates</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Original Lease Date</label>
            <input
              type="date"
              value={data.originalLeaseDate}
              onChange={(e) => setField('originalLeaseDate', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Original Lease Term (Years)</label>
            <input
              type="number"
              min="0"
              value={data.originalLeaseTermYears}
              onChange={(e) => setField('originalLeaseTermYears', e.target.value)}
              placeholder="e.g. 125 or 999"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Lease Start Date</label>
            <input
              type="date"
              value={data.leaseStartDate}
              onChange={(e) => setField('leaseStartDate', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Lease Expiry Date</label>
            <input
              type="date"
              value={data.leaseExpiryDate}
              onChange={(e) => setField('leaseExpiryDate', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Remaining Years at Purchase</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={data.remainingYearsAtPurchase}
              onChange={(e) => setField('remainingYearsAtPurchase', e.target.value)}
              placeholder="e.g. 112"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Date Reaching 80-Year Threshold (Marriage Value trigger)</label>
            <input
              type="date"
              value={data.eightyYearThresholdDate}
              onChange={(e) => setField('eightyYearThresholdDate', e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* 3. Freeholder (Landlord) Details */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
          3. Freeholder (Landlord) Details
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Freeholder Name / Company</label>
            <input
              type="text"
              value={data.freeholderName}
              onChange={(e) => setField('freeholderName', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Freeholder Title Number</label>
            <input
              type="text"
              value={data.freeholderTitleNumber}
              onChange={(e) => setField('freeholderTitleNumber', e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Registered Address</label>
            <input
              type="text"
              value={data.freeholderRegisteredAddress}
              onChange={(e) => setField('freeholderRegisteredAddress', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Contact Name / Department</label>
            <input
              type="text"
              value={data.freeholderContactName}
              onChange={(e) => setField('freeholderContactName', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Telephone Number</label>
            <input
              type="text"
              value={data.freeholderTelephone}
              onChange={(e) => setField('freeholderTelephone', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Email Address</label>
            <input
              type="email"
              value={data.freeholderEmail}
              onChange={(e) => setField('freeholderEmail', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Share of Freehold Included?</label>
            <OptionPills
              value={data.shareOfFreeholdIncluded}
              onChange={(v) => setField('shareOfFreeholdIncluded', v)}
              options={[
                { value: 'YES', label: 'Yes' },
                { value: 'NO', label: 'No' },
              ]}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>If Yes: Management Company Name &amp; Company No.</label>
            <input
              type="text"
              value={data.managementCompanyNameAndNo}
              onChange={(e) => setField('managementCompanyNameAndNo', e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* 4. Managing Agent Details */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
          4. Managing Agent Details
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Managing Agent Company Name</label>
            <input
              type="text"
              value={data.managingAgentName}
              onChange={(e) => setField('managingAgentName', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Dedicated Property Manager Name</label>
            <input
              type="text"
              value={data.propertyManagerName}
              onChange={(e) => setField('propertyManagerName', e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Registered / Correspondence Address</label>
            <input
              type="text"
              value={data.managingAgentAddress}
              onChange={(e) => setField('managingAgentAddress', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Telephone (General &amp; Out-of-Hours Emergency)</label>
            <input
              type="text"
              value={data.managingAgentTelephone}
              onChange={(e) => setField('managingAgentTelephone', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Email Address</label>
            <input
              type="email"
              value={data.managingAgentEmail}
              onChange={(e) => setField('managingAgentEmail', e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Online Portal URL &amp; Account / Reference No.</label>
            <input
              type="text"
              value={data.onlinePortalUrlAndRef}
              onChange={(e) => setField('onlinePortalUrlAndRef', e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* 5. Ground Rent */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
          <PoundSterling className="w-3.5 h-3.5" />
          <span>5. Ground Rent</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Current Annual Ground Rent (£)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={data.currentAnnualGroundRent}
              onChange={(e) => setField('currentAnnualGroundRent', e.target.value)}
              placeholder="£"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Payment Frequency</label>
            <OptionPills
              value={data.groundRentFrequency}
              onChange={(v) => setField('groundRentFrequency', v)}
              options={[
                { value: 'ANNUALLY', label: 'Annually' },
                { value: 'HALF_YEARLY', label: 'Half-Yearly' },
                { value: 'QUARTERLY', label: 'Quarterly' },
              ]}
            />
          </div>
          <div>
            <label className={labelCls}>Due Date(s)</label>
            <input
              type="text"
              value={data.groundRentDueDates}
              onChange={(e) => setField('groundRentDueDates', e.target.value)}
              placeholder="e.g. 1 Jan & 1 Jul"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Payable To</label>
            <OptionPills
              value={data.groundRentPayableTo}
              onChange={(v) => setField('groundRentPayableTo', v)}
              options={[
                { value: 'FREEHOLDER', label: 'Freeholder' },
                { value: 'MANAGING_AGENT', label: 'Managing Agent' },
              ]}
            />
          </div>
          <div>
            <label className={labelCls}>Payment Method / Reference</label>
            <input
              type="text"
              value={data.groundRentPaymentMethodRef}
              onChange={(e) => setField('groundRentPaymentMethodRef', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Ground Rent Review Clause (Fixed, RPI, Doubling, Peppercorn)</label>
            <input
              type="text"
              value={data.groundRentReviewClause}
              onChange={(e) => setField('groundRentReviewClause', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Next Review Date</label>
            <input
              type="date"
              value={data.groundRentNextReviewDate}
              onChange={(e) => setField('groundRentNextReviewDate', e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* 6. Service Charge & Reserve Fund */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
          6. Service Charge &amp; Reserve Fund
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Current Annual Service Charge (£)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={data.currentAnnualServiceCharge}
              onChange={(e) => setField('currentAnnualServiceCharge', e.target.value)}
              placeholder="£"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Service Charge Financial Year (e.g., 1 Apr – 31 Mar)</label>
            <input
              type="text"
              value={data.serviceChargeFinancialYear}
              onChange={(e) => setField('serviceChargeFinancialYear', e.target.value)}
              placeholder="1 Apr - 31 Mar"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Payment Frequency</label>
            <OptionPills
              value={data.serviceChargeFrequency}
              onChange={(v) => setField('serviceChargeFrequency', v)}
              options={[
                { value: 'ANNUALLY', label: 'Annually' },
                { value: 'HALF_YEARLY', label: 'Half-Yearly' },
                { value: 'QUARTERLY', label: 'Quarterly' },
                { value: 'MONTHLY', label: 'Monthly' },
              ]}
            />
          </div>
          <div>
            <label className={labelCls}>Due Date(s)</label>
            <input
              type="text"
              value={data.serviceChargeDueDates}
              onChange={(e) => setField('serviceChargeDueDates', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Percentage / Apportionment Share Payable (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={data.apportionmentSharePercent}
              onChange={(e) => setField('apportionmentSharePercent', e.target.value)}
              placeholder="%"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Payable To</label>
            <input
              type="text"
              value={data.serviceChargePayableTo}
              onChange={(e) => setField('serviceChargePayableTo', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Payment Method / Account Reference</label>
            <input
              type="text"
              value={data.serviceChargePaymentMethodRef}
              onChange={(e) => setField('serviceChargePaymentMethodRef', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Sinking / Reserve Fund Contribution Included?</label>
            <OptionPills
              value={data.sinkingFundIncluded}
              onChange={(v) => setField('sinkingFundIncluded', v)}
              options={[
                { value: 'YES', label: 'Yes' },
                { value: 'NO', label: 'No' },
              ]}
            />
          </div>
          <div>
            <label className={labelCls}>Current Reserve Fund Balance (at purchase) (£)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={data.currentReserveFundBalance}
              onChange={(e) => setField('currentReserveFundBalance', e.target.value)}
              placeholder="£"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Planned Major Works (Section 20 Notices) Disclosed</label>
            <input
              type="text"
              value={data.plannedMajorWorksDisclosed}
              onChange={(e) => setField('plannedMajorWorksDisclosed', e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* 7. Buildings Insurance */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          <span>7. Buildings Insurance</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={labelCls}>Arranged By</label>
            <OptionPills
              value={data.insuranceArrangedBy}
              onChange={(v) => setField('insuranceArrangedBy', v)}
              options={[
                { value: 'FREEHOLDER_MANAGING_AGENT', label: 'Freeholder / Managing Agent' },
                { value: 'LEASEHOLDER', label: 'Leaseholder' },
              ]}
            />
          </div>
          <div>
            <label className={labelCls}>Insurer Name</label>
            <input
              type="text"
              value={data.insurerName}
              onChange={(e) => setField('insurerName', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Policy Number</label>
            <input
              type="text"
              value={data.policyNumber}
              onChange={(e) => setField('policyNumber', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Renewal Date</label>
            <input
              type="date"
              value={data.insuranceRenewalDate}
              onChange={(e) => setField('insuranceRenewalDate', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Annual Premium (if billed separately from service charge) (£)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={data.annualInsurancePremium}
              onChange={(e) => setField('annualInsurancePremium', e.target.value)}
              placeholder="£"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Claims Contact Number</label>
            <input
              type="text"
              value={data.claimsContactNumber}
              onChange={(e) => setField('claimsContactNumber', e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* 8. Lease Covenants, Restrictions & Consents */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
          8. Lease Covenants, Restrictions &amp; Consents
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Subletting / Renting Permitted?</label>
            <OptionPills
              value={data.sublettingPermitted}
              onChange={(v) => setField('sublettingPermitted', v)}
              options={[
                { value: 'YES', label: 'Yes' },
                { value: 'WITH_CONSENT', label: 'With Consent' },
                { value: 'NO', label: 'No' },
              ]}
            />
          </div>
          <div>
            <label className={labelCls}>Pets Permitted?</label>
            <OptionPills
              value={data.petsPermitted}
              onChange={(v) => setField('petsPermitted', v)}
              options={[
                { value: 'YES', label: 'Yes' },
                { value: 'WITH_CONSENT', label: 'With Consent' },
                { value: 'NO', label: 'No' },
              ]}
            />
          </div>
          <div>
            <label className={labelCls}>Alterations Permitted?</label>
            <OptionPills
              value={data.alterationsPermitted}
              onChange={(v) => setField('alterationsPermitted', v)}
              options={[
                { value: 'YES', label: 'Yes' },
                { value: 'WITH_CONSENT', label: 'With Consent' },
                { value: 'NO', label: 'No' },
              ]}
            />
          </div>
          <div>
            <label className={labelCls}>Deed of Covenant / Notice of Transfer Fee Paid (£)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={data.deedOfCovenantFeePaid}
              onChange={(e) => setField('deedOfCovenantFeePaid', e.target.value)}
              placeholder="£"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Share / Membership Certificate Received?</label>
            <OptionPills
              value={data.shareCertificateReceived}
              onChange={(v) => setField('shareCertificateReceived', v)}
              options={[
                { value: 'YES', label: 'Yes' },
                { value: 'NO', label: 'No' },
                { value: 'N/A', label: 'N/A' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* 9. Key Documents Checklist & Storage Location */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
          <CheckSquare className="w-3.5 h-3.5" />
          <span>9. Key Documents Checklist &amp; Storage Location</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                <th className="py-2 pr-3 w-16 text-center">Received</th>
                <th className="py-2 pr-3">Document Name</th>
                <th className="py-2">Stored Location (Folder / Cloud / Solicitor)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {(data.keyDocumentsChecklist || []).map((row, idx) => (
                <tr key={row.documentName} className="hover:bg-slate-900/40">
                  <td className="py-2 pr-3 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(row.received)}
                      onChange={(e) => updateChecklistItem(idx, { received: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                  </td>
                  <td className="py-2 pr-3 text-slate-200 font-medium">{row.documentName}</td>
                  <td className="py-1.5">
                    <input
                      type="text"
                      value={row.storedLocation || ''}
                      onChange={(e) => updateChecklistItem(idx, { storedLocation: e.target.value })}
                      placeholder="Folder / Cloud / Solicitor"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 text-[11px] focus:outline-none focus:border-indigo-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default LeaseholdRecordForm;
