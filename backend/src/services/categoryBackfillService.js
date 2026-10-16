import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import RentPayment from '../models/RentPayment.js';
import MortgagePayment from '../models/MortgagePayment.js';
import Mortgage from '../models/Mortgage.js';
import Property from '../models/Property.js';
import { seedHeadsAndSubHeadsForCompany } from '../scripts/seedHeadsAndSubHeads.js';

/**
 * Heuristic rules for mapping expense narration to Sub Heads
 */
const EXPENSE_RULES = [
  { subHead: 'Accountant Fee', pattern: /accountan|audit fee|bookkeep/i },
  { subHead: 'Bank Charges', pattern: /bank charge|commission for period|service fee|bank fee/i },
  { subHead: 'Business Support', pattern: /business support/i },
  { subHead: 'Corporation Tax', pattern: /corporation tax|hmrc corp/i },
  { subHead: 'Council Tax', pattern: /council tax|borough council|city council/i },
  { subHead: 'E I GROUP LTD', pattern: /e i group|ei group/i },
  { subHead: 'Rent Deposit Insurance', pattern: /rent deposit insurance|mydeposits|deposit protection/i },
  { subHead: 'Rent Depsit Refund', pattern: /rent dep.*refund|deposit refund/i },
  { subHead: 'Rent Deposit Rent', pattern: /rent deposit rent/i },
  { subHead: 'LBBD Rents', pattern: /lbbd rent/i },
  { subHead: 'Properties Insurance', pattern: /properties insurance/i },
  { subHead: 'Insurance', pattern: /insurance|aviva|axa|allianz|direct line|zurich/i },
  { subHead: 'Legal Expenses', pattern: /legal|solicitor|court|conveyancing|eviction/i },
  { subHead: 'Postage', pattern: /postage|royal mail|courier|dpd|hermes/i },
  { subHead: 'Storage Rent', pattern: /storage rent|safestore|big yellow/i },
  { subHead: 'Subscriptions', pattern: /subscription|software|ico registration|portal fee/i },
  { subHead: 'Utilities', pattern: /utilit|electric|gas|water|thames water|british gas|edf|e\.on|octopus/i },
  { subHead: 'Repair and Maintainance', pattern: /repair|maintain|maintenance|handyman|plumb|paint|electrician|locksmith|contractor|boil/i },
];

const LOAN_RULES = [
  { subHead: 'Camden Cycles Ltd', pattern: /camden cycles/i },
  { subHead: 'Capital on Tap', pattern: /capital on tap/i },
  { subHead: 'Director Loan', pattern: /director loan|dlr ft|director/i },
  { subHead: 'Elite Corporate Alliance Ltd', pattern: /elite corporate/i },
  { subHead: 'Funding Circle', pattern: /funding circle/i },
  { subHead: 'Intra Company Loan', pattern: /intra company|intra-company|company loan/i },
  { subHead: 'Old Street Holdings Savings', pattern: /old street.*savings/i },
  { subHead: 'Remortgage', pattern: /remortgage/i },
];

const OTHERS_RULES = [
  { subHead: 'Cash Withdrawal', pattern: /cash withdrawal|atm|cash out/i },
  { subHead: 'Alsop', pattern: /alsop/i },
];

const INCOME_RULES = [
  { subHead: 'Bank Fee Refund', pattern: /bank fee refund|charge refund|refund bank/i },
  { subHead: 'Council Refund', pattern: /council refund|rates refund/i },
  { subHead: 'Positive Energy', pattern: /positive energy/i },
  { subHead: 'Rent', pattern: /rent|tenant|letting|lease|bgc/i },
];

/**
 * Prepares category map for fast in-memory lookup
 */
async function loadCategoryMaps(companyId) {
  // Ensure heads are seeded
  await seedHeadsAndSubHeadsForCompany(companyId);

  const categories = await Category.find({ companyId }).lean();
  const headByName = new Map();
  const subByNameAndHead = new Map(); // key: `${headId}_${normalizedSubName}`
  const catById = new Map();

  for (const cat of categories) {
    catById.set(cat._id.toString(), cat);
    if (cat.isMainHead || !cat.parentCategoryId) {
      headByName.set(cat.name.toLowerCase().trim(), cat);
      for (const a of cat.aliases || []) {
        headByName.set(a.toLowerCase().trim(), cat);
      }
    }
  }

  for (const cat of categories) {
    if (cat.parentCategoryId) {
      const pId = cat.parentCategoryId.toString();
      const key = `${pId}_${cat.name.toLowerCase().trim()}`;
      subByNameAndHead.set(key, cat);
    }
  }

  return { categories, headByName, subByNameAndHead, catById };
}

