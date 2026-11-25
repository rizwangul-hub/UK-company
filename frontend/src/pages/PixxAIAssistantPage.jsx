import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Plus,
  Send,
  Trash2,
  Building2,
  Wrench,
  FileSpreadsheet,
  Mail,
  BarChart3,
  MessageSquare,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { aiAPI } from '../services/api.js';
import { MarkdownRenderer } from '../components/ai/MarkdownRenderer.jsx';
import { ApprovalDialog } from '../components/ai/ApprovalDialog.jsx';
import { AIUsagePanel } from '../components/ai/AIUsagePanel.jsx';

const STARTER_PROMPTS = [
  'Show me total actual income and expenses across all 6 companies this month.',
  'List all tenants with outstanding rent arrears.',
  'Compare bank balances across OLD STREET, BEST STANDARD, and SK HAMILTON.',
  'Check the latest uploaded bank statement reconciliation for this company.',
];

export function PixxAIAssistantPage({ selectedCompany }) {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companyContext, setCompanyContext] = useState(selectedCompany?.slug || 'ALL');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [error, setError] = useState('');
  const [pendingApprovals, setPendingApprovals] = useState({});
  const [showUsageTab, setShowUsageTab] = useState(false);
  const [usageStats, setUsageStats] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const messagesEndRef = useRef(null);

  const loadConversations = async () => {
    try {
      const res = await aiAPI.getConversations();
      if (res?.success) {
        setConversations(res.data.conversations || []);
        setCompanies(res.data.companies || []);
      }
    } catch (err) {
      console.error('Failed to load AI conversations:', err);
    }
  };

  const loadApprovals = async () => {
    try {
      const res = await aiAPI.getPendingApprovals();
      if (res?.success && Array.isArray(res.data.approvals)) {
        const map = {};
        for (const a of res.data.approvals) {
          map[a._id] = a;
        }
        setPendingApprovals((prev) => ({ ...prev, ...map }));
      }
    } catch {
      /* Ignore */
    }
  };

  useEffect(() => {
    loadConversations();
    loadApprovals();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSelectConversation = async (convId) => {
    setShowUsageTab(false);
    setActiveConvId(convId);
    setLoadingConv(true);
    setError('');
    try {
      const res = await aiAPI.getConversation(convId);
      if (res?.success) {
        setMessages(res.data.messages || []);
        if (res.data.conversation?.companyContext) {
          setCompanyContext(res.data.conversation.companyContext);
        }
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load conversation.');
    } finally {
      setLoadingConv(false);
    }
  };

  const handleNewConversation = () => {
    setShowUsageTab(false);
    setActiveConvId(null);
    setMessages([]);
    setError('');
  };

  const handleDeleteConversation = async (convId, e) => {
    e.stopPropagation();
    try {
      await aiAPI.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c._id !== convId));
      if (activeConvId === convId) {
        handleNewConversation();
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete conversation.');
    }
  };

  const handleOpenUsage = async () => {
    setShowUsageTab(true);
    setLoadingUsage(true);
    try {
      const res = await aiAPI.getUsage();
      if (res?.success) setUsageStats(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load AI usage stats.');
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleSend = async (promptText) => {
    const text = String(promptText ?? input).trim();
    if (!text || sending) return;

    setShowUsageTab(false);
    setError('');
    if (promptText === undefined) setInput('');

    const optimisticUserMsg = {
      _id: `tmp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);
    setSending(true);

    try {
      const res = await aiAPI.chat({
        conversationId: activeConvId,
        companyContext,
        message: text,
      });

      if (res?.success && res.data) {
        const { conversationId: returnedConvId, message: assistantMsg, approvalRequest } = res.data;
        if (!activeConvId && returnedConvId) {
          setActiveConvId(returnedConvId);
        }
        if (approvalRequest?._id) {
          setPendingApprovals((prev) => ({ ...prev, [approvalRequest._id]: approvalRequest }));
        }
        setMessages((prev) => [...prev, assistantMsg]);
        loadConversations();
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'AI request failed.');
    } finally {
      setSending(false);
    }
  };

  const handleApprove = async (approval) => {
    try {
      const res = await aiAPI.approveAction(approval._id, approval.approvalToken);
      if (res?.success) {
        setPendingApprovals((prev) => ({
          ...prev,
          [approval._id]: { ...approval, status: 'EXECUTED', executionResult: res.data.result },
        }));
        setMessages((prev) => [
          ...prev,
          {
            _id: `exec-${Date.now()}`,
            role: 'assistant',
            content: `**Approved & Executed:** ${approval.title}\n\nResult: \`${JSON.stringify(res.data.result)}\``,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Approval execution failed.');
    }
  };

  const handleReject = async (approval) => {
    try {
      await aiAPI.rejectAction(approval._id, approval.approvalToken);
      setPendingApprovals((prev) => ({
        ...prev,
        [approval._id]: { ...approval, status: 'REJECTED' },
      }));
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to reject action.');
    }
  };

  return (
    <div className="h-[calc(100vh-5.5rem)] flex rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm overflow-hidden">
      {/* Left Conversation Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-slate-50/70 flex flex-col shrink-0 hidden md:flex">
        <div className="p-3 border-b border-slate-200">
          <button
            type="button"
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Conversation</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map((conv) => {
            const isActive = conv._id === activeConvId && !showUsageTab;
            return (
              <div
                key={conv._id}
                onClick={() => handleSelectConversation(conv._id)}
                className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs cursor-pointer transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{conv.title || 'New Conversation'}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDeleteConversation(conv._id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  title="Delete conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
          {conversations.length === 0 && (
            <p className="text-[11px] text-slate-400 text-center py-6 px-3">
              No saved conversations yet. Start asking questions!
            </p>
          )}
        </div>

        <div className="p-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleOpenUsage}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              showUsageTab
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span>AI Usage &amp; Cost Dashboard</span>
          </button>
        </div>
      </aside>

      {/* Main Chat / Usage Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Top Header Bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900">PIXX AI ASSISTANT</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Gemini 3.5 Flash
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Verified UK Property &amp; Finance Intelligence · Safe Read &amp; Approval-Based Actions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <select
                value={companyContext}
                onChange={(e) => setCompanyContext(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All 6 Companies (Consolidated)</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleOpenUsage}
              className="md:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="AI Usage"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showUsageTab ? (
          <AIUsagePanel stats={usageStats} loading={loadingUsage} />
        ) : (
          <>
            {/* Message List */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-5 bg-white">
              {loadingConv ? (
                <div className="flex items-center justify-center py-12 text-slate-500 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Loading conversation...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="max-w-2xl mx-auto py-10 text-center space-y-6">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">How can I help with your UK portfolio today?</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Ask about rent arrears, company P&amp;L, bank reconciliation, property compliance, email drafts, or general questions.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                    {STARTER_PROMPTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleSend(p)}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-indigo-50/60 hover:border-indigo-200 text-xs text-slate-700 font-medium transition cursor-pointer"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const approvalObj = msg.approvalRequestId ? pendingApprovals[msg.approvalRequestId] : null;

                  return (
                    <div key={msg._id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-3xl rounded-2xl px-4 py-3 ${
                          isUser
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-50 border border-slate-200 text-slate-800 w-full'
                        }`}
                      >
                        {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2.5 pb-2 border-b border-slate-200">
                            {msg.toolCalls.map((tc, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-medium text-slate-600"
                              >
                                <Wrench className="w-3 h-3 text-indigo-600" />
                                <span>{tc.name}</span>
                                {tc.recordCount !== null && tc.recordCount !== undefined && (
                                  <span className="text-slate-400">({tc.recordCount})</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}

                        {isUser ? (
                          <p className="text-[13.5px] whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <MarkdownRenderer content={msg.content} />
                        )}

                        {/* Report Preview Card */}
                        {msg.reportPreview && (
                          <div className="mt-3 rounded-xl border border-indigo-200 bg-white p-3.5 text-xs space-y-2">
                            <div className="flex items-center gap-2 font-bold text-indigo-800">
                              <FileSpreadsheet className="w-4 h-4" />
                              <span>{msg.reportPreview.title}</span>
                              <span className="text-[10px] font-normal text-slate-500 ml-auto">
                                {msg.reportPreview.period} · {msg.reportPreview.currency}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                              {Object.entries(msg.reportPreview.metrics || {}).map(([k, v]) => (
                                <div key={k} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                                  <div className="text-[10px] text-slate-500">{k}</div>
                                  <div className="font-bold text-slate-900 tabular-nums">{String(v)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Email Preview Card */}
                        {msg.emailPreview && !approvalObj && (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3.5 text-xs space-y-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <Mail className="w-4 h-4 text-indigo-600" />
                              <span>Email Preview</span>
                            </div>
                            <div>
                              <span className="text-slate-500">To:</span> <strong>{msg.emailPreview.to}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500">Reply-To:</span> {msg.emailPreview.replyTo}
                            </div>
                            <div>
                              <span className="text-slate-500">Subject:</span> <strong>{msg.emailPreview.subject}</strong>
                            </div>
                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 whitespace-pre-wrap text-slate-700">
                              {msg.emailPreview.body}
                            </div>
                          </div>
                        )}

                        {/* Approval Dialog */}
                        {approvalObj && (
                          <ApprovalDialog
                            approval={approvalObj}
                            onApprove={handleApprove}
                            onReject={handleReject}
                          />
                        )}

                        {/* Timestamp & Token Footer */}
                        <div
                          className={`mt-2 flex items-center justify-between text-[10px] ${
                            isUser ? 'text-indigo-100' : 'text-slate-400'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                          {!isUser && msg.usage?.totalTokens > 0 && (
                            <span className="tabular-nums">
                              {msg.usage.totalTokens.toLocaleString()} tokens
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-4 py-3 bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    <span>Pixx AI is analysing verified company data...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Footer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50/60 shrink-0"
            >
              <div className="max-w-4xl mx-auto flex items-end gap-2">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask Pixx AI about expenses, rent arrears, bank reconciliation, emails, or general questions..."
                  className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Send</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default PixxAIAssistantPage;
