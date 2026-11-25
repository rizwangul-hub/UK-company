import { Type } from '@google/genai';
import Property from '../../models/Property.js';
import Unit from '../../models/Unit.js';
import Tenant from '../../models/Tenant.js';
import TenancyAgreement from '../../models/TenancyAgreement.js';
import RentSchedule from '../../models/RentSchedule.js';
import RentPayment from '../../models/RentPayment.js';
import Account from '../../models/Account.js';
import Transaction from '../../models/Transaction.js';
import Mortgage from '../../models/Mortgage.js';
import MortgagePayment from '../../models/MortgagePayment.js';
import StatementImportBatch from '../../models/StatementImportBatch.js';
import StatementImportRow from '../../models/StatementImportRow.js';
import PropertyDocument from '../../models/PropertyDocument.js';
import TenantDocument from '../../models/TenantDocument.js';
import EmailNotificationConfig from '../../models/EmailNotificationConfig.js';
import AIAuditLog from '../../models/AIAuditLog.js';
import { getCompanyById } from '../../config/companies.js';
import {
  getAuthorizedCompanies,
  assertCompanyAuthorized,
  resolveRequestedCompanies,
} from './CompanyAuthorizationService.js';
import { createApprovalRequest } from './ApprovalService.js';
import { getUsageLimitsConfig } from './AIUsageService.js';

const toPence = (gbp) => Math.round((Number(gbp) || 0) * 100);
const fromPence = (pence) => Number((Number(pence || 0) / 100).toFixed(2));

const parsePeriodRange = ({ month, startDate, endDate } = {}) => {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    return {
      label: month,
      start: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
    };
  }
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate) : new Date('2020-01-01T00:00:00.000Z');
    const end = endDate ? new Date(`${String(endDate).slice(0, 10)}T23:59:59.999Z`) : new Date();
    return {
      label: `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`,
      start,
      end,
    };
  }
  return { label: 'All Time', start: null, end: null };
};

const metaEnvelope = (companyLabel, periodLabel, recordCount, data) => ({
  company: companyLabel,
  period: periodLabel,
  currency: 'GBP',
  retrievedAt: new Date().toISOString(),
  recordCount,
  ...data,
});

