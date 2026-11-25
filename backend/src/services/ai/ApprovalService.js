import crypto from 'node:crypto';
import AIApprovalRequest from '../../models/AIApprovalRequest.js';
import Property from '../../models/Property.js';
import Account from '../../models/Account.js';
import MaintenanceTask from '../../models/MaintenanceTask.js';
import ComplianceNotification from '../../models/ComplianceNotification.js';
import SupplierReceipt from '../../models/SupplierReceipt.js';
import StatementImportBatch from '../../models/StatementImportBatch.js';
import StatementImportRow from '../../models/StatementImportRow.js';
import EmailNotificationConfig from '../../models/EmailNotificationConfig.js';
import { sendEmail } from '../emailService.js';
import { assertCompanyAuthorized, assertWriteRoleAllowed } from './CompanyAuthorizationService.js';
import { logAIAction } from './AuditService.js';

const APPROVAL_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const createApprovalRequest = async ({
  user,
  companyId,
  conversationId = null,
  actionType,
  title,
  summary,
  payload,
  previewData = {},
}) => {
  assertWriteRoleAllowed(user);
  const { companyId: verifiedCompanyId } = assertCompanyAuthorized(user, companyId);

  const approvalToken = crypto.randomBytes(24).toString('hex');
  const reqDoc = await AIApprovalRequest.create({
    approvalToken,
    userId: user._id,
    companyId: verifiedCompanyId,
    conversationId,
    actionType,
    title,
    summary,
    payload,
    previewData,
    status: 'PENDING',
    expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
  });

  return reqDoc;
};

