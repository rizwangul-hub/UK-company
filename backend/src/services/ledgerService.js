import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import Voucher from '../models/Voucher.js';

export const round2 = (num) => Math.round((Number(num) + Number.EPSILON) * 100) / 100;

/**
 * Generate sequential, unique voucher number based on highest recorded sequence
 */
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
    amount,
    direction = 'OUT',
    propertyId = null,
    unitId = null,
    mortgageId = null,
    periodMonth = null,
    narration,
    reference = '',
    userId = null,
    receiptUrl = '',
    receiptFilename = '',
    documents = [],
  } = data;

  if (!companyId) {
    throw new Error('Company context is required for ledger transaction.');
  }

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
          categoryId,
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

    return { transaction, voucher };
  };

  if (externalSession) {
    return await runOperation(externalSession);
  }

  // Use managed transaction session if supported
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await runOperation(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    if (session) await session.abortTransaction();
    throw err;
  } finally {
    if (session) session.endSession();
  }
};

/**
 * Re-calculate live balance for an account directly from opening balance and transaction history
 */
export const recalculateAccountBalance = async (accountId, companyId = null) => {
  const accountQuery = { _id: accountId };
  if (companyId) accountQuery.companyId = companyId;

  const account = await Account.findOne(accountQuery);
  if (!account) return null;

  const targetCompanyId = companyId || account.companyId;
  const txQuery = {
    status: 'POSTED',
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