/**
 * Generates preview of backfill operations for unlinked or partially linked transactions
 */
export async function previewBackfill(companyIdOrOptions) {
  const companyId =
    typeof companyIdOrOptions === 'object' && companyIdOrOptions !== null
      ? companyIdOrOptions.companyId
      : companyIdOrOptions;

  const limit =
    typeof companyIdOrOptions === 'object' && companyIdOrOptions !== null && companyIdOrOptions.limit
      ? companyIdOrOptions.limit
      : null;

  const { headByName, subByNameAndHead, catById } = await loadCategoryMaps(companyId);

  const adminExpensesHead = headByName.get('admin expenses');
  const incomeHead = headByName.get('income');
  const interestExpensesHead = headByName.get('interest expenses');
  const loanHead = headByName.get('loan');
  const othersHead = headByName.get('others');
  const propertyPurchaseHead = headByName.get('property purchase');

  let query = Transaction.find({ companyId, isDeleted: { $ne: true } })
    .populate('propertyId', 'name addressLine1')
    .sort({ transactionDate: -1 });

  if (limit && Number(limit) > 0) {
    query = query.limit(Number(limit));
  }

  const transactions = await query.lean();

  const previewItems = [];
  let correctlyCategorizedCount = 0;
  let suggestedCount = 0;
  let unclassifiedCount = 0;
  let invalidCount = 0;

  for (const tx of transactions) {
    const hasHead = Boolean(tx.headId);
    const hasSubHead = Boolean(tx.subHeadId);

    // If both headId and subHeadId are set, check validity
    if (hasHead && hasSubHead) {
      const subCat = catById.get(tx.subHeadId.toString());
      if (subCat && subCat.parentCategoryId && subCat.parentCategoryId.toString() !== tx.headId.toString()) {
        const expectedHead = catById.get(subCat.parentCategoryId.toString());
        invalidCount++;
        previewItems.push({
          transactionId: tx._id,
          voucherNo: tx.voucherNo,
          transactionDate: tx.transactionDate,
          narration: tx.narration,
          amount: tx.amount,
          transactionType: tx.transactionType,
          currentHeadId: tx.headId,
          currentHeadName: tx.head || 'Unknown Head',
          currentSubHeadId: tx.subHeadId,
          currentSubHeadName: tx.subHead || 'Unknown Sub Head',
          suggestedHeadId: subCat.parentCategoryId,
          suggestedHeadName: expectedHead ? expectedHead.name : '',
          suggestedSubHeadId: subCat._id,
          suggestedSubHeadName: subCat.name,
          status: 'INVALID_RELATIONSHIP',
          confidence: 95,
          ruleMatched: `Sub Head belongs to "${expectedHead?.name}" rather than "${tx.head}". Fix relationship.`,
        });
      } else {
        correctlyCategorizedCount++;
      }
      continue;
    }

    // Needs backfill suggestion
    let suggestedHead = null;
    let suggestedSubHead = null;
    let confidence = 0;
    let ruleMatched = '';

    const text = `${tx.narration || ''} ${tx.reference || ''}`.trim();

    // 1. Check legacy categoryId
    if (tx.categoryId) {
      const existingCat = catById.get(tx.categoryId.toString());
      if (existingCat) {
        if (existingCat.parentCategoryId) {
          suggestedSubHead = existingCat;
          suggestedHead = catById.get(existingCat.parentCategoryId.toString());
          confidence = 90;
          ruleMatched = `Resolved from existing Sub Head category "${existingCat.name}"`;
        } else if (existingCat.isMainHead) {
          suggestedHead = existingCat;
          confidence = 70;
          ruleMatched = `Resolved from existing Head category "${existingCat.name}"`;
        } else {
          // Check if name matches any subhead under our heads
          const normName = existingCat.name.toLowerCase().trim();
          for (const [key, subDoc] of subByNameAndHead.entries()) {
            if (key.endsWith(`_${normName}`)) {
              suggestedSubHead = subDoc;
              suggestedHead = catById.get(subDoc.parentCategoryId.toString());
              confidence = 85;
              ruleMatched = `Matched legacy category name "${existingCat.name}" to Sub Head`;
              break;
            }
          }
        }
      }
    }

    // 2. Rent transactions or Income
    if (!suggestedHead && tx.transactionType === 'INCOME') {
      suggestedHead = incomeHead;
      for (const rule of INCOME_RULES) {
        if (rule.pattern.test(text)) {
          if (incomeHead) {
            const sub = subByNameAndHead.get(`${incomeHead._id.toString()}_${rule.subHead.toLowerCase()}`);
            if (sub) {
              suggestedSubHead = sub;
              confidence = 90;
              ruleMatched = `Income matched pattern for "${rule.subHead}"`;
              break;
            }
          }
        }
      }
      if (!suggestedSubHead && incomeHead) {
        const rentSub = subByNameAndHead.get(`${incomeHead._id.toString()}_rent`);
        suggestedSubHead = rentSub || null;
        confidence = 75;
        ruleMatched = 'Defaulted to Rental Income for incoming receipt';
      }
    }

    // 3. Mortgage payments
    if (!suggestedHead && (tx.transactionType === 'MORTGAGE_PAYMENT' || tx.mortgageId)) {
      suggestedHead = interestExpensesHead;
      // Try to match property name under Interest Expenses
      if (tx.propertyId && interestExpensesHead) {
        const propName = (tx.propertyId.name || tx.propertyId.addressLine1 || '').toLowerCase();
        for (const [key, subDoc] of subByNameAndHead.entries()) {
          if (key.startsWith(`${interestExpensesHead._id.toString()}_`)) {
            const subName = subDoc.name.toLowerCase();
            if (propName.includes(subName) || subName.includes(propName.slice(0, 10))) {
              suggestedSubHead = subDoc;
              confidence = 90;
              ruleMatched = `Matched property debt servicing: "${subDoc.name}"`;
              break;
            }
          }
        }
      }
      if (!suggestedSubHead && interestExpensesHead) {
        confidence = 70;
        ruleMatched = 'Mortgage finance servicing outflow';
      }
    }

    // 4. Transfers (Loan / Others)
    if (!suggestedHead && tx.transactionType === 'TRANSFER') {
      for (const rule of LOAN_RULES) {
        if (rule.pattern.test(text)) {
          suggestedHead = loanHead;
          if (loanHead) {
            const sub = subByNameAndHead.get(`${loanHead._id.toString()}_${rule.subHead.toLowerCase()}`);
            if (sub) suggestedSubHead = sub;
          }
          confidence = 85;
          ruleMatched = `Transfer loan matched "${rule.subHead}"`;
          break;
        }
      }
      if (!suggestedHead) {
        for (const rule of OTHERS_RULES) {
          if (rule.pattern.test(text)) {
            suggestedHead = othersHead;
            if (othersHead) {
              const sub = subByNameAndHead.get(`${othersHead._id.toString()}_${rule.subHead.toLowerCase()}`);
              if (sub) suggestedSubHead = sub;
            }
            confidence = 85;
            ruleMatched = `Transfer matched "${rule.subHead}"`;
            break;
          }
        }
      }
      if (!suggestedHead) {
        suggestedHead = loanHead;
        if (loanHead) {
          const intraLoan = subByNameAndHead.get(`${loanHead._id.toString()}_intra company loan`);
          suggestedSubHead = intraLoan || null;
        }
        confidence = 65;
        ruleMatched = 'Internal liquidity transfer defaulted to Intra Company Loan';
      }
    }

    // 5. General Expenses
    if (!suggestedHead && tx.transactionType === 'EXPENSE') {
      suggestedHead = adminExpensesHead;
      for (const rule of EXPENSE_RULES) {
        if (rule.pattern.test(text)) {
          if (adminExpensesHead) {
            const sub = subByNameAndHead.get(`${adminExpensesHead._id.toString()}_${rule.subHead.toLowerCase()}`);
            if (sub) {
              suggestedSubHead = sub;
              confidence = 85;
              ruleMatched = `Expense matched rule for "${rule.subHead}"`;
              break;
            }
          }
        }
      }
      if (!suggestedSubHead && adminExpensesHead) {
        confidence = 50;
        ruleMatched = 'General admin expense; specific subhead undetermined';
      }
    }

    if (suggestedHead || suggestedSubHead) {
      suggestedCount++;
      previewItems.push({
        transactionId: tx._id,
        voucherNo: tx.voucherNo,
        transactionDate: tx.transactionDate,
        narration: tx.narration,
        amount: tx.amount,
        transactionType: tx.transactionType,
        currentHeadId: tx.headId || null,
        currentHeadName: tx.head || '',
        currentSubHeadId: tx.subHeadId || null,
        currentSubHeadName: tx.subHead || '',
        suggestedHeadId: suggestedHead ? suggestedHead._id : null,
        suggestedHeadName: suggestedHead ? suggestedHead.name : '',
        suggestedHead: suggestedHead ? suggestedHead.name : '',
        suggestedSubHeadId: suggestedSubHead ? suggestedSubHead._id : null,
        suggestedSubHeadName: suggestedSubHead ? suggestedSubHead.name : '',
        suggestedSubHead: suggestedSubHead ? suggestedSubHead.name : '',
        status: 'SUGGESTED',
        confidence,
        ruleMatched,
      });
    } else {
      unclassifiedCount++;
      previewItems.push({
        transactionId: tx._id,
        voucherNo: tx.voucherNo,
        transactionDate: tx.transactionDate,
        narration: tx.narration,
        amount: tx.amount,
        transactionType: tx.transactionType,
        currentHeadId: null,
        currentHeadName: '',
        currentSubHeadId: null,
        currentSubHeadName: '',
        suggestedHeadId: null,
        suggestedHeadName: '',
        suggestedSubHeadId: null,
        suggestedSubHeadName: '',
        status: 'UNCLASSIFIED',
        confidence: 0,
        ruleMatched: 'No heuristic rule or existing category match found.',
      });
    }
  }

  return {
    totalTransactions: transactions.length,
    correctlyCategorizedCount,
    suggestedCount,
    unclassifiedCount,
    invalidCount,
    previewItems,
    rows: previewItems,
  };
}

