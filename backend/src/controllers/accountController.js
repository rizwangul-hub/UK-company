import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import { postLedgerTransaction, recalculateAccountBalance, round2 } from '../services/ledgerService.js';
import { apiSuccess, apiError } from '../utils/apiResponse.js';

export const getAccounts = async (req, res) => {
  try {
    const accounts = await Account.find({ companyId: req.companyId, isActive: true })
      .sort({ accountType: 1, name: 1 })
      .lean();

    const totalLiquidity = accounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    const bankBalance = accounts.filter((a) => a.accountType === 'BANK').reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    const cashBalance = accounts.filter((a) => a.accountType === 'CASH').reduce((sum, a) => sum + (a.currentBalance || 0), 0);

    return apiSuccess(res, {
      accounts,
      totals: {
        totalLiquidity: round2(totalLiquidity),
        bankBalance: round2(bankBalance),
        cashBalance: round2(cashBalance),
      },
    });
  } catch (error) {
    return apiError(res, 'Failed to fetch accounts', 500, error);
  }
};

export const getAccountById = async (req, res) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, companyId: req.companyId }).lean();
    if (!account) return apiError(res, 'Account not found', 404);
    return apiSuccess(res, account);
  } catch (error) {
    return apiError(res, 'Failed to fetch account', 500, error);
  }
};

export const createAccount = async (req, res) => {
  try {
    const accountData = {
      ...req.body,
      companyId: req.companyId,
      currentBalance: req.body.openingBalance || 0,
    };
    const account = await Account.create(accountData);
    return apiSuccess(res, account, 'Account created successfully', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to create account', 400, error);
  }
};

export const updateAccount = async (req, res) => {
  try {
    const existing = await Account.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!existing) return apiError(res, 'Account not found', 404);

    if (req.body.name !== undefined) existing.name = req.body.name.trim();
    if (req.body.accountType !== undefined) existing.accountType = req.body.accountType;
    if (req.body.bankName !== undefined) existing.bankName = req.body.bankName.trim();
    if (req.body.sortCode !== undefined) existing.sortCode = req.body.sortCode.trim();
    if (req.body.accountNumber !== undefined) existing.accountNumber = req.body.accountNumber.trim();
    if (req.body.notes !== undefined) existing.notes = req.body.notes;
    if (req.body.isActive !== undefined) existing.isActive = Boolean(req.body.isActive);

    if (req.body.currentBalance !== undefined && req.body.currentBalance !== '') {
      existing.currentBalance = round2(Number(req.body.currentBalance));
    }
    if (req.body.openingBalance !== undefined && req.body.openingBalance !== '') {
      existing.openingBalance = round2(Number(req.body.openingBalance));
    }

    await existing.save();
    return apiSuccess(res, existing, 'Account details and balance updated successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to update account', 400, error);
  }
};

export const getAccountStatement = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const account = await Account.findOne({ _id: id, companyId: req.companyId }).lean();
    if (!account) return apiError(res, 'Account not found in active company', 404);

    const query = {
      companyId: req.companyId,
      status: 'POSTED',
      $or: [{ accountId: id }, { counterAccountId: id }],
    };
    if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) query.transactionDate.$gte = new Date(startDate);
      if (endDate) query.transactionDate.$lte = new Date(endDate);
    }

    const txns = await Transaction.find(query)
      .populate('categoryId', 'name type')
      .populate('propertyId', 'name postcode')
      .sort({ transactionDate: 1, createdAt: 1 })
      .lean();

    // Compute running balance
    let runningBalance = round2(account.openingBalance || 0);
    const statementRows = txns.map((tx) => {
      const isPrimary = tx.accountId.toString() === id.toString();
      const isDeposit = isPrimary ? tx.direction === 'IN' : true; // Counter in transfer is always deposit
      const amount = tx.amount;

      if (isDeposit) {
        runningBalance = round2(runningBalance + amount);
      } else {
        runningBalance = round2(runningBalance - amount);
      }

      return {
        ...tx,
        isDeposit,
        debit: !isDeposit ? amount : 0, // Withdrawal in bank terminology
        credit: isDeposit ? amount : 0, // Deposit in bank terminology
        runningBalance,
      };
    });

    return apiSuccess(res, {
      account,
      statement: statementRows.reverse(), // latest first
      openingBalance: account.openingBalance,
      closingBalance: runningBalance,
    });
  } catch (error) {
    return apiError(res, 'Failed to fetch account statement', 500, error);
  }
};

export const executeTransfer = async (req, res) => {
  try {
    const {
      fromAccountId,
      toAccountId,
      amount,
      transferDate = new Date(),
      reference = '',
      narration = '',
      receiptUrl = '',
      receiptFilename = '',
      documents = [],
    } = req.body;
    const numAmount = round2(amount);

    if (!fromAccountId || !toAccountId || numAmount <= 0) {
      return apiError(res, 'Source account, destination account, and positive transfer amount required.', 400);
    }
    if (fromAccountId === toAccountId) {
      return apiError(res, 'Source and destination accounts must be different.', 400);
    }

    // Both accounts must belong to the active company
    const [sourceAcc, destAcc] = await Promise.all([
      Account.findOne({ _id: fromAccountId, companyId: req.companyId }),
      Account.findOne({ _id: toAccountId, companyId: req.companyId }),
    ]);

    if (!sourceAcc || !destAcc) {
      return apiError(res, 'One or both accounts not found in this company.', 400);
    }

    const desc = narration || `Internal funds transfer: ${sourceAcc.name} -> ${destAcc.name}`;

    const { transaction, voucher } = await postLedgerTransaction({
      companyId: req.companyId,
      transactionDate: transferDate,
      transactionType: 'TRANSFER',
      accountId: fromAccountId,
      counterAccountId: toAccountId,
      amount: numAmount,
      direction: 'OUT',
      narration: desc,
      reference,
      userId: req.user?._id,
      receiptUrl: receiptUrl.trim(),
      receiptFilename: receiptFilename.trim(),
      documents,
    });

    return apiSuccess(
      res,
      { transaction, voucher },
      `Successfully transferred £${numAmount.toFixed(2)} from ${sourceAcc.name} to ${destAcc.name}.`,
      201
    );
  } catch (error) {
    return apiError(res, error.message || 'Transfer failed', 500, error);
  }
};
