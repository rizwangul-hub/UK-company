import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import Voucher from '../models/Voucher.js';
import AuditLog from '../models/AuditLog.js';
import RentPayment from '../models/RentPayment.js';
import RentSchedule from '../models/RentSchedule.js';
import Mortgage from '../models/Mortgage.js';
import MortgagePayment from '../models/MortgagePayment.js';
import PropertyDemand from '../models/PropertyDemand.js';
import PropertyChargePayment from '../models/PropertyChargePayment.js';
import Category from '../models/Category.js';
import Unit from '../models/Unit.js';
import { resolveAndValidateCategoryHierarchy } from './categoryService.js';

export const round2 = (num) => Math.round((Number(num) + Number.EPSILON) * 100) / 100;

/**
 * Generate sequential, unique voucher number based on highest recorded sequence
 */
export const generateVoucherNo = async (type = 'EXP', companyId = null) => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `UK-${type}-${yearMonth}`;

  const voucherQuery = { voucherNumber: new RegExp(`^${prefix}-\\d+`) };
  const txQuery = { voucherNo: new RegExp(`^${prefix}-\\d+`) };
  if (companyId) {
    voucherQuery.companyId = companyId;
    txQuery.companyId = companyId;
  }

  const [latestVoucher, latestTx] = await Promise.all([
    Voucher.findOne(voucherQuery)
      .sort({ voucherNumber: -1 })
      .lean(),
    Transaction.findOne(txQuery)
      .sort({ voucherNo: -1 })
      .lean(),
  ]);

  let nextSequence = 1;
  if (latestVoucher?.voucherNumber) {
    const parts = latestVoucher.voucherNumber.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) nextSequence = Math.max(nextSequence, lastNum + 1);
  }
  if (latestTx?.voucherNo) {
    const parts = latestTx.voucherNo.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) nextSequence = Math.max(nextSequence, lastNum + 1);
  }

  return `${prefix}-${String(nextSequence).padStart(4, '0')}`;
};

/**
 * Record audit log entry in AuditLog collection
 */
export const recordAuditLog = async ({
  companyId,
  entityType = 'TRANSACTION',
  entityId,
  voucherNo = '',
  action,
  performedBy = null,
  performedByName = 'System Operator',
  reason = '',
  changes = {},
  snapshot = null,
  session = null,
}) => {
  try {
    const docData = {
      companyId,
      entityType,
      entityId,
      voucherNo,
      action,
      performedBy,
      performedByName,
      reason,
      changes,
      snapshot,
    };
    if (session) {
      await AuditLog.create([docData], { session });
    } else {
      await AuditLog.create(docData);
    }
  } catch (err) {
    console.error('AuditLog writing notice:', err.message);
  }
};

/**
 * Post an atomic ledger entry and adjust bank/cash account balances
 */