export const listPendingApprovals = async (userId) => {
  return AIApprovalRequest.find({
    userId,
    status: 'PENDING',
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
};

export const rejectApprovalRequest = async ({ approvalId, approvalToken, user }) => {
  const reqDoc = await AIApprovalRequest.findOne({
    _id: approvalId,
    approvalToken,
    userId: user._id,
  });
  if (!reqDoc) {
    const err = new Error('Approval request not found or invalid token.');
    err.status = 404;
    throw err;
  }
  if (reqDoc.status !== 'PENDING') {
    const err = new Error(`Approval request already ${reqDoc.status.toLowerCase()}.`);
    err.status = 400;
    throw err;
  }

  reqDoc.status = 'REJECTED';
  await reqDoc.save();

  await logAIAction({
    user,
    companyId: reqDoc.companyId,
    conversationId: reqDoc.conversationId,
    approvalRequestId: reqDoc._id,
    actionType: reqDoc.actionType,
    status: 'REJECTED',
    payload: reqDoc.payload,
  });

  return reqDoc;
};

export const approveAndExecute = async ({ approvalId, approvalToken, user }) => {
  assertWriteRoleAllowed(user);

  const reqDoc = await AIApprovalRequest.findOne({
    _id: approvalId,
    approvalToken,
    userId: user._id,
  });
  if (!reqDoc) {
    const err = new Error('Approval request not found or invalid one-time token.');
    err.status = 404;
    throw err;
  }
  if (reqDoc.status !== 'PENDING') {
    const err = new Error(`This approval has already been ${reqDoc.status.toLowerCase()}.`);
    err.status = 400;
    throw err;
  }
  if (reqDoc.expiresAt < new Date()) {
    reqDoc.status = 'EXPIRED';
    await reqDoc.save();
    const err = new Error('Approval request expired. Please ask the assistant to prepare a new preview.');
    err.status = 400;
    throw err;
  }

  // Re-verify company authorization at execution time
  const { companyId } = assertCompanyAuthorized(user, reqDoc.companyId);
  const p = reqDoc.payload || {};
  let result = null;

  try {
    switch (reqDoc.actionType) {
      case 'CREATE_PROPERTY_NOTE': {
        const prop = await Property.findOne({ _id: p.propertyId, companyId });
        if (!prop) throw new Error('Property not found in authorized company.');
        const stamp = new Date().toISOString().slice(0, 10);
        const entry = `[${stamp} · ${user.name || user.email}]: ${String(p.note || '').trim()}`;
        prop.notes = prop.notes ? `${prop.notes}\n${entry}` : entry;
        await prop.save();
        result = { propertyId: prop._id, propertyName: prop.name, notes: prop.notes };
        break;
      }

      case 'CREATE_MAINTENANCE_REQUEST': {
        const maxTask = await MaintenanceTask.findOne({ companyId }).sort({ taskNumber: -1 }).lean();
        const nextNum = (maxTask?.taskNumber || 8) + 1;
        const task = await MaintenanceTask.create({
          companyId,
          taskNumber: nextNum,
          title: String(p.title || 'AI Maintenance Request').trim(),
          description: String(p.description || '').trim(),
          priority: ['HIGH', 'MEDIUM', 'LOW'].includes(p.priority) ? p.priority : 'MEDIUM',
          status: 'PENDING',
          isCoreResponsibility: false,
          notes: p.propertyName ? `Property: ${p.propertyName}` : '',
        });
        result = { taskId: task._id, taskNumber: task.taskNumber, title: task.title, status: task.status };
        break;
      }

      case 'CREATE_COMPLIANCE_REMINDER': {
        const prop = await Property.findOne({ _id: p.propertyId, companyId }).lean();
        if (!prop) throw new Error('Property not found in authorized company.');
        const notif = await ComplianceNotification.create({
          companyId,
          propertyId: prop._id,
          type: 'RENEWAL_REQUIRED',
          urgency: ['INFO', 'WARNING', 'PRIORITY', 'URGENT', 'CRITICAL'].includes(p.urgency)
            ? p.urgency
            : 'WARNING',
          title: String(p.title || 'Compliance Reminder').trim(),
          message: String(p.message || '').trim(),
          dueDate: p.dueDate ? new Date(p.dueDate) : null,
          isRead: false,
        });
        result = { notificationId: notif._id, title: notif.title, urgency: notif.urgency };
        break;
      }

      case 'CREATE_EXPENSE_DRAFT':
      case 'CREATE_INCOME_DRAFT':
      case 'PREPARE_RECONCILIATION_ADJUSTMENT': {
        const account = await Account.findOne({ _id: p.accountId, companyId, isActive: true }).lean();
        if (!account) throw new Error('Bank/Cash account not found in authorized company.');
        const batchHash = crypto
          .createHash('sha256')
          .update(`${reqDoc._id}:${Date.now()}`)
          .digest('hex');

        const isIncome = reqDoc.actionType === 'CREATE_INCOME_DRAFT' || p.direction === 'INFLOW';
        const batch = await StatementImportBatch.create({
          companyId,
          accountId: account._id,
          filename: `AI_DRAFT_${reqDoc.actionType}_${new Date().toISOString().slice(0, 10)}.json`,
          fileHash: batchHash,
          totalRows: 1,
          newRows: 1,
          status: 'DRAFT',
          uploadedBy: user._id,
          uploadedByName: user.name || user.email || 'Pixx AI Draft',
          notes: String(p.notes || reqDoc.summary || 'Created via Pixx AI Approval').trim(),
        });

        const row = await StatementImportRow.create({
          companyId,
          batchId: batch._id,
          accountId: account._id,
          rowIndex: 1,
          rowHash: `${batchHash}-1`,
          transactionDate: p.transactionDate ? new Date(p.transactionDate) : new Date(),
          description: String(p.description || reqDoc.title).trim(),
          reference: String(p.reference || '').trim(),
          debitAmount: isIncome ? 0 : Math.abs(Number(p.amount) || 0),
          creditAmount: isIncome ? Math.abs(Number(p.amount) || 0) : 0,
          direction: isIncome ? 'INFLOW' : 'OUTFLOW',
          amount: Math.abs(Number(p.amount) || 0),
          status: 'PENDING_REVIEW',
          notes: String(p.notes || '').trim(),
        });

        result = {
          batchId: batch._id,
          rowId: row._id,
          status: 'DRAFT',
          accountName: account.name,
          amount: row.amount,
          direction: row.direction,
        };
        break;
      }

      case 'CREATE_SUPPLIER_INVOICE_DRAFT': {
        const receipt = await SupplierReceipt.create({
          companyId,
          supplier: String(p.supplier || 'Supplier').trim(),
          branch: String(p.branch || '').trim(),
          receiptNumber: String(p.receiptNumber || `DRAFT-${Date.now()}`).trim(),
          receiptDate: p.receiptDate ? new Date(p.receiptDate) : new Date(),
          totalAmountDueGBP: Math.max(0, Number(p.totalAmountDueGBP) || 0),
          notes: `[AI DRAFT] ${String(p.notes || '').trim()}`,
        });
        result = {
          receiptId: receipt._id,
          supplier: receipt.supplier,
          receiptNumber: receipt.receiptNumber,
          totalAmountDueGBP: receipt.totalAmountDueGBP,
        };
        break;
      }

      case 'CREATE_EMAIL_DRAFT': {
        result = {
          draftSaved: true,
          to: p.to,
          subject: p.subject,
          body: p.body,
          replyTo: p.replyTo || 'ftaccountants@hotmail.com',
        };
        break;
      }

      case 'SEND_APPROVED_EMAIL': {
        const config = (await EmailNotificationConfig.findOne({ companyId: 'GLOBAL' }).lean()) || {};
        const sendRes = await sendEmail({
          to: p.to,
          subject: p.subject,
          html: p.html || `<p>${String(p.body || '').replace(/\n/g, '<br>')}</p>`,
          text: p.body || '',
          config: {
            ...config,
            replyTo: p.replyTo || config.rentDueReplyTo || 'ftaccountants@hotmail.com',
            bcc: p.bcc !== undefined ? p.bcc : (p.replyTo || 'ftaccountants@hotmail.com'),
          },
        });
        if (!sendRes.success) {
          throw new Error(sendRes.error || 'Failed to send approved email.');
        }
        result = { sentTo: p.to, subject: p.subject, messageId: sendRes.messageId };
        break;
      }

      default:
        throw new Error(`Unsupported action type: ${reqDoc.actionType}`);
    }

    reqDoc.status = 'EXECUTED';
    reqDoc.executedAt = new Date();
    reqDoc.executionResult = result;
    await reqDoc.save();

    await logAIAction({
      user,
      companyId,
      conversationId: reqDoc.conversationId,
      approvalRequestId: reqDoc._id,
      actionType: reqDoc.actionType,
      status: 'SUCCESS',
      payload: reqDoc.payload,
      result,
    });

    return { approval: reqDoc, result };
  } catch (err) {
    reqDoc.status = 'FAILED';
    reqDoc.errorMessage = err.message || 'Execution failed';
    await reqDoc.save();

    await logAIAction({
      user,
      companyId,
      conversationId: reqDoc.conversationId,
      approvalRequestId: reqDoc._id,
      actionType: reqDoc.actionType,
      status: 'FAILED',
      payload: reqDoc.payload,
      errorMessage: reqDoc.errorMessage,
    });

    throw err;
  }
};

export default {
  createApprovalRequest,
  listPendingApprovals,
  rejectApprovalRequest,
  approveAndExecute,
};