export const toolDeclarations = [
  {
    name: 'list_companies',
    description: 'List all UK Pixx companies that the authenticated user is authorized to access.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'get_company_details',
    description: 'Get legal details and registration info for a specific UK company.',
    parameters: {
      type: Type.OBJECT,
      properties: { companyId: { type: Type.STRING, description: 'Company ID (e.g. old-street, best-standard, sk-hamilton, homewards, mile-end-road, global-standard)' } },
      required: ['companyId'],
    },
  },
  {
    name: 'get_company_summary',
    description: 'Get high-level summary (properties, tenants, bank balances, income, expenses, rent arrears) for one company or ALL authorized companies.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING, description: 'Company ID or ALL' },
        month: { type: Type.STRING, description: 'Optional YYYY-MM billing/reporting month' },
      },
    },
  },
  {
    name: 'list_properties',
    description: 'List properties for one or all authorized companies.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING, description: 'Company ID or ALL' },
        search: { type: Type.STRING, description: 'Optional property name/postcode filter' },
      },
    },
  },
  {
    name: 'get_property_details',
    description: 'Get full details of a specific property including units, leasehold record, and active tenancies.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        propertyId: { type: Type.STRING },
        propertyName: { type: Type.STRING, description: 'Optional property name search if ID is unknown' },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'get_property_financial_summary',
    description: 'Get actual income, actual expenses, net profit, and mortgage debt for a specific property.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        propertyId: { type: Type.STRING },
        month: { type: Type.STRING },
        startDate: { type: Type.STRING },
        endDate: { type: Type.STRING },
      },
      required: ['companyId', 'propertyId'],
    },
  },
  {
    name: 'list_tenants',
    description: 'List tenants for one or all authorized companies.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        search: { type: Type.STRING },
      },
    },
  },
  {
    name: 'get_tenant_details',
    description: 'Get details, active tenancies, and rent schedules for a specific tenant.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        tenantId: { type: Type.STRING },
        tenantName: { type: Type.STRING },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'get_rent_records',
    description: 'Get scheduled vs paid rent records (RentSchedule) for a company or all companies.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        month: { type: Type.STRING, description: 'YYYY-MM' },
        status: { type: Type.STRING, description: 'PENDING, PARTIAL, PAID, OVERDUE' },
      },
    },
  },
  {
    name: 'get_rent_payment_history',
    description: 'Get actual recorded rent payments (RentPayment).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        month: { type: Type.STRING },
        tenantId: { type: Type.STRING },
      },
    },
  },
  {
    name: 'get_rent_arrears',
    description: 'Get outstanding rent arrears across PENDING, PARTIAL, and OVERDUE schedules.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        month: { type: Type.STRING },
      },
    },
  },
  {
    name: 'get_bank_accounts',
    description: 'Get bank and cash accounts with current balances.',
    parameters: {
      type: Type.OBJECT,
      properties: { companyId: { type: Type.STRING } },
    },
  },
  {
    name: 'get_bank_ledger',
    description: 'Get posted bank ledger transactions for a bank account or company.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        accountId: { type: Type.STRING },
        month: { type: Type.STRING },
        startDate: { type: Type.STRING },
        endDate: { type: Type.STRING },
        limit: { type: Type.NUMBER },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'get_income',
    description: 'Get actual posted income transactions and totals by category/company.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        month: { type: Type.STRING },
        startDate: { type: Type.STRING },
        endDate: { type: Type.STRING },
      },
    },
  },
  {
    name: 'get_expenses',
    description: 'Get actual posted expense transactions and totals by category/company.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        month: { type: Type.STRING },
        startDate: { type: Type.STRING },
        endDate: { type: Type.STRING },
      },
    },
  },
  {
    name: 'get_general_ledger',
    description: 'Get general ledger entries (posted vs deleted/draft summary) for a company.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        month: { type: Type.STRING },
        startDate: { type: Type.STRING },
        endDate: { type: Type.STRING },
        limit: { type: Type.NUMBER },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'get_profit_loss',
    description: 'Compute verified Profit & Loss statement (Actual Income, Actual Expenses, Net Profit) from posted transactions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        month: { type: Type.STRING },
        startDate: { type: Type.STRING },
        endDate: { type: Type.STRING },
      },
    },
  },
  {
    name: 'get_balance_sheet',
    description: 'Compute verified Balance Sheet snapshot (Property Assets, Bank/Cash Liquidity, Mortgage Liabilities, Net Equity).',
    parameters: {
      type: Type.OBJECT,
      properties: { companyId: { type: Type.STRING } },
    },
  },
  {
    name: 'get_cash_flow',
    description: 'Compute verified Cash Flow summary (Inflows, Outflows, Transfers, Net Cash Movement).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        month: { type: Type.STRING },
        startDate: { type: Type.STRING },
        endDate: { type: Type.STRING },
      },
    },
  },
  {
    name: 'list_mortgages',
    description: 'List mortgages and outstanding principal balances.',
    parameters: {
      type: Type.OBJECT,
      properties: { companyId: { type: Type.STRING } },
    },
  },
  {
    name: 'get_mortgage_details',
    description: 'Get details for a specific mortgage.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        mortgageId: { type: Type.STRING },
      },
      required: ['companyId', 'mortgageId'],
    },
  },
  {
    name: 'get_mortgage_payment_history',
    description: 'Get mortgage payment history.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        mortgageId: { type: Type.STRING },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'get_bank_reconciliation',
    description: 'Compare uploaded StatementImportBatch rows against posted bank ledger transactions for a company/account.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        batchId: { type: Type.STRING },
        accountId: { type: Type.STRING },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'get_unmatched_transactions',
    description: 'Get statement rows that are unmatched or pending review in StatementImportRow.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        batchId: { type: Type.STRING },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'get_missing_transactions',
    description: 'Identify statement entries missing from the bank ledger and ledger entries missing from the statement.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        batchId: { type: Type.STRING },
        accountId: { type: Type.STRING },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'get_reconciliation_differences',
    description: 'Check opening balance, closing balance, and calculated difference between uploaded statement and bank ledger.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        batchId: { type: Type.STRING },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'search_documents',
    description: 'Search property and tenant documents by title, category, or status.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        query: { type: Type.STRING },
      },
    },
  },
  {
    name: 'get_document_details',
    description: 'Get metadata for a specific PropertyDocument or TenantDocument.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        documentId: { type: Type.STRING },
      },
      required: ['companyId', 'documentId'],
    },
  },
  {
    name: 'get_authorized_document_content',
    description: 'Retrieve authorized text/notes/summary metadata of a document (truncated safely to max document size).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        documentId: { type: Type.STRING },
      },
      required: ['companyId', 'documentId'],
    },
  },
  {
    name: 'generate_monthly_report',
    description: 'Generate a structured monthly financial report preview for a company or all companies.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        month: { type: Type.STRING, description: 'YYYY-MM' },
      },
      required: ['month'],
    },
  },
  {
    name: 'generate_company_report',
    description: 'Generate a comprehensive company report preview (P&L, Bank Balances, Rent Arrears, Mortgages).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        month: { type: Type.STRING },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'generate_property_report',
    description: 'Generate a property-level financial and compliance report preview.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        propertyId: { type: Type.STRING },
      },
      required: ['companyId', 'propertyId'],
    },
  },
  {
    name: 'generate_rent_arrears_report',
    description: 'Generate a rent arrears report preview across one or all companies.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        month: { type: Type.STRING },
      },
    },
  },
  {
    name: 'search_emails',
    description: 'Search logged outbound notifications, rent due notices, and AI email audit records by recipient, subject, or keyword.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING },
        recipient: { type: Type.STRING },
      },
    },
  },
  {
    name: 'prepare_email_draft',
    description: 'Prepare a professional email draft preview without sending it.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: { type: Type.STRING },
        subject: { type: Type.STRING },
        body: { type: Type.STRING },
        replyTo: { type: Type.STRING },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'request_send_email_approval',
    description: 'Prepare an email and create a one-time approval request so the user can review and explicitly approve before sending.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        to: { type: Type.STRING },
        subject: { type: Type.STRING },
        body: { type: Type.STRING },
        replyTo: { type: Type.STRING },
      },
      required: ['companyId', 'to', 'subject', 'body'],
    },
  },
  {
    name: 'request_write_approval',
    description: 'Prepare a preview and one-time approval request for a controlled write operation (CREATE_EXPENSE_DRAFT, CREATE_INCOME_DRAFT, CREATE_PROPERTY_NOTE, CREATE_MAINTENANCE_REQUEST, CREATE_COMPLIANCE_REMINDER, PREPARE_RECONCILIATION_ADJUSTMENT, CREATE_SUPPLIER_INVOICE_DRAFT).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING },
        actionType: { type: Type.STRING },
        title: { type: Type.STRING },
        summary: { type: Type.STRING },
        payloadJson: { type: Type.STRING, description: 'JSON string of the action payload fields' },
      },
      required: ['companyId', 'actionType', 'title', 'payloadJson'],
    },
  },
];