export const postLedgerTransaction = async (data, externalSession = null) => {
  const {
    companyId,
    transactionDate = new Date(),
    voucherNo: customVoucherNo,
    transactionType,
    accountId,
    counterAccountId = null,
    categoryId = null,
    headId = null,
    subHeadId = null,
    head = '',
    subHead = '',
    amount,
    direction = 'OUT',
    propertyId = null,
    unitId = null,
    mortgageId = null,
    periodMonth = null,
    narration,
    reference = '',
    userId = null,
    userName = 'System Operator',
    receiptUrl = '',
    receiptFilename = '',
    documents = [],
  } = data;

  if (!companyId) {
    throw new Error('Company context is required for ledger transaction.');
  }

  // Validate and resolve parent-child Head & Sub Head hierarchy
  const resolvedCategory = await resolveAndValidateCategoryHierarchy({
    companyId,
    headId,
    subHeadId,
    head,
    subHead,
    categoryId,
  });

  const numericAmount = round2(amount);
  if (numericAmount <= 0) {
    throw new Error('Transaction amount must be strictly greater than zero.');
  }

  const vType =
    transactionType === 'INCOME'
      ? 'RENT_RECEIPT'
      : transactionType === 'TRANSFER'
      ? 'TRANSFER'
      : transactionType === 'MORTGAGE_PAYMENT'
      ? 'MORTGAGE_PAYMENT'
      : 'EXPENSE';

  const typeCode =
    transactionType === 'INCOME'
      ? 'RNT'
      : transactionType === 'TRANSFER'
      ? 'TRF'
      : transactionType === 'MORTGAGE_PAYMENT'
      ? 'MTG'
      : 'EXP';

  const voucherNo = customVoucherNo || (await generateVoucherNo(typeCode, companyId));

  const resolvedDocs = Array.isArray(documents) && documents.length > 0
    ? documents
    : receiptUrl
    ? [{ title: receiptFilename || 'Receipt', url: receiptUrl, docType: 'RECEIPT', uploadedAt: new Date() }]
    : [];

  const runOperation = async (session) => {
    // 1. Verify primary account exists in company and is active
    const account = await Account.findOne({ _id: accountId, companyId }).session(session || null);
    if (!account) throw new Error(`Account not found in active company: ${accountId}`);
    if (!account.isActive) throw new Error(`Account "${account.name}" is inactive.`);

    // Enforce cash non-negative balance rule
    if (direction === 'OUT' && account.accountType === 'CASH') {
      const remaining = round2(account.currentBalance - numericAmount);
      if (remaining < 0) {
        throw new Error(
          `Insufficient cash in hand in "${account.name}". Available: £${account.currentBalance.toFixed(2)}, Requested: £${numericAmount.toFixed(2)}`
        );
      }
    }

    // 2. If transfer, verify counter account in same company
    let counterAccount = null;
    if (transactionType === 'TRANSFER') {
      if (!counterAccountId) throw new Error('Destination account required for transfer.');
      if (accountId.toString() === counterAccountId.toString()) {
        throw new Error('Source and destination accounts cannot be identical.');
      }
      counterAccount = await Account.findOne({ _id: counterAccountId, companyId }).session(session || null);
      if (!counterAccount) throw new Error(`Destination account not found in active company: ${counterAccountId}`);
      if (!counterAccount.isActive) throw new Error(`Destination account "${counterAccount.name}" is inactive.`);
    }

    // 3. Create Voucher Header
    const [voucher] = await Voucher.create(
      [
        {
          companyId,
          voucherNumber: voucherNo,
          voucherDate: transactionDate,
          voucherType: vType,
          description: narration,
          totalAmount: numericAmount,
          reference,
          receiptUrl,
          receiptFilename,
          documents: resolvedDocs,
          status: 'POSTED',
          createdBy: userId,
        },
      ],
      session ? { session } : {}
    );

    // Initial audit log entry embedded on transaction
    const initialAudit = {
      action: 'CREATED',
      performedBy: userId,
      performedByName: userName,
      performedAt: new Date(),
      reason: 'Initial financial posting',
      changes: {
        amount: numericAmount,
        direction,
        transactionType,
        accountId,
        counterAccountId,
      },
    };

    // 4. Create Ledger Transaction
    const [transaction] = await Transaction.create(
      [
        {
          companyId,
          transactionDate,
          voucherNo,
          voucherId: voucher._id,
          transactionType,
          accountId,
          counterAccountId,
          categoryId: resolvedCategory.categoryId,
          headId: resolvedCategory.headId,
          subHeadId: resolvedCategory.subHeadId,
          head: resolvedCategory.head,
          subHead: resolvedCategory.subHead,
          amount: numericAmount,
          direction,
          propertyId,
          unitId,
          mortgageId,
          periodMonth,
          narration,
          reference,
          receiptUrl,
          receiptFilename,
          documents: resolvedDocs,
          status: 'POSTED',
          isDeleted: false,
          auditHistory: [initialAudit],
          createdBy: userId,
        },
      ],
      session ? { session } : {}
    );

    // 5. Update Account Balances
    const balanceAdjustment = direction === 'IN' ? numericAmount : -numericAmount;
    await Account.findOneAndUpdate(
      { _id: accountId, companyId },
      { $inc: { currentBalance: balanceAdjustment } },
      session ? { session } : {}
    );

    if (transactionType === 'TRANSFER' && counterAccountId) {
      await Account.findOneAndUpdate(
        { _id: counterAccountId, companyId },
        { $inc: { currentBalance: numericAmount } },
        session ? { session } : {}
      );
    }

    // 6. Record in centralized AuditLog collection
    await recordAuditLog({
      companyId,
      entityType: 'TRANSACTION',
      entityId: transaction._id,
      voucherNo: transaction.voucherNo,
      action: 'CREATED',
      performedBy: userId,
      performedByName: userName,
      reason: 'Transaction posted',
      changes: initialAudit.changes,
      session,
    });

    return { transaction, voucher };
  };

  if (externalSession) {
    return await runOperation(externalSession);
  }

  // Use managed transaction session if supported; fallback gracefully if standalone
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await runOperation(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        // standalone cluster fallback
      }
    }
    // If sessions not supported on standalone dev mongo, fallback to non-session run
    if (err.message && err.message.includes('replica set member')) {
      return await runOperation(null);
    }
    throw err;
  } finally {
    if (session) session.endSession();
  }
};

/**
 * Re-calculate live balance for an account directly from opening balance and active transaction history
 */
