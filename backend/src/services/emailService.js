import nodemailer from 'nodemailer';

/**
 * Builds a Nodemailer transporter based on DB config or environment variables
 */
export const createTransporter = (config = {}) => {
  const host = config.smtpHost || process.env.SMTP_HOST;
  const port = Number(config.smtpPort || process.env.SMTP_PORT || 587);
  const secure = config.smtpSecure !== undefined ? Boolean(config.smtpSecure) : (port === 465 || process.env.SMTP_SECURE === 'true');
  const user = config.smtpUser || process.env.SMTP_USER;
  const pass = config.smtpPass || process.env.SMTP_PASS;

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
  const fromName = config.fromName || 'UK Property Management Alerts';

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>?/gm, ''),
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
  }

  const formattedExpiry = formatUKDate(expiryDate);
  const subject = `${subjectPrefix}: "${documentTitle}" for ${propertyName} expires on ${formattedExpiry}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px; color: #f8fafc; }
    .card { max-width: 600px; margin: 0 auto; background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
    .header { background: linear-gradient(135deg, #312e81 0%, #1e1b4b 100%); padding: 24px; border-bottom: 1px solid #334155; }
    .brand { font-size: 13px; font-weight: 700; color: #818cf8; letter-spacing: 0.05em; text-transform: uppercase; }
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
      <div class="brand">UK Property Compliance &amp; Document Alert</div>
      <h1 class="title">${documentTitle}</h1>
      <div class="badge">${urgencyBadge}</div>
    </div>
    <div class="body">
      <p style="margin-top:0; font-size:14px; line-height:1.5; color:#cbd5e1;">
        The following statutory or contractual property document requires your immediate attention and renewal action.
      </p>

      <div class="detail-grid">
        <div class="row">
          <span class="label">Property Name</span>
          <span class="value">${propertyName}</span>
        </div>
        ${propertyAddress ? `
        <div class="row">
          <span class="label">Address</span>
          <span class="value">${propertyAddress}</span>
        </div>` : ''}
        <div class="row">
          <span class="label">Document Category</span>
          <span class="value">${documentCategory}</span>
        </div>
        <div class="row">
          <span class="label">Expiry Date</span>
          <span class="value highlight-value">${formattedExpiry}</span>
        </div>
        <div class="row">
          <span class="label">Days Remaining</span>
          <span class="value" style="color: ${urgencyColor};">${isExpired ? `${Math.abs(daysRemaining)} days overdue` : isDueToday ? 'Due today' : `${daysRemaining} days`}</span>
        </div>
      </div>

      <div class="alert-box">
        <strong>Action Required:</strong>
        Please arrange renewal, re-certification, or contractor inspection promptly to maintain full statutory compliance and avoid legal or insurance invalidation under UK landlord regulations.
      </div>

      <p style="font-size:12px; color:#94a3b8; margin-bottom:0;">
        Once renewed, please upload the new certificate / document into the system to automatically update the register and clear this alert.
      </p>
    </div>
    <div class="footer">
      This is an automated compliance notification from your UK Expense Tracker &amp; Property Finance System.
    </div>
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

export default {
  createTransporter,
  sendEmail,
  sendDocumentExpiryAlertEmail,
  sendTestEmail,
};
