export const TENANT_STANDARD_DOCUMENTS = [
  { name: 'EPC', hasExpiryDate: true, description: 'Energy Performance Certificate' },
  { name: 'EICR', hasExpiryDate: true, description: 'Electrical Installation Condition Report' },
  { name: 'Floor Plan', hasExpiryDate: false, description: 'Architectural / Layout Plan' },
  { name: 'Tenancy Agreement', hasExpiryDate: true, description: 'Signed AST Agreement' },
  { name: 'Tenant ID - 1', hasExpiryDate: false, description: 'Primary ID (Driving Licence / Photo ID)' },
  { name: 'Tenant ID - 2', hasExpiryDate: false, description: 'Secondary Identification Document' },
  { name: 'Tenant ID - 3', hasExpiryDate: false, description: 'Tertiary Identification Document' },
  { name: 'Tenant Passports', hasExpiryDate: false, description: 'Passport Copy / Identity Verification' },
  { name: 'Anti Social Behavior', hasExpiryDate: false, description: 'ASB Policy Agreement & Acknowledgment' },
  { name: 'How to Rent', hasExpiryDate: false, description: 'UK Government How to Rent Checklist' },
  { name: 'Renters Rights Act', hasExpiryDate: false, description: 'Renters Rights Statutory Notice' },
  { name: 'DPS', hasExpiryDate: false, description: 'Deposit Protection Service Prescribed Information' },
  { name: 'Rent Protection Insurance', hasExpiryDate: true, description: 'Rent Guarantee & Legal Protection Policy' },
  { name: 'Tenant Payslips', hasExpiryDate: false, description: 'Recent Employment Income Proof / Payslips' },
  { name: 'Tenant Bank Statement', hasExpiryDate: false, description: 'Recent Bank Statements / Financial Proof' },
  { name: 'Right to Rent Check', hasExpiryDate: true, description: 'Home Office Statutory Right to Rent Check' },
  { name: 'Gas Certificate', hasExpiryDate: true, description: 'Annual CP12 Gas Safety Record' },
  { name: 'Other Document', hasExpiryDate: false, description: 'Miscellaneous Supporting Document' },
  { name: 'Property Picture', hasExpiryDate: false, description: 'Inventory & Tenancy Check-In Photographs' },
];

export function calculateDocumentStatus(expiryDate) {
  if (!expiryDate) {
    return {
      status: 'No Expiry Date',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
      daysRemaining: null,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);

  const diffTime = exp.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'Expired',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 font-bold',
      daysRemaining: diffDays,
    };
  }

  if (diffDays <= 30) {
    return {
      status: 'Expiring Soon',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-bold',
      daysRemaining: diffDays,
    };
  }

  return {
    status: 'Valid',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-bold',
    daysRemaining: diffDays,
  };
}