export const recalculateAccountBalance = async (accountId, companyId = null) => {
  const accountQuery = { _id: accountId };
  if (companyId) accountQuery.companyId = companyId;

  const account = await Account.findOne(accountQuery);
  if (!account) return null;

  const targetCompanyId = companyId || account.companyId;
  const txQuery = {
    status: 'POSTED',
    isDeleted: { $ne: true },
    $or: [{ accountId }, { counterAccountId: accountId }],
  };
  if (targetCompanyId) {
    txQuery.companyId = targetCompanyId;
  }

  const transactions = await Transaction.find(txQuery).lean();

  let netMovement = 0;
  for (const tx of transactions) {
    const isPrimary = tx.accountId.toString() === accountId.toString();
    if (isPrimary) {
      netMovement += tx.direction === 'IN' ? tx.amount : -tx.amount;
    } else if (tx.counterAccountId?.toString() === accountId.toString()) {
      netMovement += tx.amount;
    }
  }

  const recalculated = round2((account.openingBalance || 0) + netMovement);
  account.currentBalance = recalculated;
  await account.save();
  return recalculated;
};

/**
 * Soft delete / void a financial transaction and securely reverse all affected balances
 */
export const deleteLedgerTransaction = async ({
  transactionId,
  companyId,
  userId = null,
  userName = 'System Operator',
  reason = '',
}) => {
  if (!transactionId || !companyId) {
    throw new Error('Transaction ID and Company Context are required for deletion.');
  }

  const transaction = await Transaction.findOne({ _id: transactionId, companyId });
  if (!transaction) {
    throw new Error('Transaction not found in active company.');
  }

  if (transaction.isDeleted || transaction.status === 'VOID') {
    throw new Error('Transaction has already been deleted / voided.');
  }

  const previousSnapshot = transaction.toObject();

  // 1. Reverse Account Liquidity
  const numericAmount = round2(transaction.amount);

  if (transaction.transactionType === 'TRANSFER') {
    // Revert source account (money was taken OUT, so put it back IN)
    await Account.findOneAndUpdate(
      { _id: transaction.accountId, companyId },
      { $inc: { currentBalance: numericAmount } }
    );
    // Revert destination account (money was put IN, so take it OUT)
    if (transaction.counterAccountId) {
      await Account.findOneAndUpdate(
        { _id: transaction.counterAccountId, companyId },
        { $inc: { currentBalance: -numericAmount } }
      );
    }
  } else if (transaction.direction === 'OUT') {
    // Expense, Mortgage, or Outflow: money was deducted, so refund it back
    await Account.findOneAndUpdate(
      { _id: transaction.accountId, companyId },
      { $inc: { currentBalance: numericAmount } }
    );
  } else if (transaction.direction === 'IN') {
    // Rent Receipt, Sundry Income: money was credited, so deduct it back
    await Account.findOneAndUpdate(
      { _id: transaction.accountId, companyId },
      { $inc: { currentBalance: -numericAmount } }
    );
  }

  // 2. Reverse Rent Payment & Rent Schedule arrears if applicable
  const linkedRentPayment = await RentPayment.findOne({
    companyId,
    $or: [{ transactionId: transaction._id }, { receiptRef: transaction.voucherNo }],
  });

  if (linkedRentPayment) {
    linkedRentPayment.status = 'VOID';
    linkedRentPayment.isDeleted = true;
    await linkedRentPayment.save();

    // Revert rent schedule paid amount
    const schedQuery = linkedRentPayment.scheduleId
      ? { _id: linkedRentPayment.scheduleId, companyId }
      : { propertyId: transaction.propertyId, billingMonth: transaction.periodMonth, companyId };

    const schedule = await RentSchedule.findOne(schedQuery);
    if (schedule) {
      schedule.paidAmount = round2(Math.max(0, (schedule.paidAmount || 0) - linkedRentPayment.amount));
      // saving triggers .pre('save') which recalculates outstandingAmount & status
      await schedule.save();
    }
  }

  // 3. Reverse Mortgage Payment & Principal Liability if applicable
  const linkedMortgagePayment = await MortgagePayment.findOne({
    companyId,
    $or: [{ transactionId: transaction._id }, { paymentReference: transaction.voucherNo }],
  });

  if (linkedMortgagePayment) {
    linkedMortgagePayment.status = 'VOID';
    linkedMortgagePayment.isDeleted = true;
    await linkedMortgagePayment.save();

    if (linkedMortgagePayment.principalAmount > 0) {
      // Add back the principal repayment to the mortgage liability
      await Mortgage.findOneAndUpdate(
        { _id: linkedMortgagePayment.mortgageId, companyId },
        { $inc: { outstandingPrincipalBalance: linkedMortgagePayment.principalAmount } }
      );
    }
  }

  // 4. Reverse Property Charge / Demand Payment if applicable
  const linkedChargePayment = await PropertyChargePayment.findOne({
    companyId,
    $or: [{ transactionId: transaction._id }, { bankReference: transaction.voucherNo }],
  });

  if (linkedChargePayment) {
    linkedChargePayment.status = 'VOID';
    linkedChargePayment.isDeleted = true;
    linkedChargePayment.isActive = false;
    await linkedChargePayment.save();

    if (linkedChargePayment.demandId) {
      const demand = await PropertyDemand.findOne({ _id: linkedChargePayment.demandId, companyId });
      if (demand) {
        demand.totalPaid = round2(Math.max(0, (demand.totalPaid || 0) - linkedChargePayment.amountPaid));
        if (demand.totalPaid <= 0) {
          demand.status = 'RECEIVED';
        } else if (demand.totalPaid < demand.amountDemanded) {
          demand.status = 'PARTIALLY_PAID';
        } else {
          demand.status = 'PAID';
        }
        await demand.save();
      }
    }
  }

  // 5. Update linked Voucher
  if (transaction.voucherId) {
    await Voucher.findOneAndUpdate(
      { _id: transaction.voucherId, companyId },
      { status: 'VOID' }
    );
  }

  // 6. Update Transaction to VOID and isDeleted
  const deletionAudit = {
    action: 'DELETED',
    performedBy: userId,
    performedByName: userName,
    performedAt: new Date(),
    reason: reason || 'Voided and moved to Recycle Bin',
    changes: {
      status: { from: 'POSTED', to: 'VOID' },
      isDeleted: { from: false, to: true },
      reversedAmount: numericAmount,
    },
  };

  transaction.status = 'VOID';
  transaction.isDeleted = true;
  transaction.deletedAt = new Date();
  transaction.deletedBy = userId;
  transaction.deletionReason = reason || 'Voided by user';
  transaction.auditHistory.push(deletionAudit);

  await transaction.save();

  // 7. Verify mathematical balance reconciliation on affected accounts
  await recalculateAccountBalance(transaction.accountId, companyId);
  if (transaction.counterAccountId) {
    await recalculateAccountBalance(transaction.counterAccountId, companyId);
  }

  // 8. Record in centralized AuditLog
  await recordAuditLog({
    companyId,
    entityType: 'TRANSACTION',
    entityId: transaction._id,
    voucherNo: transaction.voucherNo,
    action: 'DELETED',
    performedBy: userId,
    performedByName: userName,
    reason: reason || 'Transaction voided and moved to Recycle Bin',
    changes: deletionAudit.changes,
    snapshot: previousSnapshot,
  });

  return transaction;
};

