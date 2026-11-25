import React from 'react';
import { Activity, AlertTriangle, Cpu, DollarSign } from 'lucide-react';

export function AIUsagePanel({ stats, loading }) {
  if (loading) {
    return <div className="p-6 text-xs text-slate-500">Loading AI usage &amp; cost metrics...</div>;
  }
  if (!stats) {
    return <div className="p-6 text-xs text-slate-500">No usage statistics available yet.</div>;
  }

  const { daily = {}, monthly = {}, config = {}, monthlyAlertTriggered, recentLogs = [] } = stats;

  return (
    <div className="p-5 space-y-5 overflow-y-auto h-full bg-white text-slate-800">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">AI Usage &amp; Cost Control Dashboard</h3>
          <p className="text-xs text-slate-500">
            Model: <span className="font-mono font-semibold text-indigo-700">{config.model}</span> · Rate limit:{' '}
            {config.userRpmLimit} req/min · Max output: {config.maxOutputTokens} tokens
          </p>
        </div>
        {monthlyAlertTriggered && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
            <AlertTriangle className="w-3.5 h-3.5" />
            Monthly Spend Alert Reached
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
          <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
            Today&apos;s Requests
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{daily.requests || 0}</div>
          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {(daily.totalTokens || 0).toLocaleString()} tokens
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
          <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            Monthly Questions
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{monthly.requests || 0}</div>
          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            In: {(monthly.inputTokens || 0).toLocaleString()} · Out: {(monthly.outputTokens || 0).toLocaleString()}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
          <div className="text-[11px] text-slate-500 font-semibold">Monthly Total Tokens</div>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {(monthly.totalTokens || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            History window: {config.maxHistoryMessages} msgs
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
          <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            Est. Monthly Cost (USD)
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
            ${Number(monthly.estimatedCostUsd || 0).toFixed(4)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Alert threshold: ${config.monthlySpendAlertUsd}
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Recent AI Requests</h4>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Tools</th>
                <th className="px-3 py-2 text-right">Tokens</th>
                <th className="px-3 py-2 text-right">Est. Cost</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentLogs.map((log) => (
                <tr key={log._id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('en-GB')}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">{log.companyContext}</td>
                  <td className="px-3 py-2 text-slate-600 max-w-[220px] truncate">
                    {log.toolCallsPerformed?.length ? log.toolCallsPerformed.join(', ') : 'Direct answer'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {(log.totalTokens || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    ${Number(log.estimatedCostUsd || 0).toFixed(5)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        log.status === 'SUCCESS'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                    No AI requests logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AIUsagePanel;
