import mongoose from 'mongoose';
import Mortgage from '../models/Mortgage.js';
import MortgagePayment from '../models/MortgagePayment.js';
import Category from '../models/Category.js';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import Voucher from '../models/Voucher.js';
import { generateVoucherNo, round2 } from './ledgerService.js';

/**
 * Ensure default Mortgage Interest nominal category exists
 */
export const getOrCreateMortgageInterestCategory = async (companyId) => {
  const query = { type: 'FINANCE_COST', name: /mortgage interest/i };
  if (companyId) query.companyId = companyId;

  let cat = await Category.findOne(query);
  if (!cat) {
    cat = await Category.create({
      companyId,
      name: 'Finance Costs / Mortgage Interest',
      code: 'FC-MTG-INT',
      type: 'FINANCE_COST',
      isAllowableTaxDeduction: false, // In UK, individual landlords receive 20% basic rate tax reducer under Section 24
      defaultScope: 'PROPERTY',
      description: 'Interest charged on property mortgage borrowings.',
    });
  }
  return cat;
};

/**
 * Ensure default Mortgage Fee nominal category exists
 */
export const getOrCreateMortgageFeeCategory = async (companyId) => {
  const query = { type: 'OPERATING_EXPENSE', name: /mortgage arrangement|lender fee/i };
  if (companyId) query.companyId = companyId;

  let cat = await Category.findOne(query);
  if (!cat) {
    cat = await Category.create({
      companyId,
      name: 'Mortgage Fees & Lender Charges',
      code: 'FC-MTG-FEE',
      type: 'OPERATING_EXPENSE',
      isAllowableTaxDeduction: true,
      defaultScope: 'PROPERTY',
      description: 'Valuation, arrangement and management fees charged by lenders.',
    });
  }
  return cat;
};

/**
 * Record an actual mortgage payment:
 * - Single bank debit outflow for totalAmountPaid
 * - Interest portion categorized under FINANCE_COST
 * - Principal portion reduces Mortgage.outstandingPrincipalBalance
 * - Fees portion categorized under OPERATING_EXPENSE
 */