/**
 * Restore a soft-deleted / voided transaction from the Recycle Bin and re-apply its financial impact
 */
export const restoreLedgerTransaction = async ({
  transactionId,
  companyId,
  userId = null,
  userName = 'System Operator',
  reason = '',
}) => {
  if (!transactionId || !companyId) {
    throw new Error('Transaction ID and Company Context are required for restore.');
  }

  const transaction = await Transaction.findOne({ _id: transactionId, companyId });
  if (!transaction) {
    throw new Error('Transaction not found in active company.');
  }

  if (!transaction.isDeleted && transaction.status === 'POSTED') {
    throw new Error('Transaction is already active and posted.');
  }

  const previousSnapshot = transaction.toObject();
  const numericAmount = round2(transaction.amount);

  // 1. Reapply Account Liquidity
  if (transaction.transactionType === 'TRANSFER') {
    // Debit source account
    await Account.findOneAndUpdate(
      { _id: transaction.accountId, companyId },
      { $inc: { currentBalance: -numericAmount } }
    );
    // Credit destination account
    if (transaction.counterAccountId) {
      await Account.findOneAndUpdate(
        { _id: transaction.counterAccountId, companyId },
        { $inc: { currentBalance: numericAmount } }
      );
    }
  } else if (transaction.direction === 'OUT') {
    // Deduct expense / mortgage outflow from account
    await Account.findOneAndUpdate(
      { _id: transaction.accountId, companyId },
      { $inc: { currentBalance: -numericAmount } }
    );
  } else if (transaction.direction === 'IN') {
    // Credit income / rent receipt to account
    await Account.findOneAndUpdate(
      { _id: transaction.accountId, companyId },
      { $inc: { currentBalance: numericAmount } }
    );
  }

  // 2. Restore Rent Payment & Rent Schedule
  const linkedRentPayment = await RentPayment.findOne({
    companyId,
    $or: [{ transactionId: transaction._id }, { receiptRef: transaction.voucherNo }],
  });

  if (linkedRentPayment) {
    linkedRentPayment.status = 'POSTED';
    linkedRentPayment.isDeleted = false;
    await linkedRentPayment.save();

    const schedQuery = linkedRentPayment.scheduleId
      ? { _id: linkedRentPayment.scheduleId, companyId }
      : { propertyId: transaction.propertyId, billingMonth: transaction.periodMonth, companyId };

    const schedule = await RentSchedule.findOne(schedQuery);
    if (schedule) {
      schedule.paidAmount = round2((schedule.paidAmount || 0) + linkedRentPayment.amount);
      await schedule.save();
    }
  }

  // 3. Restore Mortgage Payment & Principal Liability
  const linkedMortgagePayment = await MortgagePayment.findOne({
    companyId,
    $or: [{ transactionId: transaction._id }, { paymentReference: transaction.voucherNo }],
  });

  if (linkedMortgagePayment) {
    linkedMortgagePayment.status = 'POSTED';
    linkedMortgagePayment.isDeleted = false;
    await linkedMortgagePayment.save();

    if (linkedMortgagePayment.principalAmount > 0) {
      await Mortgage.findOneAndUpdate(
        { _id: linkedMortgagePayment.mortgageId, companyId },
        { $inc: { outstandingPrincipalBalance: -linkedMortgagePayment.principalAmount } }
      );
    }
  }

  // 4. Restore Property Charge Payment & Demand
  const linkedChargePayment = await PropertyChargePayment.findOne({
    companyId,
    $or: [{ transactionId: transaction._id }, { bankReference: transaction.voucherNo }],
  });

  if (linkedChargePayment) {
    linkedChargePayment.status = 'POSTED';
    linkedChargePayment.isDeleted = false;
    linkedChargePayment.isActive = true;
    await linkedChargePayment.save();

    if (linkedChargePayment.demandId) {
      const demand = await PropertyDemand.findOne({ _id: linkedChargePayment.demandId, companyId });
      if (demand) {
        demand.totalPaid = round2((demand.totalPaid || 0) + linkedChargePayment.amountPaid);
        if (demand.totalPaid >= demand.amountDemanded) {
          demand.status = 'PAID';
        } else if (demand.totalPaid > 0) {
          demand.status = 'PARTIALLY_PAID';
        } else {
          demand.status = 'RECEIVED';
        }
        await demand.save();
      }
    }
  }

  // 5. Restore Voucher
  if (transaction.voucherId) {
    await Voucher.findOneAndUpdate(
      { _id: transaction.voucherId, companyId },
      { status: 'POSTED' }
    );
  }

  // 6. Update Transaction status to POSTED
  const restorationAudit = {
    action: 'RESTORED',
    performedBy: userId,
    performedByName: userName,
    performedAt: new Date(),
    reason: reason || 'Restored from Recycle Bin',
    changes: {
      status: { from: 'VOID', to: 'POSTED' },
      isDeleted: { from: true, to: false },
      reappliedAmount: numericAmount,
    },
  };

  transaction.status = 'POSTED';
  transaction.isDeleted = false;
  transaction.restoredAt = new Date();
  transaction.restoredBy = userId;
  transaction.deletionReason = '';
  transaction.auditHistory.push(restorationAudit);

  await transaction.save();

  // 7. Reconcile account balances directly from active records
  await recalculateAccountBalance(transaction.accountId, companyId);
  if (transaction.counterAccountId) {
    await recalculateAccountBalance(transaction.counterAccountId, companyId);
  }

  // 8. Record in centralized AuditLog
  await recordAuditLog({
    companyId,
    entityType: 'TRANSACTION',
    entityId: transaction._id,
    voucherNo: transaction.voucherNo,
    action: 'RESTORED',
    performedBy: userId,
    performedByName: userName,
    reason: reason || 'Transaction restored from Recycle Bin',
    changes: restorationAudit.changes,
    snapshot: previousSnapshot,
  });

  return transaction;
};