export const createToolExecutor = ({ user, activeCompanyId, conversationId }) => {
  const resolveScope = (requestedCompanyId) =>
    resolveRequestedCompanies(user, requestedCompanyId, activeCompanyId);

  return async (toolName, args = {}) => {
    switch (toolName) {
      case 'list_companies': {
        const companies = getAuthorizedCompanies(user);
        return metaEnvelope('ALL AUTHORIZED', 'N/A', companies.length, { companies });
      }

      case 'get_company_details': {
        const { company } = assertCompanyAuthorized(user, args.companyId);
        return metaEnvelope(company.name, 'N/A', 1, { companyDetails: company });
      }

      case 'get_company_summary': {
        const scope = resolveScope(args.companyId);
        const period = parsePeriodRange({ month: args.month });
        const summaries = [];

        for (const comp of scope.companies) {
          const txMatch = { companyId: comp.id, isDeleted: false };
          if (period.start && period.end) {
            txMatch.transactionDate = { $gte: period.start, $lte: period.end };
          }
          const [propCount, tenantCount, accounts, txs, arrears] = await Promise.all([
            Property.countDocuments({ companyId: comp.id, isActive: true }),
            Tenant.countDocuments({ companyId: comp.id, isActive: true }),
            Account.find({ companyId: comp.id, isActive: true }).lean(),
            Transaction.find(txMatch).select('transactionType amount').lean(),
            RentSchedule.find({ companyId: comp.id, status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] } })
              .select('outstandingAmount')
              .lean(),
          ]);

          const bankPence = accounts.reduce((s, a) => s + toPence(a.currentBalance), 0);
          const incPence = txs
            .filter((t) => t.transactionType === 'INCOME')
            .reduce((s, t) => s + toPence(t.amount), 0);
          const expPence = txs
            .filter((t) => ['EXPENSE', 'MORTGAGE_PAYMENT'].includes(t.transactionType))
            .reduce((s, t) => s + toPence(t.amount), 0);
          const arrearsPence = arrears.reduce((s, r) => s + toPence(r.outstandingAmount), 0);

          summaries.push({
            companyId: comp.id,
            companyName: comp.name,
            propertiesCount: propCount,
            tenantsCount: tenantCount,
            totalBankBalanceGBP: fromPence(bankPence),
            actualIncomeGBP: fromPence(incPence),
            actualExpensesGBP: fromPence(expPence),
            netOperatingGBP: fromPence(incPence - expPence),
            rentArrearsGBP: fromPence(arrearsPence),
          });
        }

        return metaEnvelope(
          scope.mode === 'ALL' ? 'ALL AUTHORIZED COMPANIES' : scope.companies[0]?.name,
          period.label,
          summaries.length,
          { summaries }
        );
      }

      case 'list_properties': {
        const scope = resolveScope(args.companyId);
        const query = { companyId: { $in: scope.companyIds }, isActive: true };
        if (args.search) {
          query.$or = [
            { name: { $regex: args.search, $options: 'i' } },
            { postcode: { $regex: args.search, $options: 'i' } },
          ];
        }
        const props = await Property.find(query)
          .select('companyId name propertyCode propertyType tenure status contractualRent rentFrequency postcode purchasePrice currentValuation')
          .lean();
        return metaEnvelope(
          scope.mode === 'ALL' ? 'ALL AUTHORIZED' : scope.companies[0]?.name,
          'Current',
          props.length,
          { properties: props }
        );
      }

      case 'get_property_details': {
        const { companyId, company } = assertCompanyAuthorized(user, args.companyId);
        let prop = null;
        if (args.propertyId) {
          prop = await Property.findOne({ _id: args.propertyId, companyId }).lean();
        } else if (args.propertyName) {
          prop = await Property.findOne({
            companyId,
            name: { $regex: args.propertyName, $options: 'i' },
          }).lean();
        }
        if (!prop) return metaEnvelope(company.name, 'Current', 0, { error: 'Property not found.' });
        const [units, tenancies] = await Promise.all([
          Unit.find({ companyId, propertyId: prop._id, isActive: true }).lean(),
          TenancyAgreement.find({ companyId, propertyId: prop._id, status: 'ACTIVE' })
            .populate('tenantId', 'fullName email phone')
            .lean(),
        ]);
        return metaEnvelope(company.name, 'Current', 1, { property: prop, units, activeTenancies: tenancies });
      }

      case 'get_property_financial_summary': {
        const { companyId, company } = assertCompanyAuthorized(user, args.companyId);
        const period = parsePeriodRange(args);
        const txMatch = { companyId, propertyId: args.propertyId, isDeleted: false };
        if (period.start && period.end) {
          txMatch.transactionDate = { $gte: period.start, $lte: period.end };
        }
        const [txs, mortgages] = await Promise.all([
          Transaction.find(txMatch).select('transactionType amount').lean(),
          Mortgage.find({ companyId, propertyId: args.propertyId, status: 'ACTIVE' })
            .select('lenderName outstandingPrincipalBalance monthlyPayment')
            .lean(),
        ]);
        const incPence = txs.filter((t) => t.transactionType === 'INCOME').reduce((s, t) => s + toPence(t.amount), 0);
        const expPence = txs
          .filter((t) => ['EXPENSE', 'MORTGAGE_PAYMENT'].includes(t.transactionType))
          .reduce((s, t) => s + toPence(t.amount), 0);
        const debtPence = mortgages.reduce((s, m) => s + toPence(m.outstandingPrincipalBalance), 0);

        return metaEnvelope(company.name, period.label, txs.length, {
          propertyId: args.propertyId,
          actualIncomeGBP: fromPence(incPence),
          actualExpensesGBP: fromPence(expPence),
          netProfitGBP: fromPence(incPence - expPence),
          outstandingMortgageDebtGBP: fromPence(debtPence),
        });
      }

      case 'list_tenants': {
        const scope = resolveScope(args.companyId);
        const query = { companyId: { $in: scope.companyIds }, isActive: true };
        if (args.search) {
          query.fullName = { $regex: args.search, $options: 'i' };
        }
        const tenants = await Tenant.find(query).select('companyId fullName email phone status').lean();
        return metaEnvelope(
          scope.mode === 'ALL' ? 'ALL AUTHORIZED' : scope.companies[0]?.name,
          'Current',
          tenants.length,
          { tenants }
        );
      }

      case 'get_tenant_details': {
        const { companyId, company } = assertCompanyAuthorized(user, args.companyId);
        let tenant = null;
        if (args.tenantId) {
          tenant = await Tenant.findOne({ _id: args.tenantId, companyId }).lean();
        } else if (args.tenantName) {
          tenant = await Tenant.findOne({
            companyId,
            fullName: { $regex: args.tenantName, $options: 'i' },
          }).lean();
        }
        if (!tenant) return metaEnvelope(company.name, 'Current', 0, { error: 'Tenant not found.' });
        const [agreements, schedules] = await Promise.all([
          TenancyAgreement.find({ companyId, tenantId: tenant._id }).populate('propertyId', 'name').lean(),
          RentSchedule.find({ companyId, tenantId: tenant._id }).sort({ billingMonth: -1 }).limit(12).lean(),
        ]);
        return metaEnvelope(company.name, 'Current', 1, { tenant, agreements, recentSchedules: schedules });
      }

      case 'get_rent_records': {
        const scope = resolveScope(args.companyId);
        const query = { companyId: { $in: scope.companyIds } };
        if (args.month) query.billingMonth = args.month;
        if (args.status) query.status = String(args.status).toUpperCase();
        const schedules = await RentSchedule.find(query)
          .populate('tenantId', 'fullName email')
          .populate('propertyId', 'name')
          .sort({ dueDate: -1 })
          .limit(100)
          .lean();
        const expectedPence = schedules.reduce((s, r) => s + toPence(r.expectedAmount), 0);
        const paidPence = schedules.reduce((s, r) => s + toPence(r.paidAmount), 0);
        const outPence = schedules.reduce((s, r) => s + toPence(r.outstandingAmount), 0);
        return metaEnvelope(
          scope.mode === 'ALL' ? 'ALL AUTHORIZED' : scope.companies[0]?.name,
          args.month || 'All Months',
          schedules.length,
          {
            recordType: 'SCHEDULED_RENT',
            totalExpectedGBP: fromPence(expectedPence),
            totalPaidGBP: fromPence(paidPence),
            totalOutstandingGBP: fromPence(outPence),
            schedules,
          }
        );
      }

      case 'get_rent_payment_history': {
        const scope = resolveScope(args.companyId);
        const period = parsePeriodRange({ month: args.month });
        const query = { companyId: { $in: scope.companyIds } };
        if (args.tenantId) query.tenantId = args.tenantId;
        if (period.start && period.end) {
          query.paymentDate = { $gte: period.start, $lte: period.end };
        }
        const payments = await RentPayment.find(query)
          .populate('tenantId', 'fullName')
          .populate('propertyId', 'name')
          .sort({ paymentDate: -1 })
          .limit(100)
          .lean();
        const totalPence = payments.reduce((s, p) => s + toPence(p.amountPaid), 0);
        return metaEnvelope(
          scope.mode === 'ALL' ? 'ALL AUTHORIZED' : scope.companies[0]?.name,
          period.label,
          payments.length,
          { recordType: 'ACTUAL_RENT_PAYMENTS', totalPaidGBP: fromPence(totalPence), payments }
        );
      }

      case 'get_rent_arrears': {
        const scope = resolveScope(args.companyId);
        const query = {
          companyId: { $in: scope.companyIds },
          status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
          outstandingAmount: { $gt: 0 },
        };
        if (args.month) query.billingMonth = args.month;
        const arrears = await RentSchedule.find(query)
          .populate('tenantId', 'fullName email phone')
          .populate('propertyId', 'name')
          .sort({ dueDate: 1 })
          .limit(100)
          .lean();
        const totalArrearsPence = arrears.reduce((s, r) => s + toPence(r.outstandingAmount), 0);
        return metaEnvelope(
          scope.mode === 'ALL' ? 'ALL AUTHORIZED' : scope.companies[0]?.name,
          args.month || 'Current Arrears',
          arrears.length,
          { totalArrearsGBP: fromPence(totalArrearsPence), arrears }
        );
      }

      case 'get_bank_accounts': {
        const scope = resolveScope(args.companyId);
        const accounts = await Account.find({ companyId: { $in: scope.companyIds }, isActive: true }).lean();
        const totalPence = accounts.reduce((s, a) => s + toPence(a.currentBalance), 0);
        return metaEnvelope(
          scope.mode === 'ALL' ? 'ALL AUTHORIZED' : scope.companies[0]?.name,
          'Current Balances',
          accounts.length,
          { totalBalanceGBP: fromPence(totalPence), accounts }
        );
      }

      case 'get_bank_ledger': {
        const { companyId, company } = assertCompanyAuthorized(user, args.companyId);
        const period = parsePeriodRange(args);
        const query = { companyId, isDeleted: false };
        if (args.accountId) query.accountId = args.accountId;
        if (period.start && period.end) query.transactionDate = { $gte: period.start, $lte: period.end };
        const txs = await Transaction.find(query)
          .populate('accountId', 'name accountType')
          .populate('categoryId', 'name type')
          .sort({ transactionDate: -1 })
          .limit(Math.min(Number(args.limit) || 100, 250))
          .lean();
        return metaEnvelope(company.name, period.label, txs.length, {
          recordType: 'POSTED_BANK_LEDGER',
          transactions: txs,
        });
      }

      case 'get_income':
      case 'get_expenses': {
        const scope = resolveScope(args.companyId);
        const period = parsePeriodRange(args);
        const isIncome = toolName === 'get_income';
        const query = {
          companyId: { $in: scope.companyIds },
          isDeleted: false,
          transactionType: isIncome ? 'INCOME' : { $in: ['EXPENSE', 'MORTGAGE_PAYMENT'] },
        };
        if (period.start && period.end) query.transactionDate = { $gte: period.start, $lte: period.end };
        const txs = await Transaction.find(query)
          .populate('categoryId', 'name type')
          .populate('propertyId', 'name')
          .sort({ transactionDate: -1 })
          .limit(200)
          .lean();
        const totalPence = txs.reduce((s, t) => s + toPence(t.amount), 0);
        const byCompany = {};
        for (const t of txs) {
          byCompany[t.companyId] = (byCompany[t.companyId] || 0) + toPence(t.amount);
        }
        const companyTotals = Object.entries(byCompany).map(([cid, p]) => ({
          companyId: cid,
          companyName: getCompanyById(cid)?.name || cid,
          totalGBP: fromPence(p),
        }));
        return metaEnvelope(
          scope.mode === 'ALL' ? 'ALL AUTHORIZED' : scope.companies[0]?.name,
          period.label,
          txs.length,
          {
            recordType: isIncome ? 'ACTUAL_POSTED_INCOME' : 'ACTUAL_POSTED_EXPENSES',
            totalGBP: fromPence(totalPence),
            companyTotals,
            transactions: txs.slice(0, 50),
          }
        );
      }

      case 'get_general_ledger': {
        const { companyId, company } = assertCompanyAuthorized(user, args.companyId);
        const period = parsePeriodRange(args);
        const query = { companyId, isDeleted: false };
        if (period.start && period.end) query.transactionDate = { $gte: period.start, $lte: period.end };
        const [txs, draftBatches, reversedBatches] = await Promise.all([
          Transaction.find(query)
            .populate('accountId', 'name')
            .populate('categoryId', 'name type')
            .sort({ transactionDate: -1 })
            .limit(Math.min(Number(args.limit) || 100, 200))
            .lean(),
          StatementImportBatch.countDocuments({ companyId, status: 'DRAFT' }),
          StatementImportBatch.countDocuments({ companyId, status: 'REVERSED' }),
        ]);
        return metaEnvelope(company.name, period.label, txs.length, {
          postedRecordsCount: txs.length,
          draftBatchesCount: draftBatches,
          reversedBatchesCount: reversedBatches,
          transactions: txs,
        });
      }

      case 'get_profit_loss': {
        const scope = resolveScope(args.companyId);
        const period = parsePeriodRange(args);
        const query = { companyId: { $in: scope.companyIds }, isDeleted: false };
        if (period.start && period.end) query.transactionDate = { $gte: period.start, $lte: period.end };
        const txs = await Transaction.find(query).select('companyId transactionType amount').lean();
        let incPence = 0;
        let expPence = 0;
        for (const t of txs) {
          if (t.transactionType === 'INCOME') incPence += toPence(t.amount);
          else if (['EXPENSE', 'MORTGAGE_PAYMENT'].includes(t.transactionType)) expPence += toPence(t.amount);
        }
        return metaEnvelope(
          scope.mode === 'ALL' ? 'ALL AUTHORIZED' : scope.companies[0]?.name,
          period.label,
          txs.length,
          {
            actualIncomeGBP: fromPence(incPence),
            actualExpensesGBP: fromPence(expPence),
            netProfitGBP: fromPence(incPence - expPence),
          }
        );
      }

      case 'get_balance_sheet': {
        const scope = resolveScope(args.companyId);
        const [props, accounts, mortgages] = await Promise.all([
          Property.find({ companyId: { $in: scope.companyIds }, isActive: true })
            .select('currentValuation purchasePrice')
            .lean(),
          Account.find({ companyId: { $in: scope.companyIds }, isActive: true })
            .select('currentBalance')
            .lean(),
          Mortgage.find({ companyId: { $in: scope.companyIds }, status: 'ACTIVE' })
            .select('outstandingPrincipalBalance')
            .lean(),
        ]);
        const propPence = props.reduce((s, p) => s + toPence(p.currentValuation || p.purchasePrice), 0);
        const cashPence = accounts.reduce((s, a) => s + toPence(a.currentBalance), 0);
        const debtPence = mortgages.reduce((s, m) => s + toPence(m.outstandingPrincipalBalance), 0);
        return metaEnvelope(
          scope.mode === 'ALL' ? 'ALL AUTHORIZED' : scope.companies[0]?.name,
          'Point-in-Time Snapshot',
          props.length + accounts.length + mortgages.length,
          {
            propertyAssetsGBP: fromPence(propPence),
            cashAndBankGBP: fromPence(cashPence),
            totalAssetsGBP: fromPence(propPence + cashPence),
            mortgageLiabilitiesGBP: fromPence(debtPence),
            netEquityGBP: fromPence(propPence + cashPence - debtPence),
          }
        );
      }

      case 'get_cash_flow': {
        const scope = resolveScope(args.companyId);
        const period = parsePeriodRange(args);
        const query = { companyId: { $in: scope.companyIds }, isDeleted: false };
        if (period.start && period.end) query.transactionDate = { $gte: period.start, $lte: period.end };
        const txs = await Transaction.find(query).select('transactionType amount').lean();
        const inflowPence = txs.filter((t) => t.transactionType === 'INCOME').reduce((s, t) => s + toPence(t.amount), 0);
        const outflowPence = txs
          .filter((t) => ['EXPENSE', 'MORTGAGE_PAYMENT'].includes(t.transactionType))
          .reduce((s, t) => s + toPence(t.amount), 0);
        return metaEnvelope(
          scope.mode === 'ALL' ? 'ALL AUTHORIZED' : scope.companies[0]?.name,
          period.label,
          txs.length,
          {
            cashInflowsGBP: fromPence(inflowPence),
            cashOutflowsGBP: fromPence(outflowPence),
            netCashFlowGBP: fromPence(inflowPence - outflowPence),
          }
        );
      }

      case 'list_mortgages': {
        const scope = resolveScope(args.companyId);
        const mortgages = await Mortgage.find({ companyId: { $in: scope.companyIds } })
          .populate('propertyId', 'name')
          .lean();
        const debtPence = mortgages.reduce((s, m) => s + toPence(m.outstandingPrincipalBalance), 0);
        return metaEnvelope(
          scope.mode === 'ALL' ? 'ALL AUTHORIZED' : scope.companies[0]?.name,
          'Current',
          mortgages.length,
          { totalOutstandingDebtGBP: fromPence(debtPence), mortgages }
        );
      }

      case 'get_mortgage_details': {
        const { companyId, company } = assertCompanyAuthorized(user, args.companyId);
        const mortgage = await Mortgage.findOne({ _id: args.mortgageId, companyId })
          .populate('propertyId', 'name')
          .lean();
        return metaEnvelope(company.name, 'Current', mortgage ? 1 : 0, { mortgage });
      }

      case 'get_mortgage_payment_history': {
        const { companyId, company } = assertCompanyAuthorized(user, args.companyId);
        const query = { companyId };
        if (args.mortgageId) query.mortgageId = args.mortgageId;
        const payments = await MortgagePayment.find(query).sort({ paymentDate: -1 }).limit(100).lean();
        return metaEnvelope(company.name, 'All Time', payments.length, { payments });
      }

      case 'get_bank_reconciliation':
      case 'get_unmatched_transactions':
      case 'get_missing_transactions':
      case 'get_reconciliation_differences': {
        const { companyId, company } = assertCompanyAuthorized(user, args.companyId);
        const batchQuery = { companyId };
        if (args.batchId) batchQuery._id = args.batchId;
        if (args.accountId) batchQuery.accountId = args.accountId;

        const batch = await StatementImportBatch.findOne(batchQuery)
          .populate('accountId', 'name currentBalance')
          .sort({ createdAt: -1 })
          .lean();

        if (!batch) {
          return metaEnvelope(company.name, 'N/A', 0, {
            message: 'No uploaded bank statement batches found for this company/account.',
          });
        }

        const rows = await StatementImportRow.find({ companyId, batchId: batch._id }).lean();
        const ledgerQuery = { companyId, accountId: batch.accountId?._id || batch.accountId, isDeleted: false };
        if (batch.statementPeriodStart && batch.statementPeriodEnd) {
          ledgerQuery.transactionDate = { $gte: batch.statementPeriodStart, $lte: batch.statementPeriodEnd };
        }
        const ledgerTxs = await Transaction.find(ledgerQuery).lean();

        const matchedRows = rows.filter((r) => Boolean(r.postedTransactionId) || r.status === 'POSTED');
        const unmatchedStatementRows = rows.filter((r) => !r.postedTransactionId && r.status !== 'POSTED' && r.status !== 'SKIPPED');
        const linkedTxIds = new Set(rows.map((r) => r.postedTransactionId?.toString()).filter(Boolean));
        const ledgerOnlyTxs = ledgerTxs.filter((t) => !linkedTxIds.has(t._id.toString()));

        const statementNetPence = rows.reduce(
          (s, r) => s + toPence(r.creditAmount || 0) - toPence(r.debitAmount || 0),
          0
        );
        const ledgerNetPence = ledgerTxs.reduce(
          (s, t) => s + (t.transactionType === 'INCOME' ? toPence(t.amount) : -toPence(t.amount)),
          0
        );

        return metaEnvelope(
          company.name,
          batch.statementPeriodStart
            ? `${new Date(batch.statementPeriodStart).toISOString().slice(0, 10)} to ${new Date(batch.statementPeriodEnd || batch.statementPeriodStart).toISOString().slice(0, 10)}`
            : batch.filename,
          rows.length,
          {
            batchId: batch._id,
            filename: batch.filename,
            batchStatus: batch.status,
            accountName: batch.accountId?.name || 'Bank Account',
            openingBalanceGBP: batch.openingBalance,
            closingBalanceGBP: batch.closingBalance,
            statementNetMovementGBP: fromPence(statementNetPence),
            ledgerNetMovementGBP: fromPence(ledgerNetPence),
            reconciliationDifferenceGBP: fromPence(statementNetPence - ledgerNetPence),
            matchedCount: matchedRows.length,
            missingFromLedgerCount: unmatchedStatementRows.length,
            missingFromStatementCount: ledgerOnlyTxs.length,
            missingFromLedgerRows: unmatchedStatementRows.slice(0, 25),
            ledgerOnlyTransactions: ledgerOnlyTxs.slice(0, 25),
          }
        );
      }

      case 'search_documents': {
        const scope = resolveScope(args.companyId);
        const q = { companyId: { $in: scope.companyIds }, isActive: true };
        if (args.query) {
          q.$or = [
            { title: { $regex: args.query, $options: 'i' } },
            { category: { $regex: args.query, $options: 'i' } },
          ];
        }
        const [propDocs, tenDocs] = await Promise.all([
          PropertyDocument.find(q).populate('propertyId', 'name').limit(30).lean(),
          TenantDocument.find(q).populate('tenantId', 'fullName').limit(30).lean(),
        ]);
        return metaEnvelope(
          scope.mode === 'ALL' ? 'ALL AUTHORIZED' : scope.companies[0]?.name,
          'Current',
          propDocs.length + tenDocs.length,
          { propertyDocuments: propDocs, tenantDocuments: tenDocs }
        );
      }

      case 'get_document_details':
      case 'get_authorized_document_content': {
        const { companyId, company } = assertCompanyAuthorized(user, args.companyId);
        const { maxDocumentChars } = getUsageLimitsConfig();
        const doc =
          (await PropertyDocument.findOne({ _id: args.documentId, companyId }).lean()) ||
          (await TenantDocument.findOne({ _id: args.documentId, companyId }).lean());
        if (!doc) return metaEnvelope(company.name, 'N/A', 0, { error: 'Document not found.' });
        const safeNotes = String(doc.notes || '').slice(0, maxDocumentChars);
        return metaEnvelope(company.name, 'N/A', 1, {
          document: { ...doc, notes: safeNotes },
        });
      }

      case 'generate_monthly_report':
      case 'generate_company_report': {
        const scope = resolveScope(args.companyId);
        const period = parsePeriodRange({ month: args.month });
        const query = { companyId: { $in: scope.companyIds }, isDeleted: false };
        if (period.start && period.end) query.transactionDate = { $gte: period.start, $lte: period.end };
        const txs = await Transaction.find(query).select('companyId transactionType amount').lean();
        const incPence = txs.filter((t) => t.transactionType === 'INCOME').reduce((s, t) => s + toPence(t.amount), 0);
        const expPence = txs
          .filter((t) => ['EXPENSE', 'MORTGAGE_PAYMENT'].includes(t.transactionType))
          .reduce((s, t) => s + toPence(t.amount), 0);

        const preview = {
          title: `${scope.mode === 'ALL' ? 'Consolidated' : scope.companies[0]?.name} Financial Report`,
          period: period.label,
          currency: 'GBP',
          generatedAt: new Date().toISOString(),
          metrics: {
            actualIncomeGBP: fromPence(incPence),
            actualExpensesGBP: fromPence(expPence),
            netProfitGBP: fromPence(incPence - expPence),
            recordCount: txs.length,
          },
        };
        return {
          ...metaEnvelope(scope.mode === 'ALL' ? 'ALL AUTHORIZED' : scope.companies[0]?.name, period.label, txs.length, preview),
          __reportPreview: preview,
        };
      }

      case 'generate_property_report': {
        const { companyId, company } = assertCompanyAuthorized(user, args.companyId);
        const prop = await Property.findOne({ _id: args.propertyId, companyId }).lean();
        if (!prop) return metaEnvelope(company.name, 'N/A', 0, { error: 'Property not found.' });
        const txs = await Transaction.find({ companyId, propertyId: prop._id, isDeleted: false }).lean();
        const incPence = txs.filter((t) => t.transactionType === 'INCOME').reduce((s, t) => s + toPence(t.amount), 0);
        const expPence = txs
          .filter((t) => ['EXPENSE', 'MORTGAGE_PAYMENT'].includes(t.transactionType))
          .reduce((s, t) => s + toPence(t.amount), 0);
        const preview = {
          title: `Property Report: ${prop.name}`,
          period: 'All Time',
          currency: 'GBP',
          generatedAt: new Date().toISOString(),
          metrics: {
            actualIncomeGBP: fromPence(incPence),
            actualExpensesGBP: fromPence(expPence),
            netProfitGBP: fromPence(incPence - expPence),
            recordCount: txs.length,
          },
        };
        return {
          ...metaEnvelope(company.name, 'All Time', txs.length, preview),
          __reportPreview: preview,
        };
      }

      case 'generate_rent_arrears_report': {
        const scope = resolveScope(args.companyId);
        const arrears = await RentSchedule.find({
          companyId: { $in: scope.companyIds },
          status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
          outstandingAmount: { $gt: 0 },
        })
          .populate('tenantId', 'fullName email')
          .populate('propertyId', 'name')
          .lean();
        const totalPence = arrears.reduce((s, r) => s + toPence(r.outstandingAmount), 0);
        const preview = {
          title: 'Rent Arrears Report',
          period: args.month || 'Current',
          currency: 'GBP',
          generatedAt: new Date().toISOString(),
          metrics: {
            totalArrearsGBP: fromPence(totalPence),
            recordCount: arrears.length,
          },
        };
        return {
          ...metaEnvelope(scope.mode === 'ALL' ? 'ALL AUTHORIZED' : scope.companies[0]?.name, args.month || 'Current', arrears.length, {
            ...preview,
            arrears,
          }),
          __reportPreview: preview,
        };
      }

      case 'search_emails': {
        const cfg = (await EmailNotificationConfig.findOne({ companyId: 'GLOBAL' }).lean()) || {};
        const sentAlerts = cfg.sentAlertsHistory || [];
        const sentRent = cfg.rentDueSentHistory || [];
        const aiSent = await AIAuditLog.find({
          userId: user._id,
          actionType: { $in: ['SEND_APPROVED_EMAIL', 'CREATE_EMAIL_DRAFT'] },
        })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean();

        const q = (args.query || '').toLowerCase();
        const rec = (args.recipient || '').toLowerCase();
        const filterFn = (item) => {
          const hay = JSON.stringify(item).toLowerCase();
          return (!q || hay.includes(q)) && (!rec || hay.includes(rec));
        };

        const matches = {
          rentDueEmails: sentRent.filter(filterFn).slice(0, 20),
          expiryAlertEmails: sentAlerts.filter(filterFn).slice(0, 20),
          aiCorrespondence: aiSent.filter(filterFn).slice(0, 20),
        };
        const count =
          matches.rentDueEmails.length +
          matches.expiryAlertEmails.length +
          matches.aiCorrespondence.length;
        return metaEnvelope('SYSTEM EMAIL LOGS', 'Recent', count, {
          note: 'Inbound mailbox IMAP is not configured; showing authorized outbound & correspondence logs.',
          ...matches,
        });
      }

      case 'prepare_email_draft': {
        const preview = {
          to: args.to,
          subject: args.subject,
          body: args.body,
          replyTo: args.replyTo || 'ftaccountants@hotmail.com',
          status: 'DRAFT_PREVIEW',
        };
        return {
          ...metaEnvelope('EMAIL DRAFT', 'N/A', 1, preview),
          __emailPreview: preview,
        };
      }

      case 'request_send_email_approval': {
        const approval = await createApprovalRequest({
          user,
          companyId: args.companyId,
          conversationId,
          actionType: 'SEND_APPROVED_EMAIL',
          title: `Send Email to ${args.to}`,
          summary: `Subject: ${args.subject}`,
          payload: {
            to: args.to,
            subject: args.subject,
            body: args.body,
            replyTo: args.replyTo || 'ftaccountants@hotmail.com',
          },
          previewData: {
            to: args.to,
            subject: args.subject,
            body: args.body,
            replyTo: args.replyTo || 'ftaccountants@hotmail.com',
          },
        });
        return {
          approvalCreated: true,
          approvalId: approval._id,
          status: 'PENDING_APPROVAL',
          __emailPreview: approval.previewData,
          __approvalRequest: approval,
        };
      }

      case 'request_write_approval': {
        let parsedPayload = {};
        try {
          parsedPayload = JSON.parse(args.payloadJson || '{}');
        } catch {
          throw new Error('Invalid JSON payload for write approval.');
        }
        const approval = await createApprovalRequest({
          user,
          companyId: args.companyId,
          conversationId,
          actionType: args.actionType,
          title: args.title,
          summary: args.summary || args.title,
          payload: parsedPayload,
          previewData: parsedPayload,
        });
        return {
          approvalCreated: true,
          approvalId: approval._id,
          status: 'PENDING_APPROVAL',
          __approvalRequest: approval,
        };
      }

      default:
        throw new Error(`Unknown AI tool: ${toolName}`);
    }
  };
};

export default {
  toolDeclarations,
  createToolExecutor,
};