/**
 * Applies backfill updates to transactions
 */
export async function applyBackfill(companyIdOrOptions, itemOverrides = []) {
  let companyId = companyIdOrOptions;
  let itemsToApply = [];

  if (typeof companyIdOrOptions === 'object' && companyIdOrOptions !== null) {
    companyId = companyIdOrOptions.companyId;
    if (Array.isArray(companyIdOrOptions.updates)) {
      itemsToApply = companyIdOrOptions.updates;
    } else if (Array.isArray(companyIdOrOptions.items)) {
      itemsToApply = companyIdOrOptions.items;
    } else if (Array.isArray(companyIdOrOptions.itemOverrides)) {
      itemsToApply = companyIdOrOptions.itemOverrides;
    }
  } else if (Array.isArray(itemOverrides) && itemOverrides.length > 0) {
    itemsToApply = itemOverrides;
  }

  const { catById } = await loadCategoryMaps(companyId);

  if (itemsToApply.length === 0) {
    const preview = await previewBackfill(companyId);
    itemsToApply = preview.previewItems.filter(
      (item) => item.status === 'SUGGESTED' || item.status === 'INVALID_RELATIONSHIP'
    );
  }

  let updatedCount = 0;
  const errors = [];

  for (const item of itemsToApply) {
    try {
      const headId = item.suggestedHeadId || item.headId;
      const subHeadId = item.suggestedSubHeadId || item.subHeadId;

      if (!headId && !subHeadId) continue;

      const updateFields = {};

      if (headId && mongoose.Types.ObjectId.isValid(headId)) {
        const headDoc = catById.get(headId.toString()) || (await Category.findById(headId));
        if (headDoc) {
          updateFields.headId = headDoc._id;
          updateFields.head = headDoc.name;
        }
      }

      if (subHeadId && mongoose.Types.ObjectId.isValid(subHeadId)) {
        const subDoc = catById.get(subHeadId.toString()) || (await Category.findById(subHeadId));
        if (subDoc) {
          updateFields.subHeadId = subDoc._id;
          updateFields.subHead = subDoc.name;
          updateFields.categoryId = subDoc._id; // Sync nominal anchor
          if (!updateFields.headId && subDoc.parentCategoryId) {
            const parent = catById.get(subDoc.parentCategoryId.toString()) || (await Category.findById(subDoc.parentCategoryId));
            if (parent) {
              updateFields.headId = parent._id;
              updateFields.head = parent.name;
            }
          }
        }
      }

      await Transaction.updateOne(
        { _id: item.transactionId, companyId },
        { $set: updateFields }
      );

      updatedCount++;
    } catch (err) {
      errors.push({ transactionId: item.transactionId, error: err.message });
    }
  }

  return {
    success: true,
    totalAttempted: itemsToApply.length,
    updated: updatedCount,
    updatedCount,
    errors,
  };
}
