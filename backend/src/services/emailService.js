import nodemailer from 'nodemailer';

/**
 * Builds a Nodemailer transporter based on DB config or environment variables
 */
export const createTransporter = (config = {}) => {
  const user = (config.smtpUser || process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const pass = (config.smtpPass || process.env.SMTP_PASS || process.env.EMAIL_PASS || '').trim();

  let host = (config.smtpHost || process.env.SMTP_HOST || '').trim();
  if (!host && user.toLowerCase().endsWith('@gmail.com')) {
    host = 'smtp.gmail.com';
  }

  const port = Number(config.smtpPort || process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? 465 : 587));
  const secure = config.smtpSecure !== undefined
    ? Boolean(config.smtpSecure)
    : (port === 465 || process.env.SMTP_SECURE === 'true');

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Formats a Date to UK DD/MM/YYYY format
 */
const formatUKDate = (d) => {
  if (!d) return 'N/A';
  const date = new Date(d);
  if (isNaN(date.getTime())) return 'N/A';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Sends a generic email
 */
export const sendEmail = async ({ to, subject, html, text, config = {} }) => {
  const transporter = createTransporter(config);
  if (!transporter) {
    console.warn('[EmailService] SMTP not configured. Cannot send email to:', to);
    return {
      success: false,
      error: 'SMTP credentials (Host, User, Password) are not configured. Please configure them in Settings.',
    };
  }

  const fromEmail = config.fromEmail || process.env.SMTP_FROM || config.smtpUser || process.env.SMTP_USER;
  const fromName = config.fromName || 'Fahad Rasheed - FT Accountants';
  const replyTo = config.replyTo || 'ftaccountants@hotmail.com';

  // Generate clean plain-text body to ensure high inbox deliverability
  const plainText = text || html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      replyTo,
      bcc: config.bcc || 'ftaccountants@hotmail.com',
      subject,
      text: plainText,
      html,
      headers: {
        'X-Priority': '3',
        'X-Mailer': 'FT Accountants Property Management Portal',
      },
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    console.error('[EmailService] Failed to send email:', err);
    return {
      success: false,
      error: err.message || 'Failed to dispatch email via SMTP server.',
    };
  }
};

/**
 * Sends a Document Expiry Warning Email
 */
export const sendDocumentExpiryAlertEmail = async ({
  toEmail,
  propertyName,
  propertyAddress = '',
  unitName = '',
  tenantName = '',
  tenantPhone = '',
  tenantEmail = '',
  documentTitle,
  documentCategory = 'Safety & Compliance',
  expiryDate,
  daysRemaining,
  config = {},
}) => {
  const isExpired = daysRemaining < 0;
  const isDueToday = daysRemaining === 0;

  let urgencyColor = '#d97706'; // amber
  let urgencyBadge = `EXPIRING IN ${daysRemaining} DAYS`;
  let subjectPrefix = '⚠️ Action Required';

  if (isExpired) {
    urgencyColor = '#dc2626'; // red
    urgencyBadge = `EXPIRED ${Math.abs(daysRemaining)} DAYS AGO`;
    subjectPrefix = '🚨 URGENT: EXPIRED DOCUMENT';
  } else if (isDueToday) {
    urgencyColor = '#dc2626';
    urgencyBadge = 'EXPIRES TODAY';
    subjectPrefix = '🚨 CRITICAL: EXPIRES TODAY';
  } else if (daysRemaining <= 7) {
    urgencyColor = '#ea580c'; // orange
    urgencyBadge = `CRITICAL: ${daysRemaining} DAYS REMAINING`;
    subjectPrefix = '⚠️ CRITICAL (7 Days)';
  } else if (daysRemaining <= 14) {
    urgencyColor = '#f59e0b';
    urgencyBadge = `URGENT: ${daysRemaining} DAYS REMAINING`;
    subjectPrefix = '⚠️ Urgent Notice (14 Days)';
  } else if (daysRemaining <= 30) {
    urgencyColor = '#f59e0b'; // amber
    urgencyBadge = `EXPIRING IN 1 MONTH (${daysRemaining} DAYS)`;
    subjectPrefix = '⚠️ 1 Month Notice (Expiring Soon)';
  }

  const formattedExpiry = formatUKDate(expiryDate);
  const targetLabel = tenantName ? `tenant ${tenantName}${propertyName ? ` (${propertyName})` : ''}` : propertyName;
  const subject = `${subjectPrefix}: "${documentTitle}" for ${targetLabel} will expire in ${daysRemaining} days (on ${formattedExpiry})`;

  const textBody = `
UK Property & Document Expiry Alert
====================================
Notice: ${urgencyBadge}

Document: ${documentTitle}
Category: ${documentCategory}
${tenantName ? `Tenant: ${tenantName} (${tenantPhone || 'N/A'}${tenantEmail ? ` · ${tenantEmail}` : ''})\n` : ''}Property: ${propertyName}${unitName ? ` · ${unitName}` : ''}
${propertyAddress ? `Address: ${propertyAddress}\n` : ''}Expiry Date: ${formattedExpiry}
Days Remaining: ${isExpired ? `${Math.abs(daysRemaining)} days overdue` : isDueToday ? 'Expires today' : `${daysRemaining} days (approx. 1 month)`}

Action Required:
This document will expire after one month (on ${formattedExpiry}).
Please arrange renewal, re-certification, or contractor inspection promptly to maintain compliance under UK landlord regulations.

Once renewed, please upload the new document into the system to clear this alert.
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px; color: #f8fafc; }
    .card { max-width: 600px; margin: 0 auto; background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
    .header { background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); padding: 24px; border-bottom: 1px solid #334155; }
    .brand { font-size: 13px; font-weight: 700; color: #34d399; letter-spacing: 0.05em; text-transform: uppercase; }
    .title { font-size: 20px; font-weight: 800; color: #ffffff; margin-top: 8px; margin-bottom: 0; line-height: 1.3; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; background-color: ${urgencyColor}20; color: ${urgencyColor}; border: 1px solid ${urgencyColor}50; margin-top: 12px; }
    .body { padding: 24px; }
    .detail-grid { background-color: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .label { color: #94a3b8; font-weight: 500; }
    .value { color: #f8fafc; font-weight: 700; text-align: right; }
    .highlight-value { color: #34d399; font-weight: 800; }
    .alert-box { background-color: ${urgencyColor}15; border-left: 4px solid ${urgencyColor}; padding: 14px 16px; border-radius: 8px; margin: 20px 0; font-size: 13px; line-height: 1.5; color: #f8fafc; }
    .footer { padding: 20px 24px; background-color: #0f172a; border-top: 1px solid #334155; font-size: 11px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">UK Property Compliance &amp; Document Expiry Alert</div>
      <h1 class="title">${documentTitle}</h1>
      <div class="badge">${urgencyBadge}</div>
    </div>
    <div class="body">
      <p style="margin-top:0; font-size:14px; line-height:1.5; color:#cbd5e1;">
        The following document will expire after one month (or is due for statutory renewal). Please review the details below:
      </p>

      <div class="detail-grid">
        ${tenantName ? `
        <div class="row">
          <span class="label">Tenant Name</span>
          <span class="value">${tenantName}</span>
        </div>
        <div class="row">
          <span class="label">Tenant Contact</span>
          <span class="value">${tenantPhone || 'N/A'}${tenantEmail ? ` · ${tenantEmail}` : ''}</span>
        </div>` : ''}
        <div class="row">
          <span class="label">Property / Unit</span>
          <span class="value">${propertyName}${unitName ? ` · ${unitName}` : ''}</span>
        </div>
        ${propertyAddress ? `
        <div class="row">
          <span class="label">Address</span>
          <span class="value">${propertyAddress}</span>
        </div>` : ''}
        <div class="row">
          <span class="label">Document Type</span>
          <span class="value">${documentCategory}</span>
        </div>
        <div class="row">
          <span class="label">Expiry Date</span>
          <span class="value highlight-value">${formattedExpiry}</span>
        </div>
        <div class="row">
          <span class="label">Days Remaining</span>
          <span class="value" style="color: ${urgencyColor};">${isExpired ? `${Math.abs(daysRemaining)} days overdue` : isDueToday ? 'Due today' : `${daysRemaining} days (approx. 1 month)`}</span>
        </div>
      </div>

      <div class="alert-box">
        <strong>1 Month Advance Notice:</strong>
        This document will expire after one month. Please contact the tenant or arrange re-certification/renewal promptly to maintain statutory compliance under UK landlord regulations.
      </div>

      <p style="font-size:12px; color:#94a3b8; margin-bottom:0;">
        Once renewed, please upload the new document or update the expiry date in the system to clear this alert.
      </p>
    </div>
    <div class="footer">
      Automated compliance notification · UK Property Management &amp; Expense Tracker
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: toEmail,
    subject,
    html,
    text: textBody,
    config,
  });
};

/**
 * Sends a Test Verification Email
 */
export const sendTestEmail = async (toEmail, config = {}) => {
  const subject = '✅ Test Notification: UK Property Expiry Alert System Connected';
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; padding: 24px; color: #f8fafc; }
    .card { max-width: 550px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .title { color: #34d399; font-size: 18px; font-weight: 800; margin-top: 0; }
    p { font-size: 13px; line-height: 1.6; color: #cbd5e1; }
    .box { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 12px; margin: 16px 0; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h2 class="title">✅ Email Alert System Connected Successfully!</h2>
    <p>This test email confirms that your email address is correctly attached to receive property document expiry notifications.</p>
    <div class="box">
      <div><strong>Attached Email:</strong> ${toEmail}</div>
      <div><strong>Dispatched At:</strong> ${new Date().toLocaleString('en-GB')}</div>
      <div><strong>Status:</strong> Active &amp; Monitoring Property Documents</div>
    </div>
    <p>When any Gas Safety, EICR, EPC, Insurance, or Council document is approaching its expiration date, you will automatically receive an alert to this email address.</p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: toEmail,
    subject,
    html,
    config,
  });
};

/**
 * Sends an official UK Rent Due Notice to Tenant
 */
export const sendRentDueNoticeEmail = async ({
  tenantName,
  tenantEmail,
  propertyName,
  unitName = '',
  amountDue,
  dueDate,
  bankDetails = {},
  paymentReference = '',
  notes = '',
  config = {},
}) => {
  const formattedDueDate = formatUKDate(dueDate);
  const formattedAmount = Number(amountDue || 0).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
  });

  const subject = `Rent Payment Due: ${formattedAmount} for ${propertyName} (Due: ${formattedDueDate})`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); }
    .header { background: linear-gradient(135deg, #065f46 0%, #047857 100%); padding: 24px; color: #ffffff; }
    .brand { font-size: 11px; font-weight: 800; color: #a7f3d0; letter-spacing: 0.08em; text-transform: uppercase; }
    .title { font-size: 20px; font-weight: 800; color: #ffffff; margin-top: 6px; margin-bottom: 0; line-height: 1.3; }
    .subtitle { font-size: 13px; color: #d1fae5; margin-top: 4px; margin-bottom: 0; }
    .body { padding: 24px; }
    .due-hero { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 20px; }
    .due-label { font-size: 12px; font-weight: 700; color: #065f46; text-transform: uppercase; letter-spacing: 0.05em; }
    .due-amount { font-size: 32px; font-weight: 900; color: #047857; margin: 6px 0; }
    .due-date { font-size: 13px; font-weight: 600; color: #166534; }
    .detail-grid { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 500; }
    .value { color: #0f172a; font-weight: 700; text-align: right; }
    .bank-box { background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; }
    .bank-title { font-weight: 800; color: #1e40af; margin-bottom: 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
    .reply-alert { background-color: #ecfdf5; border-left: 4px solid #059669; padding: 12px 16px; border-radius: 6px; margin: 20px 0; font-size: 12.5px; color: #065f46; line-height: 1.5; }
    .signature { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569; }
    .footer { padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">FT Accountants UK &amp; Property Finance</div>
      <h1 class="title">Rent Due Payment Notice</h1>
      <p class="subtitle">Official Tenancy Demand from Landlord Management</p>
    </div>
    <div class="body">
      <p style="margin-top:0; font-size:14px; line-height:1.5; color:#334155;">
        Dear <strong>${tenantName || 'Tenant'}</strong>,
      </p>
      <p style="font-size:13.5px; line-height:1.5; color:#334155;">
        Please be reminded that the scheduled rent for your tenancy at <strong>${propertyName}${unitName ? ` (${unitName})` : ''}</strong> is now due for settlement.
      </p>

      <div class="due-hero">
        <div class="due-label">Total Amount Due</div>
        <div class="due-amount">${formattedAmount}</div>
        <div class="due-date">Due on or before: ${formattedDueDate}</div>
      </div>

      <div class="detail-grid">
        <div class="row">
          <span class="label">Property</span>
          <span class="value">${propertyName}</span>
        </div>
        ${unitName ? `
        <div class="row">
          <span class="label">Unit / Room</span>
          <span class="value">${unitName}</span>
        </div>` : ''}
        <div class="row">
          <span class="label">Tenant Name</span>
          <span class="value">${tenantName}</span>
        </div>
        <div class="row">
          <span class="label">Due Date</span>
          <span class="value">${formattedDueDate}</span>
        </div>
        ${paymentReference ? `
        <div class="row">
          <span class="label">Payment Reference</span>
          <span class="value" style="color: #047857; font-family: monospace;">${paymentReference}</span>
        </div>` : ''}
      </div>

      ${(bankDetails.accountNumber || bankDetails.sortCode || bankDetails.accountName) ? `
      <div class="bank-box">
        <div class="bank-title">Official Bank Transfer Details</div>
        ${bankDetails.accountName ? `<div style="margin-bottom:4px;"><strong>Account Name:</strong> ${bankDetails.accountName}</div>` : ''}
        ${bankDetails.bankName ? `<div style="margin-bottom:4px;"><strong>Bank:</strong> ${bankDetails.bankName}</div>` : ''}
        ${bankDetails.sortCode ? `<div style="margin-bottom:4px;"><strong>Sort Code:</strong> <span style="font-family: monospace; font-weight: bold;">${bankDetails.sortCode}</span></div>` : ''}
        ${bankDetails.accountNumber ? `<div style="margin-bottom:4px;"><strong>Account Number:</strong> <span style="font-family: monospace; font-weight: bold;">${bankDetails.accountNumber}</span></div>` : ''}
        ${paymentReference ? `<div style="margin-top:6px; color:#1e40af;"><strong>Reference to Quote:</strong> <span style="font-family: monospace; font-weight: bold;">${paymentReference}</span></div>` : ''}
      </div>` : ''}

      ${notes ? `<p style="font-size:12px; color:#64748b; font-style: italic;">Note: ${notes}</p>` : ''}

      <div class="reply-alert">
        <strong>Direct Manager Inquiries:</strong> If you have already made this payment, require a receipt, or need to query this demand, please reply directly to this email or write to <strong>ftaccountants@hotmail.com</strong>.
      </div>

      <div class="signature">
        Kind regards,<br>
        <strong style="color: #0f172a;">Kamran Ijaz</strong> (Director / Boss)<br>
        <strong style="color: #0f172a;">Fahad Rasheed</strong> (Property Manager)<br>
        <span>FT Accountants UK &middot; Management &amp; Accounts Division</span><br>
        <span style="color: #059669; font-weight: 600;">ftaccountants@hotmail.com</span>
      </div>
    </div>
    <div class="footer">
      This is an automated rental accounting demand issued on behalf of FT Accountants UK &amp; Property Finance.
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: tenantEmail,
    subject,
    html,
    config: {
      ...config,
      fromName: 'Kamran Ijaz & Fahad Rasheed (FT Accountants)',
      replyTo: 'ftaccountants@hotmail.com',
      bcc: 'ftaccountants@hotmail.com',
    },
  });
};

export default {
  createTransporter,
  sendEmail,
  sendDocumentExpiryAlertEmail,
  sendRentDueNoticeEmail,
  sendTestEmail,
};
