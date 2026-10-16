import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { VALID_COMPANY_IDS } from '../config/companies.js';

export const AUTHORITATIVE_HEADS_HIERARCHY = [
  {
    name: 'Income',
    code: 'HEAD-INC',
    type: 'INCOME',
    isMainHead: true,
    isRentalHead: true,
    aliases: [],
    subHeads: [
      { name: 'Rent', isRentalHead: true },
      { name: 'Bank Fee Refund', isRentalHead: false },
      { name: 'Council Refund', isRentalHead: false },
      { name: 'Positive Energy', isRentalHead: false },
    ],
  },
  {
    name: 'Admin Expenses',
    code: 'HEAD-ADM',
    type: 'OPERATING_EXPENSE',
    isMainHead: true,
    aliases: ['Admin Expeses'],
    subHeads: [
      { name: 'Accountant Fee' },
      { name: 'Bank Charges' },
      { name: 'Business Support' },
      { name: 'Corporation Tax' },
      { name: 'Council Tax' },
      { name: 'E I GROUP LTD' },
      { name: 'Insurance' },
      { name: 'LBBD Rents' },
      { name: 'Legal Expenses' },
      { name: 'Postage' },
      { name: 'Properties Insurance' },
      { name: 'Rent Deposit Insurance' },
      { name: 'Rent Deposit Rent' },
      { name: 'Rent Depsit Refund' },
      { name: 'Repair and Maintainance' },
      { name: 'Storage Rent' },
      { name: 'Subscriptions' },
      { name: 'Utilities' },
    ],
  },
  {
    name: 'Interest Expenses',
    code: 'HEAD-INT',
    type: 'FINANCE_COST',
    isMainHead: true,
    aliases: [],
    subHeads: [
      { name: '62 Orsett Road' },
      { name: '10-12 Cromwell Road' },
      { name: '104 Pretoria Road' },
      { name: '12 & 12a Alaxandra' },
      { name: '124 Millard Terrace' },
      { name: '127 Southend Road,' },
      { name: '13/15 CLARENCE ROAD' },
      { name: '26 Clarence Road' },
      { name: '31 Morley Avenue' },
      { name: '7, Vansittart Street' },
      { name: '73 Lakewalk' },
      { name: '82 Como Street' },
    ],
  },
  {
    name: 'Loan',
    code: 'HEAD-LOAN',
    type: 'TRANSFER',
    isMainHead: true,
    aliases: [],
    subHeads: [
      { name: 'Camden Cycles Ltd' },
      { name: 'Capital on Tap' },
      { name: 'Director Loan' },
      { name: 'Elite Corporate Alliance Ltd' },
      { name: 'Funding Circle' },
      { name: 'Intra Company Loan' },
      { name: 'Old Street Holdings Savings' },
      { name: 'Remortgage' },
    ],
  },
  {
    name: 'Others',
    code: 'HEAD-OTH',
    type: 'TRANSFER',
    isMainHead: true,
    aliases: [],
    subHeads: [
      { name: 'Alsop' },
      { name: 'Cash Withdrawal' },
    ],
  },
  {
    name: 'Property Purchase',
    code: 'HEAD-PROP-PURCH',
    type: 'CAPITAL_EXPENDITURE',
    isMainHead: true,
    aliases: [],
    subHeads: [
      { name: 'Auction Deposit + Fee (15000 + 1550)' },
    ],
  },
];

/**
 * Normalizes category names for lookup (case-insensitive, trimmed, unified whitespace)
 */
