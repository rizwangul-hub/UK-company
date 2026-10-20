import React, { useState, useEffect } from 'react';
import {
  Settings,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Landmark,
  Calendar,
  Loader2,
  Tags,
  Plus,
  Edit3,
  Trash2,
  X,
  SlidersHorizontal,
  Mail,
  Send,
  Bell,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileText,
  Building2,
  Check,
} from 'lucide-react';
import { authAPI, ledgerAPI, complianceAPI } from '../services/api.js';
import { formatUKDate } from '../utils/formatters.js';

export function SettingsPage({ user }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Category / Expense Head Management
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catFilter, setCatFilter] = useState('ALL');
  const [catMsg, setCatMsg] = useState('');

  // Add Category Modal
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [addCatSubmitting, setAddCatSubmitting] = useState(false);
  const [addCatError, setAddCatError] = useState('');
  const [addCatForm, setAddCatForm] = useState({
    name: '',
    code: '',
    type: 'OPERATING_EXPENSE',
    isAllowableTaxDeduction: true,
    isRentalHead: false,
    description: '',
  });

  // Edit Category Modal
  const [editingCat, setEditingCat] = useState(null);
  const [editCatSubmitting, setEditCatSubmitting] = useState(false);
  const [editCatError, setEditCatError] = useState('');
  const [editCatForm, setEditCatForm] = useState({
    name: '',
    code: '',
    type: 'OPERATING_EXPENSE',
    isAllowableTaxDeduction: true,
    isRentalHead: false,
    description: '',
    isActive: true,
  });

  // Email & Document Expiry Notification Settings
  const [emailSettings, setEmailSettings] = useState({
    recipientEmail: '',
    enabled: true,
    alertDays: [60, 45, 30, 14, 7, 0],
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    hasSmtpPass: false,
    fromEmail: '',
    fromName: 'UK Property Management Alerts',
    lastCheckedAt: null,
    lastEmailSentAt: null,
    sentAlertsHistory: [],
  });
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [checkingExpiry, setCheckingExpiry] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailError, setEmailError] = useState('');
  const [showSmtpConfig, setShowSmtpConfig] = useState(false);

  const loadCategories = async () => {
    setCatLoading(true);
    try {
      const res = await ledgerAPI.getCategories({ includeInactive: 'true' });
      if (res?.success) {
        setCategories(res.data.categories || []);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setCatLoading(false);
    }
  };

  const loadEmailSettings = async () => {
    setEmailLoading(true);
    try {
      const res = await complianceAPI.getEmailSettings();
      if (res?.success && res.data) {
        setEmailSettings(res.data);
      }
    } catch (err) {
      console.error('Failed to load email notification settings:', err);
    } finally {
      setEmailLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    loadEmailSettings();
  }, []);

  const handleSaveEmailSettings = async (e) => {
    if (e) e.preventDefault();
    setEmailSaving(true);
    setEmailSuccess('');
    setEmailError('');
    try {
      const res = await complianceAPI.updateEmailSettings(emailSettings);
      if (res?.success) {
        setEmailSuccess('Email notification settings saved successfully.');
        if (res.data) setEmailSettings(res.data);
      }
    } catch (err) {
      setEmailError(err.response?.data?.message || 'Failed to save email settings.');
    } finally {
      setEmailSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!emailSettings.recipientEmail) {
      setEmailError('Please enter an alert email address before sending a test.');
      return;
    }
    setTestSending(true);
    setEmailSuccess('');
    setEmailError('');
    try {
      const res = await complianceAPI.sendTestEmail({
        toEmail: emailSettings.recipientEmail,
        smtpHost: emailSettings.smtpHost,
        smtpPort: emailSettings.smtpPort,
        smtpSecure: emailSettings.smtpSecure,
        smtpUser: emailSettings.smtpUser,
        smtpPass: emailSettings.smtpPass,
        fromEmail: emailSettings.fromEmail,
        fromName: emailSettings.fromName,
      });
      if (res?.success) {
        setEmailSuccess(`Test email sent successfully to ${emailSettings.recipientEmail}! Check your inbox.`);
      }
    } catch (err) {
      setEmailError(err.response?.data?.message || 'Failed to send test email. Check SMTP configuration.');
    } finally {
      setTestSending(false);
    }
  };

  const handleCheckExpiryNow = async () => {
    setCheckingExpiry(true);
    setEmailSuccess('');
    setEmailError('');
    try {
      const res = await complianceAPI.checkExpiryEmailsNow({ forceSend: false });
      if (res?.success) {
        const d = res.data;
        setEmailSuccess(`Document check complete! Evaluated: ${d.evaluatedCount || 0} documents. Emails sent: ${d.emailsSent || 0}. Already notified: ${d.alreadyNotifiedCount || 0}.`);
        loadEmailSettings();
      }
    } catch (err) {
      setEmailError(err.response?.data?.message || 'Failed to check document expiries.');
    } finally {
      setCheckingExpiry(false);
    }
  };

  const handleAddCatSubmit = async (e) => {
    e.preventDefault();
    setAddCatSubmitting(true);
    setAddCatError('');
    try {
      await ledgerAPI.createCategory(addCatForm);
      setShowAddCatModal(false);
      setCatMsg(`Category head "${addCatForm.name}" created.`);
      setAddCatForm({
        name: '',
        code: '',
        type: 'OPERATING_EXPENSE',
        isAllowableTaxDeduction: true,
        isRentalHead: false,
        description: '',
      });
      loadCategories();
    } catch (err) {
      setAddCatError(err.response?.data?.message || 'Failed to create category head.');
    } finally {
      setAddCatSubmitting(false);
    }
  };

  const handleOpenEditCat = (cat) => {
    setEditingCat(cat);
    setEditCatError('');
    setEditCatForm({
      name: cat.name || '',
      code: cat.code || '',
      type: cat.type || 'OPERATING_EXPENSE',
      isAllowableTaxDeduction: cat.isAllowableTaxDeduction !== false,
      isRentalHead: Boolean(cat.isRentalHead),
      description: cat.description || '',
      isActive: cat.isActive !== false,
    });
  };

  const handleEditCatSubmit = async (e) => {
    e.preventDefault();
    if (!editingCat) return;
    setEditCatSubmitting(true);
    setEditCatError('');
    try {
      await ledgerAPI.updateCategory(editingCat._id, editCatForm);
      setEditingCat(null);
      setCatMsg(`Category head "${editCatForm.name}" updated successfully.`);
      loadCategories();
    } catch (err) {
      setEditCatError(err.response?.data?.message || 'Failed to update category head.');
    } finally {
      setEditCatSubmitting(false);
    }
  };

  const handleDeleteCat = async (cat) => {
    if (!window.confirm(`Are you sure you want to delete or deactivate "${cat.name}"?`)) return;
    try {
      const res = await ledgerAPI.deleteCategory(cat._id);
      setCatMsg(res?.message || 'Category deleted / deactivated.');
      loadCategories();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete category.');
    }
  };

  const filteredCategories = categories.filter((c) => {
    if (catFilter === 'ALL') return true;
    return c.type === catFilter;
  });

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.updatePassword({ currentPassword, newPassword });
      if (res?.success) {
        setSuccess('Password updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          System Settings & Operator Profile
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Manage your operator security credentials and view UK financial localization parameters.
        </p>
      </div>

      {/* Operator Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>Authorized Operator Profile</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">Operator Name</span>
            <span className="font-semibold text-slate-200 mt-0.5 block">{user?.name || 'Authorized Operator'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Sign-in Email</span>
            <span className="font-semibold text-slate-200 mt-0.5 block">{user?.email}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">System Architecture</span>
            <span className="font-semibold text-indigo-400 mt-0.5 block">Single-User Unified Portal</span>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Lock className="w-4 h-4 text-indigo-400" />
          <span>Change Password</span>
        </h2>

        {success && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-3.5 text-xs max-w-md">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">New Password (min 6 characters)</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Update Password</span>
          </button>
        </form>
      </div>

      {/* Property Document Expiry & Statutory Email Alert Center */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white">
                  Property Document Expiry &amp; Statutory Email Alerts
                </h2>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  emailSettings.enabled && emailSettings.recipientEmail
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                }`}>
                  {emailSettings.enabled && emailSettings.recipientEmail ? 'Active & Monitoring' : 'Setup Required'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                The system monitors all property documents (Gas Safety CP12, EICR, EPC, Building Insurance, Council Licenses) and automatically sends renewal emails before they expire.
              </p>
            </div>
          </div>
        </div>

        {emailSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{emailSuccess}</span>
            </div>
            <button onClick={() => setEmailSuccess('')} className="text-slate-400 hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {emailError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{emailError}</span>
            </div>
            <button onClick={() => setEmailError('')} className="text-slate-400 hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSaveEmailSettings} className="space-y-4 text-xs">
          {/* Attached Email Address */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <label className="block text-slate-200 font-bold text-xs">
              Attached Alert Email Address <span className="text-rose-400">*</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={emailSettings.recipientEmail}
                  onChange={(e) => setEmailSettings({ ...emailSettings, recipientEmail: e.target.value })}
                  placeholder="e.g. yourname@gmail.com, management@domain.co.uk"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={testSending || !emailSettings.recipientEmail}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {testSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send Test Email</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              When any document of any property is approaching its expiry deadline, the system will send an email alert to this attached address. You can separate multiple addresses with a comma.
            </p>
          </div>

          {/* Enable Toggle & Alert Milestone Intervals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-200 block">Automated Expiry Alerts</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Background scheduler evaluates documents every 12 hours
                  </span>
                </div>
                <input
                  type="checkbox"
                  id="emailAlertsToggle"
                  checked={emailSettings.enabled}
                  onChange={(e) => setEmailSettings({ ...emailSettings, enabled: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 cursor-pointer"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <span className="font-bold text-slate-200 block">Alert Milestones</span>
              <div className="flex items-center gap-2 flex-wrap">
                {[60, 45, 30, 14, 7, 0].map((days) => {
                  const isChecked = emailSettings.alertDays?.includes(days);
                  return (
                    <button
                      type="button"
                      key={days}
                      onClick={() => {
                        const current = emailSettings.alertDays || [];
                        const updated = current.includes(days)
                          ? current.filter((d) => d !== days)
                          : [...current, days].sort((a, b) => b - a);
                        setEmailSettings({ ...emailSettings, alertDays: updated });
                      }}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                        isChecked
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {days === 0 ? 'On Expiry' : `${days}d`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Collapsible SMTP Configuration */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSmtpConfig(!showSmtpConfig)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-900/60 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-slate-200 text-xs">
                  Custom SMTP / Email Dispatch Server Settings (Optional)
                </span>
                <span className="text-[10px] text-slate-400">
                  {emailSettings.smtpHost ? `Configured (${emailSettings.smtpHost})` : 'Default System Dispatch'}
                </span>
              </div>
              <div className="text-slate-400">
                {showSmtpConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showSmtpConfig && (
              <div className="p-4 pt-0 space-y-3.5 border-t border-slate-800/80 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 font-medium mb-1">SMTP Server Host</label>
                    <input
                      type="text"
                      value={emailSettings.smtpHost}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
                      placeholder="e.g. smtp.gmail.com or smtp.office365.com"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Port</label>
                    <input
                      type="number"
                      value={emailSettings.smtpPort}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: Number(e.target.value) || 587 })}
                      placeholder="587"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">SMTP Username / Email</label>
                    <input
                      type="text"
                      value={emailSettings.smtpUser}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
                      placeholder="your-email@gmail.com"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      SMTP Password or App Password {emailSettings.hasSmtpPass && <span className="text-emerald-400 font-normal">(Saved)</span>}
                    </label>
                    <input
                      type="password"
                      value={emailSettings.smtpPass}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtpPass: e.target.value })}
                      placeholder={emailSettings.hasSmtpPass ? '•••••••• (leave blank to keep current)' : 'App Password'}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">From Sender Name</label>
                    <input
                      type="text"
                      value={emailSettings.fromName}
                      onChange={(e) => setEmailSettings({ ...emailSettings, fromName: e.target.value })}
                      placeholder="UK Property Management Alerts"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">From Email Address</label>
                    <input
                      type="email"
                      value={emailSettings.fromEmail}
                      onChange={(e) => setEmailSettings({ ...emailSettings, fromEmail: e.target.value })}
                      placeholder="alerts@pixxtechnologies.co.uk"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-slate-300 leading-relaxed">
                  💡 <strong>Gmail Tip:</strong> If using Gmail, go to Google Account &gt; Security &gt; 2-Step Verification &gt; App Passwords, generate a 16-character App Password, and paste it here. Use host: <code>smtp.gmail.com</code> and port: <code>587</code>.
                </div>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="pt-2 flex items-center justify-between flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleCheckExpiryNow}
              disabled={checkingExpiry}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${checkingExpiry ? 'animate-spin' : ''}`} />
              <span>{checkingExpiry ? 'Checking Expiries...' : 'Check Expiries & Send Alerts Now'}</span>
            </button>

            <button
              type="submit"
              disabled={emailSaving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {emailSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Email Settings</span>
            </button>
          </div>
        </form>

        {/* Recent Sent Alerts History */}
        {emailSettings.sentAlertsHistory && emailSettings.sentAlertsHistory.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200">
              <span className="flex items-center gap-1.5 text-indigo-400">
                <Bell className="w-3.5 h-3.5" />
                <span>Recent Dispatched Expiry Alert Emails ({emailSettings.sentAlertsHistory.length})</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                Last checked: {emailSettings.lastCheckedAt ? new Date(emailSettings.lastCheckedAt).toLocaleString('en-GB') : 'Never'}
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {emailSettings.sentAlertsHistory.slice(0, 10).map((h, hIdx) => (
                <div
                  key={h._id || hIdx}
                  className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white flex items-center gap-1.5 truncate">
                      <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">{h.documentTitle}</span>
                      <span className="text-slate-400 font-normal truncate">• {h.propertyName}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>Expires: {formatUKDate(h.expiryDate)}</span>
                      <span>• Sent to: {h.sentTo}</span>
                      <span>• {new Date(h.sentAt).toLocaleDateString('en-GB')}</span>
                    </div>
                  </div>

                  <div className="shrink-0 ml-3">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      h.status === 'SENT'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {h.status === 'SENT' ? 'SENT' : 'FAILED'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chart of Accounts: Nominal Heads & Expense Categories */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Tags className="w-4 h-4 text-emerald-400" />
              <span>Nominal Category Heads & Chart of Accounts</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Edit category names, create custom expense heads, and manage tax deductibility.
            </p>
          </div>
          <button
            onClick={() => {
              setAddCatError('');
              setShowAddCatModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Head</span>
          </button>
        </div>

        {catMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{catMsg}</span>
            </div>
            <button onClick={() => setCatMsg('')} className="text-slate-400 hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[
            { id: 'ALL', label: 'All Heads' },
            { id: 'OPERATING_EXPENSE', label: 'Operating Expenses' },
            { id: 'INCOME', label: 'Income & Rent Heads' },
            { id: 'FINANCE_COST', label: 'Finance & Mortgages' },
            { id: 'CAPITAL_EXPENDITURE', label: 'Capital Works' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setCatFilter(pill.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                catFilter === pill.id
                  ? 'bg-slate-700 text-white border border-slate-600'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Heads List */}
        {catLoading ? (
          <div className="py-12 flex items-center justify-center text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            <span className="text-xs">Loading nominal heads...</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No category heads match this filter. Click "Add New Head" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-500 text-[10px] uppercase border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Head Name</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Tax Deductible</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCategories.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-850/40 transition">
                    <td className="py-2.5 px-3 font-semibold text-slate-200">
                      {c.name}
                      {c.description && (
                        <span className="block text-[10px] text-slate-500 font-normal">{c.description}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                      {c.code || '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium border border-slate-700/60">
                        {c.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px]">
                      {c.isAllowableTaxDeduction ? (
                        <span className="text-emerald-400 font-medium">Yes (Allowable)</span>
                      ) : (
                        <span className="text-slate-500">No</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          c.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditCat(c)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[10px] font-medium border border-slate-700/60 transition cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3 text-amber-400" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteCat(c)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition cursor-pointer border border-slate-700/60"
                          title="Delete or deactivate head"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add Category Head */}
      {showAddCatModal && (
        <ModalPortal isOpen={showAddCatModal} onClose={() => setShowAddCatModal(false)} zIndex="z-[9999]">
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Tags className="w-4 h-4 text-emerald-400" />
                <span>Add Nominal Head Category</span>
              </h2>
              <button onClick={() => setShowAddCatModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {addCatError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {addCatError}
              </div>
            )}

            <form onSubmit={handleAddCatSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Head Name</label>
                <input
                  type="text"
                  required
                  value={addCatForm.name}
                  onChange={(e) => setAddCatForm({ ...addCatForm, name: e.target.value })}
                  placeholder="e.g. Electrical Inspections & Testing"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Accounting Type</label>
                  <select
                    value={addCatForm.type}
                    onChange={(e) => setAddCatForm({ ...addCatForm, type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="OPERATING_EXPENSE">Operating Expense</option>
                    <option value="INCOME">Income / Sundry</option>
                    <option value="FINANCE_COST">Finance Cost</option>
                    <option value="CAPITAL_EXPENDITURE">Capital Expenditure</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Code (Optional)</label>
                  <input
                    type="text"
                    value={addCatForm.code}
                    onChange={(e) => setAddCatForm({ ...addCatForm, code: e.target.value.toUpperCase() })}
                    placeholder="ELEC-01"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono uppercase text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={addCatForm.description}
                  onChange={(e) => setAddCatForm({ ...addCatForm, description: e.target.value })}
                  placeholder="Periodic EICR certification and urgent repairs"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="addCatTax"
                  checked={addCatForm.isAllowableTaxDeduction}
                  onChange={(e) => setAddCatForm({ ...addCatForm, isAllowableTaxDeduction: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 bg-slate-950 border-slate-800 cursor-pointer"
                />
                <label htmlFor="addCatTax" className="text-slate-300 cursor-pointer">
                  Allowable UK HMRC Tax Deduction
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addCatSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {addCatSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Head</span>
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Modal: Edit Category Head */}
      {editingCat && (
        <ModalPortal isOpen={Boolean(editingCat)} onClose={() => setEditingCat(null)} zIndex="z-[9999]">
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Edit Category Head</h2>
                  <p className="text-[11px] text-slate-400">Rename or change accounting parameters</p>
                </div>
              </div>
              <button
                onClick={() => setEditingCat(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editCatError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {editCatError}
              </div>
            )}

            <form onSubmit={handleEditCatSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Head Name</label>
                <input
                  type="text"
                  required
                  value={editCatForm.name}
                  onChange={(e) => setEditCatForm({ ...editCatForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Accounting Type</label>
                  <select
                    value={editCatForm.type}
                    onChange={(e) => setEditCatForm({ ...editCatForm, type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="OPERATING_EXPENSE">Operating Expense</option>
                    <option value="INCOME">Income / Sundry</option>
                    <option value="FINANCE_COST">Finance Cost</option>
                    <option value="CAPITAL_EXPENDITURE">Capital Expenditure</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Code</label>
                  <input
                    type="text"
                    value={editCatForm.code}
                    onChange={(e) => setEditCatForm({ ...editCatForm, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono uppercase text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={editCatForm.description}
                  onChange={(e) => setEditCatForm({ ...editCatForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editCatTax"
                    checked={editCatForm.isAllowableTaxDeduction}
                    onChange={(e) => setEditCatForm({ ...editCatForm, isAllowableTaxDeduction: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 bg-slate-950 border-slate-800 cursor-pointer"
                  />
                  <label htmlFor="editCatTax" className="text-slate-300 cursor-pointer">
                    Allowable UK HMRC Tax Deduction
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editCatActive"
                    checked={editCatForm.isActive}
                    onChange={(e) => setEditCatForm({ ...editCatForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 bg-slate-950 border-slate-800 cursor-pointer"
                  />
                  <label htmlFor="editCatActive" className="text-slate-300 cursor-pointer">
                    Head is Active
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCat(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editCatSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {editCatSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UK Localization Parameters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Landmark className="w-4 h-4 text-indigo-400" />
          <span>UK Localization & Accounting Rules</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-400">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <span className="font-semibold text-slate-200 block">Currency & Formatting</span>
            <p className="text-slate-400">British Pounds Sterling (£) with standard en-GB number parsing and format.</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <span className="font-semibold text-slate-200 block">Date Convention</span>
            <p className="text-slate-400">DD/MM/YYYY formatting applied across all views, invoices, and ledgers.</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <span className="font-semibold text-slate-200 block">HMRC Financial Year</span>
            <p className="text-slate-400">6 April to 5 April statutory personal tax year with Section 24 mortgage relief.</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <span className="font-semibold text-slate-200 block">Double-Entry Accounting</span>
            <p className="text-slate-400">Bank Liquidity accounts separated from Nominal Category Heads. No fake clearing accounts.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