/**
 * Update any financial transaction with complete multi-ledger synchronization
 */
export const updateComprehensiveTransaction = async ({
  transactionId,
  companyId,
  updateData,
  userId = null,
  userName = 'System Operator',
  reason = '',
}) => {
  if (!transactionId || !companyId) {
    throw new Error('Transaction ID and Company Context are required for update.');
  }

  const transaction = await Transaction.findOne({ _id: transactionId, companyId });
  if (!transaction) {
    throw new Error('Transaction not found in active company.');
  }

  if (transaction.isDeleted || transaction.status === 'VOID') {
    throw new Error('Cannot edit a deleted/void transaction. Please restore it first.');
  }

  const previousSnapshot = transaction.toObject();
  const changes = {};

  const oldAmount = transaction.amount;
  const newAmount = updateData.amount !== undefined ? round2(updateData.amount) : oldAmount;
  if (newAmount <= 0) {
    throw new Error('Transaction amount must be strictly positive.');
  }

  if (newAmount !== oldAmount) {
    changes.amount = { from: oldAmount, to: newAmount };
  }

  const oldAccountId = transaction.accountId ? transaction.accountId.toString() : null;
  const newAccountId = updateData.accountId ? updateData.accountId.toString() : oldAccountId;
  if (newAccountId !== oldAccountId) {
    changes.accountId = { from: oldAccountId, to: newAccountId };
  }

  const oldCounterAccountId = transaction.counterAccountId ? transaction.counterAccountId.toString() : null;
  const newCounterAccountId = updateData.counterAccountId !== undefined
    ? (updateData.counterAccountId ? updateData.counterAccountId.toString() : null)
    : oldCounterAccountId;
  if (newCounterAccountId !== oldCounterAccountId) {
    changes.counterAccountId = { from: oldCounterAccountId, to: newCounterAccountId };
  }

  // 1. LIQUIDITY SYNCHRONIZATION
  if (transaction.transactionType === 'TRANSFER') {
    // Revert old transfer
    if (oldAccountId) {
      await Account.findOneAndUpdate({ _id: oldAccountId, companyId }, { $inc: { currentBalance: oldAmount } });
    }
    if (oldCounterAccountId) {
      await Account.findOneAndUpdate({ _id: oldCounterAccountId, companyId }, { $inc: { currentBalance: -oldAmount } });
    }
    // Apply new transfer
    if (newAccountId) {
      await Account.findOneAndUpdate({ _id: newAccountId, companyId }, { $inc: { currentBalance: -newAmount } });
    }
    if (newCounterAccountId) {
      await Account.findOneAndUpdate({ _id: newCounterAccountId, companyId }, { $inc: { currentBalance: newAmount } });
    }
  } else if (transaction.direction === 'OUT') {
    // Outflow: old account refunded, new account charged
    if (oldAccountId && newAccountId && oldAccountId !== newAccountId) {
      await Account.findOneAndUpdate({ _id: oldAccountId, companyId }, { $inc: { currentBalance: oldAmount } });
      await Account.findOneAndUpdate({ _id: newAccountId, companyId }, { $inc: { currentBalance: -newAmount } });
    } else if (oldAccountId && newAmount !== oldAmount) {
      const delta = round2(newAmount - oldAmount);
      await Account.findOneAndUpdate({ _id: oldAccountId, companyId }, { $inc: { currentBalance: -delta } });
    }
  } else if (transaction.direction === 'IN') {
    // Inflow: old account debited, new account credited
    if (oldAccountId && newAccountId && oldAccountId !== newAccountId) {
      await Account.findOneAndUpdate({ _id: oldAccountId, companyId }, { $inc: { currentBalance: -oldAmount } });
      await Account.findOneAndUpdate({ _id: newAccountId, companyId }, { $inc: { currentBalance: newAmount } });
    } else if (oldAccountId && newAmount !== oldAmount) {
      const delta = round2(newAmount - oldAmount);
      await Account.findOneAndUpdate({ _id: oldAccountId, companyId }, { $inc: { currentBalance: delta } });
    }
  }

  // 2. RENT RECORDS SYNCHRONIZATION
  const linkedRentPayment = await RentPayment.findOne({
    companyId,
    $or: [{ transactionId: transaction._id }, { receiptRef: transaction.voucherNo }],
  });

  if (linkedRentPayment) {
    const rentAmountDelta = round2(newAmount - oldAmount);

    if (rentAmountDelta !== 0) {
      linkedRentPayment.amount = newAmount;

      const schedQuery = linkedRentPayment.scheduleId
        ? { _id: linkedRentPayment.scheduleId, companyId }
        : { propertyId: transaction.propertyId, billingMonth: transaction.periodMonth, companyId };

      const schedule = await RentSchedule.findOne(schedQuery);
      if (schedule) {
        schedule.paidAmount = round2(Math.max(0, (schedule.paidAmount || 0) + rentAmountDelta));
        await schedule.save();
      }
    }

    if (updateData.transactionDate) linkedRentPayment.paymentDate = new Date(updateData.transactionDate);
    if (newAccountId) linkedRentPayment.receivingAccountId = newAccountId;
    if (updateData.paymentMethod) linkedRentPayment.paymentMethod = updateData.paymentMethod;
    if (updateData.narration !== undefined) linkedRentPayment.notes = updateData.narration;

    await linkedRentPayment.save();
  }

  // 3. MORTGAGE RECORDS SYNCHRONIZATION
  const linkedMortgagePayment = await MortgagePayment.findOne({
    companyId,
    $or: [{ transactionId: transaction._id }, { paymentReference: transaction.voucherNo }],
  });

  if (linkedMortgagePayment) {
    const newInterest = updateData.interestAmount !== undefined ? round2(updateData.interestAmount) : linkedMortgagePayment.interestAmount;
    const newPrincipal = updateData.principalAmount !== undefined ? round2(updateData.principalAmount) : linkedMortgagePayment.principalAmount;
    const newFee = updateData.feeAmount !== undefined ? round2(updateData.feeAmount) : (linkedMortgagePayment.feeAmount || 0);

    const splitTotal = round2(newInterest + newPrincipal + newFee);
    if (Math.abs(splitTotal - newAmount) > 0.05) {
      throw new Error(`Mortgage payment split (£${splitTotal}) does not match Total Amount Paid (£${newAmount}).`);
    }

    const principalDelta = round2(newPrincipal - linkedMortgagePayment.principalAmount);
    if (principalDelta !== 0) {
      const mortgage = await Mortgage.findOne({ _id: linkedMortgagePayment.mortgageId, companyId });
      if (mortgage) {
        const adjustedPrincipal = round2(mortgage.outstandingPrincipalBalance - principalDelta);
        if (adjustedPrincipal < 0) {
          throw new Error('Principal repayment would reduce mortgage balance below zero.');
        }
        mortgage.outstandingPrincipalBalance = adjustedPrincipal;
        await mortgage.save();
      }
    }

    linkedMortgagePayment.totalAmountPaid = newAmount;
    linkedMortgagePayment.interestAmount = newInterest;
    linkedMortgagePayment.principalAmount = newPrincipal;
    linkedMortgagePayment.feeAmount = newFee;
    if (newAccountId) linkedMortgagePayment.paymentAccountId = newAccountId;
    if (updateData.transactionDate) linkedMortgagePayment.paymentDate = new Date(updateData.transactionDate);
    if (updateData.reference !== undefined) linkedMortgagePayment.paymentReference = updateData.reference;

    await linkedMortgagePayment.save();
  }

  // 4. Update Transaction Core Attributes
  transaction.amount = newAmount;
  transaction.accountId = newAccountId;
  transaction.counterAccountId = newCounterAccountId;

  if (updateData.transactionDate) {
    transaction.transactionDate = new Date(updateData.transactionDate);
    changes.transactionDate = { from: previousSnapshot.transactionDate, to: transaction.transactionDate };
  }
  if (
    updateData.categoryId !== undefined ||
    updateData.headId !== undefined ||
    updateData.subHeadId !== undefined ||
    updateData.head !== undefined ||
    updateData.subHead !== undefined
  ) {
    const resolvedCategory = await resolveAndValidateCategoryHierarchy({
      companyId,
      headId: updateData.headId !== undefined ? updateData.headId : transaction.headId,
      subHeadId: updateData.subHeadId !== undefined ? updateData.subHeadId : transaction.subHeadId,
      head: updateData.head !== undefined ? updateData.head : transaction.head,
      subHead: updateData.subHead !== undefined ? updateData.subHead : transaction.subHead,
      categoryId: updateData.categoryId !== undefined ? updateData.categoryId : transaction.categoryId,
    });

    if (String(transaction.categoryId || '') !== String(resolvedCategory.categoryId || '')) {
      changes.categoryId = { from: transaction.categoryId, to: resolvedCategory.categoryId };
    }
    if (String(transaction.headId || '') !== String(resolvedCategory.headId || '')) {
      changes.headId = { from: transaction.headId, to: resolvedCategory.headId };
    }
    if (String(transaction.subHeadId || '') !== String(resolvedCategory.subHeadId || '')) {
      changes.subHeadId = { from: transaction.subHeadId, to: resolvedCategory.subHeadId };
    }
    if (transaction.head !== resolvedCategory.head) {
      changes.head = { from: transaction.head, to: resolvedCategory.head };
    }
    if (transaction.subHead !== resolvedCategory.subHead) {
      changes.subHead = { from: transaction.subHead, to: resolvedCategory.subHead };
    }

    transaction.categoryId = resolvedCategory.categoryId;
    transaction.headId = resolvedCategory.headId;
    transaction.subHeadId = resolvedCategory.subHeadId;
    transaction.head = resolvedCategory.head;
    transaction.subHead = resolvedCategory.subHead;
  }
  if (updateData.propertyId !== undefined) {
    transaction.propertyId = updateData.propertyId || null;
    changes.propertyId = { from: previousSnapshot.propertyId, to: transaction.propertyId };
  }
  if (updateData.unitId !== undefined) {
    transaction.unitId = updateData.unitId || null;
    changes.unitId = { from: previousSnapshot.unitId, to: transaction.unitId };
  }
  if (updateData.narration !== undefined) {
    transaction.narration = updateData.narration.trim();
    changes.narration = { from: previousSnapshot.narration, to: transaction.narration };
  }
  if (updateData.reference !== undefined) {
    transaction.reference = updateData.reference.trim();
    changes.reference = { from: previousSnapshot.reference, to: transaction.reference };
  }
  if (updateData.periodMonth !== undefined) {
    transaction.periodMonth = updateData.periodMonth || null;
  }
  if (updateData.receiptUrl !== undefined) {
    transaction.receiptUrl = updateData.receiptUrl.trim();
  }
  if (updateData.receiptFilename !== undefined) {
    transaction.receiptFilename = updateData.receiptFilename.trim();
  }
  if (Array.isArray(updateData.documents)) {
    transaction.documents = updateData.documents;
  }

  // 5. Update linked Voucher
  if (transaction.voucherId) {
    await Voucher.findOneAndUpdate(
      { _id: transaction.voucherId, companyId },
      {
        totalAmount: newAmount,
        description: transaction.narration,
        reference: transaction.reference,
        voucherDate: transaction.transactionDate,
        receiptUrl: transaction.receiptUrl,
        receiptFilename: transaction.receiptFilename,
        documents: transaction.documents,
      }
    );
  }

  // 6. Record Audit History
  const editAudit = {
    action: 'EDITED',
    performedBy: userId,
    performedByName: userName,
    performedAt: new Date(),
    reason: reason || 'Updated transaction details',
    changes,
  };
  transaction.auditHistory.push(editAudit);

  await transaction.save();

  // 7. Mathematical Balance Reconciliation
  if (oldAccountId) await recalculateAccountBalance(oldAccountId, companyId);
  if (newAccountId && newAccountId !== oldAccountId) await recalculateAccountBalance(newAccountId, companyId);
  if (oldCounterAccountId) await recalculateAccountBalance(oldCounterAccountId, companyId);
  if (newCounterAccountId && newCounterAccountId !== oldCounterAccountId) {
    await recalculateAccountBalance(newCounterAccountId, companyId);
  }

  // 8. Record in centralized AuditLog
  await recordAuditLog({
    companyId,
    entityType: 'TRANSACTION',
    entityId: transaction._id,
    voucherNo: transaction.voucherNo,
    action: 'EDITED',
    performedBy: userId,
    performedByName: userName,
    reason: reason || 'Transaction modified',
    changes,
    snapshot: previousSnapshot,
  });

  return transaction;
};