export const recordMortgagePayment = async (data, userId = null, companyId = null) => {
  const effectiveCompanyId = companyId || data.companyId;
  if (!effectiveCompanyId) {
    throw new Error('Company context is required for recording mortgage payment.');
  }

  const {
    mortgageId,
    paymentDate = new Date(),
    totalAmountPaid,
    interestAmount = 0,
    principalAmount = 0,
    feeAmount = 0,
    paymentAccountId,
    paymentReference = '',
    isLenderConfirmed = false,
    notes = '',
    documents = [],
    receiptUrl = '',
    receiptFilename = '',
  } = data;

  const numTotal = round2(totalAmountPaid);
  const numInterest = round2(interestAmount);
  const numPrincipal = round2(principalAmount);
  const numFee = round2(feeAmount);

  // Split integrity check
  const calculatedSum = round2(numInterest + numPrincipal + numFee);
  if (Math.abs(calculatedSum - numTotal) > 0.05) {
    throw new Error(
      `Payment splits (£${calculatedSum}) do not match total amount paid (£${numTotal}). Check Interest, Principal, and Fees.`
    );
  }

  const mortgage = await Mortgage.findOne({ _id: mortgageId, companyId: effectiveCompanyId }).populate('propertyId');
  if (!mortgage) throw new Error(`Mortgage facility not found in active company: ${mortgageId}`);
  if (mortgage.status !== 'ACTIVE') throw new Error(`Mortgage account is not active (${mortgage.status}).`);

  // Prevent principal repayments that exceed the outstanding balance
  if (numPrincipal > mortgage.outstandingPrincipalBalance) {
    throw new Error(
      `Principal repayment (£${numPrincipal.toFixed(2)}) cannot exceed remaining mortgage principal (£${mortgage.outstandingPrincipalBalance.toFixed(2)}).`
    );
  }

  const account = await Account.findOne({ _id: paymentAccountId, companyId: effectiveCompanyId });
  if (!account) throw new Error(`Bank account not found in active company: ${paymentAccountId}`);
  if (!account.isActive) throw new Error(`Bank account "${account.name}" is inactive.`);

  if (account.accountType === 'CASH' && round2(account.currentBalance - numTotal) < 0) {
    throw new Error(
      `Insufficient cash in hand in "${account.name}". Available: £${account.currentBalance.toFixed(2)}, Required: £${numTotal.toFixed(2)}.`
    );
  }

  // Idempotency protection against rapid repeated clicks / duplicate submissions
  const recentDuplicate = await MortgagePayment.findOne({
    companyId: effectiveCompanyId,
    mortgageId: mortgage._id,
    totalAmountPaid: numTotal,
    createdAt: { $gte: new Date(Date.now() - 60000) },
  });
  if (recentDuplicate) {
    throw new Error(
      'Duplicate payment detected: An identical mortgage payment was posted within the last 60 seconds.'
    );
  }

  const interestCategory = await getOrCreateMortgageInterestCategory(effectiveCompanyId);
  const feeCategory = numFee > 0 ? await getOrCreateMortgageFeeCategory(effectiveCompanyId) : null;

  const voucherNo = await generateVoucherNo('MTG', effectiveCompanyId);

  const resolvedDocs = Array.isArray(documents) && documents.length > 0
    ? documents
    : receiptUrl
    ? [{ title: receiptFilename || 'Mortgage Receipt', url: receiptUrl, uploadedAt: new Date() }]
    : [];

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    // 1. Create central Voucher header
    const [voucher] = await Voucher.create(
      [
        {
          companyId: effectiveCompanyId,
          voucherNumber: voucherNo,
          voucherDate: paymentDate,
          voucherType: 'MORTGAGE_PAYMENT',
          description: `Mortgage payment to ${mortgage.lenderName} (${mortgage.accountReference}) - Split: Int £${numInterest}, Prin £${numPrincipal}${numFee ? `, Fees £${numFee}` : ''}`,
          totalAmount: numTotal,
          reference: paymentReference || mortgage.accountReference,
          receiptUrl: receiptUrl.trim(),
          receiptFilename: receiptFilename.trim(),
          documents: resolvedDocs,
          status: 'POSTED',
          createdBy: userId,
        },
      ],
      { session }
    );

    // 2. Post Master Journal Transaction (Cash Outflow)
    const [transaction] = await Transaction.create(
      [
        {
          companyId: effectiveCompanyId,
          transactionDate: paymentDate,
          voucherNo,
          voucherId: voucher._id,
          transactionType: 'MORTGAGE_PAYMENT',
          accountId: paymentAccountId,
          categoryId: interestCategory._id, // Nominal anchor
          amount: numTotal,
          direction: 'OUT',
          propertyId: mortgage.propertyId?._id || mortgage.propertyId,
          mortgageId: mortgage._id,
          periodMonth: `${new Date(paymentDate).getFullYear()}-${String(new Date(paymentDate).getMonth() + 1).padStart(2, '0')}`,
          narration: `Mortgage payment: ${mortgage.lenderName} (Ref: ${mortgage.accountReference}) - Total £${numTotal} [Interest: £${numInterest}, Principal: £${numPrincipal}${numFee ? `, Fees: £${numFee}` : ''}]`,
          reference: paymentReference,
          receiptUrl: receiptUrl.trim(),
          receiptFilename: receiptFilename.trim(),
          documents: resolvedDocs,
          status: 'POSTED',
          createdBy: userId,
        },
      ],
      { session }
    );

    // 3. Deduct total paid from Bank Account liquidity
    await Account.findOneAndUpdate(
      { _id: paymentAccountId, companyId: effectiveCompanyId },
      { $inc: { currentBalance: -numTotal } },
      { session }
    );

    // 4. Reduce Mortgage liability by the Principal repayment component
    if (numPrincipal > 0) {
      await Mortgage.findOneAndUpdate(
        { _id: mortgageId, companyId: effectiveCompanyId },
        {
          $inc: { outstandingPrincipalBalance: -numPrincipal },
        },
        { session }
      );
    }

    // 5. Create MortgagePayment record
    const [paymentRecord] = await MortgagePayment.create(
      [
        {
          companyId: effectiveCompanyId,
          mortgageId: mortgage._id,
          propertyId: mortgage.propertyId?._id || mortgage.propertyId,
          paymentDate,
          totalAmountPaid: numTotal,
          interestAmount: numInterest,
          principalAmount: numPrincipal,
          feeAmount: numFee,
          paymentAccountId,
          paymentReference,
          isLenderConfirmed,
          transactionId: transaction._id,
          receiptUrl: receiptUrl.trim(),
          receiptFilename: receiptFilename.trim(),
          documents: resolvedDocs,
          notes,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return {
      payment: paymentRecord,
      transaction,
      voucher,
      updatedPrincipal: round2(mortgage.outstandingPrincipalBalance - numPrincipal),
    };
  } catch (err) {
    if (session) await session.abortTransaction();
    throw err;
  } finally {
    if (session) session.endSession();
  }
};

/**
 * Reconcile mortgage with official annual lender statement
 */
export const reconcileMortgageBalance = async (mortgageId, confirmedBalance, statementDate, notes = '', companyId = null) => {
  if (!companyId) {
    throw new Error('Company context is strictly required for mortgage reconciliation.');
  }

  const mortgage = await Mortgage.findOne({ _id: mortgageId, companyId });
  if (!mortgage) throw new Error('Mortgage not found in active company');

  const oldBalance = mortgage.outstandingPrincipalBalance;
  const newBalance = round2(confirmedBalance);
  const delta = round2(newBalance - oldBalance);

  mortgage.outstandingPrincipalBalance = newBalance;
  mortgage.lastConfirmedBalance = newBalance;
  mortgage.lastConfirmedDate = new Date(statementDate);
  if (notes) {
    mortgage.notes = `${mortgage.notes ? mortgage.notes + '\n' : ''}[${new Date().toISOString().slice(0, 10)}] Statement reconciliation adjustment: £${delta >= 0 ? '+' : ''}${delta}. ${notes}`;
  }
  await mortgage.save();

  return {
    mortgageId: mortgage._id,
    previousBalance: oldBalance,
    confirmedBalance: newBalance,
    adjustmentDelta: delta,
    statementDate: mortgage.lastConfirmedDate,
  };
};