export function normalizeCategoryName(str) {
  if (!str) return '';
  return String(str).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Idempotently seeds the 6 Head categories and all their Sub Heads for a specific companyId
 */
export async function seedHeadsAndSubHeadsForCompany(companyId) {
  const seeded = {
    headsCreated: 0,
    headsUpdated: 0,
    subHeadsCreated: 0,
    subHeadsUpdated: 0,
  };

  for (const headDef of AUTHORITATIVE_HEADS_HIERARCHY) {
    // Look up existing head by name or aliases (case-insensitive)
    const nameRegex = new RegExp(`^${headDef.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const aliasRegexes = (headDef.aliases || []).map(
      (a) => new RegExp(`^${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    );

    let headDoc = await Category.findOne({
      companyId,
      $or: [
        { name: nameRegex },
        ...(aliasRegexes.length > 0 ? [{ aliases: { $in: aliasRegexes } }] : []),
        ...(aliasRegexes.length > 0 ? [{ name: { $in: aliasRegexes } }] : []),
      ],
      parentCategoryId: null,
    });

    if (!headDoc) {
      headDoc = await Category.create({
        companyId,
        name: headDef.name,
        code: headDef.code,
        type: headDef.type,
        isMainHead: true,
        isRentalHead: Boolean(headDef.isRentalHead),
        parentCategoryId: null,
        aliases: headDef.aliases || [],
        isActive: true,
      });
      seeded.headsCreated += 1;
    } else {
      let needsSave = false;
      if (!headDoc.isMainHead) {
        headDoc.isMainHead = true;
        needsSave = true;
      }
      if (headDoc.name !== headDef.name && headDef.aliases.some(a => a.toLowerCase() === headDoc.name.toLowerCase())) {
        // If current name is an alias (e.g. 'Admin Expeses'), rename to canonical 'Admin Expenses' and preserve alias
        if (!headDoc.aliases.includes(headDoc.name)) {
          headDoc.aliases.push(headDoc.name);
        }
        headDoc.name = headDef.name;
        needsSave = true;
      }
      for (const a of headDef.aliases || []) {
        if (!headDoc.aliases.includes(a)) {
          headDoc.aliases.push(a);
          needsSave = true;
        }
      }
      if (needsSave) {
        await headDoc.save();
        seeded.headsUpdated += 1;
      }
    }

    // Now seed/link Sub Heads
    for (const subDef of headDef.subHeads) {
      const subNameRegex = new RegExp(`^${subDef.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

      let subDoc = await Category.findOne({
        companyId,
        name: subNameRegex,
        parentCategoryId: headDoc._id,
      });

      if (!subDoc) {
        // Also check if category existed previously without parentCategoryId
        const unlinkedDoc = await Category.findOne({
          companyId,
          name: subNameRegex,
          parentCategoryId: null,
          isMainHead: false,
        });

        if (unlinkedDoc) {
          unlinkedDoc.parentCategoryId = headDoc._id;
          unlinkedDoc.isMainHead = false;
          unlinkedDoc.type = headDef.type;
          if (subDef.isRentalHead !== undefined) unlinkedDoc.isRentalHead = subDef.isRentalHead;
          await unlinkedDoc.save();
          seeded.subHeadsUpdated += 1;
        } else {
          await Category.create({
            companyId,
            name: subDef.name,
            type: headDef.type,
            isMainHead: false,
            parentCategoryId: headDoc._id,
            isRentalHead: Boolean(subDef.isRentalHead),
            isActive: true,
          });
          seeded.subHeadsCreated += 1;
        }
      } else {
        let subNeedsSave = false;
        if (subDoc.type !== headDef.type) {
          subDoc.type = headDef.type;
          subNeedsSave = true;
        }
        if (subDoc.isMainHead) {
          subDoc.isMainHead = false;
          subNeedsSave = true;
        }
        if (subNeedsSave) {
          await subDoc.save();
          seeded.subHeadsUpdated += 1;
        }
      }
    }
  }

  return seeded;
}

/**
 * Seeds all valid companies
 */
export async function seedAllCompaniesHeadsAndSubHeads() {
  const results = {};
  for (const companyId of VALID_COMPANY_IDS) {
    results[companyId] = await seedHeadsAndSubHeadsForCompany(companyId);
  }
  return results;
}

// Allow direct execution via node
if (process.argv[1] && process.argv[1].endsWith('seedHeadsAndSubHeads.js')) {
  (async () => {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/uk-expense-tracker';
      await mongoose.connect(mongoUri);
      console.log('Connected to MongoDB for Head & Sub Head seeding...');
      const results = await seedAllCompaniesHeadsAndSubHeads();
      console.log('Seeding results:', JSON.stringify(results, null, 2));
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error('Seeding failed:', err);
      process.exit(1);
    }
  })();
}