/**
 * Get Deleted / Void Transactions for Recycle Bin
 */
export const getRecycleBinTransactions = async ({ companyId, query = {} }) => {
  const filter = {
    companyId,
    $or: [{ isDeleted: true }, { status: 'VOID' }],
  };

  if (query.propertyId) filter.propertyId = query.propertyId;
  if (query.transactionType) filter.transactionType = query.transactionType;

  if (query.startDate || query.endDate) {
    filter.transactionDate = {};
    if (query.startDate) filter.transactionDate.$gte = new Date(query.startDate);
    if (query.endDate) filter.transactionDate.$lte = new Date(query.endDate);
  }

  if (query.search) {
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { voucherNo: { $regex: query.search, $options: 'i' } },
        { narration: { $regex: query.search, $options: 'i' } },
        { reference: { $regex: query.search, $options: 'i' } },
        { deletionReason: { $regex: query.search, $options: 'i' } },
      ],
    });
  }

  const transactions = await Transaction.find(filter)
    .populate('accountId', 'name sortCode accountNumber accountType')
    .populate('counterAccountId', 'name sortCode accountNumber')
    .populate('categoryId', 'name type code')
    .populate('propertyId', 'name addressLine1 postcode')
    .populate('unitId', 'unitName')
    .populate('mortgageId', 'lenderName accountReference')
    .populate('deletedBy', 'name email')
    .sort({ deletedAt: -1, updatedAt: -1 })
    .lean();

  return transactions;
};

/**
 * Retrieve complete Audit History for a transaction
 */
export const getTransactionAuditHistory = async ({ transactionId, companyId }) => {
  const [transaction, logs] = await Promise.all([
    Transaction.findOne({ _id: transactionId, companyId })
      .populate('createdBy', 'name email')
      .populate('deletedBy', 'name email')
      .populate('restoredBy', 'name email')
      .lean(),
    AuditLog.find({ entityId: transactionId, companyId })
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  if (!transaction) throw new Error('Transaction not found in active company.');

  return {
    transaction,
    auditHistory: transaction.auditHistory || [],
    systemAuditLogs: logs || [],
  };
};
