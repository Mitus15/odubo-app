'use client';

import { useState, useEffect, useRef } from 'react';
import type { ReportType, ReportData, BiReport } from '@/types/bi';

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getWeekDates(): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek - 6); // Last week's Sunday
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Last week's Saturday

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export default function ReportsTab() {
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [generating, setGenerating] = useState(false);
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);
  const [pastReports, setPastReports] = useState<BiReport[]>([]);
  const [loadingPast, setLoadingPast] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set default dates to last week
    const { start, end } = getWeekDates();
    setPeriodStart(start);
    setPeriodEnd(end);

    // Fetch past reports
    fetch('/api/bi/reports?limit=10')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPastReports(data.reports || []);
        }
      })
      .finally(() => setLoadingPast(false));
  }, []);

  const handleGenerate = async () => {
    if (!periodStart || !periodEnd) {
      alert('Please select a date range');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/bi/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: reportType,
          period_start: periodStart,
          period_end: periodEnd,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentReport(data.report);
        // Refresh past reports
        const listRes = await fetch('/api/bi/reports?limit=10');
        const listData = await listRes.json();
        if (listData.success) {
          setPastReports(listData.reports || []);
        }
      } else {
        alert(data.error || 'Failed to generate report');
      }
    } catch (e) {
      console.error('Failed to generate report:', e);
      alert('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center print:hidden">
        <h2 className="text-2xl font-bold text-[#ede8df]">Business Reports</h2>
        {currentReport && (
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm font-medium bg-[#ede8df] text-[#171616] rounded-lg hover:bg-white transition-colors"
          >
            Print Report
          </button>
        )}
      </div>

      {/* Report Generator */}
      <div className="bg-[#1c1a19] rounded-xl border border-[#502d26]/30 p-6 print:hidden">
        <h3 className="text-lg font-semibold text-[#ede8df] mb-4">Generate Report</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-[#b2a491] mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df]"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-[#b2a491] mb-1">Start Date</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df]"
            />
          </div>
          <div>
            <label className="block text-sm text-[#b2a491] mb-1">End Date</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df]"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Current Report */}
      {currentReport && (
        <div
          ref={reportRef}
          className="bg-white text-black rounded-xl border overflow-hidden print:rounded-none print:border-0"
        >
          {/* Report Header */}
          <div className="bg-gradient-to-r from-[#171616] to-[#302927] text-white p-8 print:bg-black">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">ODUBO STUDIO</h1>
              <h2 className="text-xl opacity-80">
                {reportType.charAt(0).toUpperCase() + reportType.slice(1)} Business Report
              </h2>
              <p className="text-sm opacity-60 mt-2">
                {formatDate(currentReport.period.start)} — {formatDate(currentReport.period.end)}
              </p>
            </div>
          </div>

          <div className="p-8 space-y-8">
            {/* Financial Summary */}
            <section>
              <h3 className="text-xl font-bold mb-4 border-b pb-2">Financial Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Revenue</div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(currentReport.financial.revenue.total_cents)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {currentReport.financial.revenue.order_count} orders
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">COGS</div>
                  <div className="text-2xl font-bold text-red-500">
                    -{formatCurrency(currentReport.financial.cogs.total_cents)}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Gross Profit</div>
                  <div className={`text-2xl font-bold ${currentReport.financial.gross_profit_cents >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatCurrency(currentReport.financial.gross_profit_cents)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {currentReport.financial.gross_margin_percent.toFixed(1)}% margin
                  </div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg border-2 border-emerald-200">
                  <div className="text-sm text-gray-600">Net Profit</div>
                  <div className={`text-2xl font-bold ${currentReport.financial.net_profit_cents >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatCurrency(currentReport.financial.net_profit_cents)}
                  </div>
                </div>
              </div>

              {/* Expenses Breakdown */}
              {currentReport.financial.expenses.by_category.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Expenses by Category</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {currentReport.financial.expenses.by_category.map((cat) => (
                      <div key={cat.category} className="bg-gray-50 p-3 rounded text-sm">
                        <div className="capitalize text-gray-600">{cat.category.replace('_', ' ')}</div>
                        <div className="font-semibold">{formatCurrency(cat.total_cents)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Social Growth */}
            <section>
              <h3 className="text-xl font-bold mb-4 border-b pb-2">Social Media Growth</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {currentReport.social.platforms.map((p) => (
                  <div key={p.platform} className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 capitalize">{p.platform.replace('_', ' ')}</div>
                    <div className="text-xl font-bold">{formatNumber(p.followers)}</div>
                    <div className={`text-sm ${p.growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {p.growth >= 0 ? '+' : ''}{formatNumber(p.growth)} ({p.growth_percent.toFixed(1)}%)
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Audience:</span>{' '}
                  <span className="font-semibold">{formatNumber(currentReport.social.total_followers)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Growth:</span>{' '}
                  <span className={`font-semibold ${currentReport.social.total_growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {currentReport.social.total_growth >= 0 ? '+' : ''}{formatNumber(currentReport.social.total_growth)}
                  </span>
                </div>
                {currentReport.social.top_performer && (
                  <div>
                    <span className="text-gray-600">Top Performer:</span>{' '}
                    <span className="font-semibold capitalize">{currentReport.social.top_performer.replace('_', ' ')}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Content Performance */}
            <section>
              <h3 className="text-xl font-bold mb-4 border-b pb-2">Content Performance</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Clips Published</div>
                  <div className="text-2xl font-bold">{currentReport.content.clips_published}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Total Views</div>
                  <div className="text-2xl font-bold">{formatNumber(currentReport.content.total_views)}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Completions</div>
                  <div className="text-2xl font-bold">{formatNumber(currentReport.content.total_completions)}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Completion Rate</div>
                  <div className="text-2xl font-bold">{currentReport.content.completion_rate.toFixed(1)}%</div>
                </div>
              </div>
            </section>

            {/* Advertising */}
            {currentReport.advertising.total_spend_cents > 0 && (
              <section>
                <h3 className="text-xl font-bold mb-4 border-b pb-2">Advertising Performance</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Total Spend</div>
                    <div className="text-2xl font-bold text-red-500">
                      {formatCurrency(currentReport.advertising.total_spend_cents)}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Impressions</div>
                    <div className="text-2xl font-bold">{formatNumber(currentReport.advertising.total_impressions)}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Clicks</div>
                    <div className="text-2xl font-bold">{formatNumber(currentReport.advertising.total_clicks)}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Conversions</div>
                    <div className="text-2xl font-bold text-emerald-600">{formatNumber(currentReport.advertising.total_conversions)}</div>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-lg border-2 border-emerald-200">
                    <div className="text-sm text-gray-600">ROAS</div>
                    <div className={`text-2xl font-bold ${(currentReport.advertising.overall_roas || 0) >= 1 ? 'text-emerald-600' : 'text-amber-500'}`}>
                      {currentReport.advertising.overall_roas !== null
                        ? `${currentReport.advertising.overall_roas.toFixed(2)}x`
                        : '—'}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Footer */}
            <div className="text-center text-xs text-gray-400 pt-8 border-t">
              Generated on {new Date(currentReport.generated_at).toLocaleString('en-CA')} • ODUBO STUDIO Business Intelligence
            </div>
          </div>
        </div>
      )}

      {/* Past Reports */}
      <div className="bg-[#1c1a19] rounded-xl border border-[#502d26]/30 overflow-hidden print:hidden">
        <div className="p-4 border-b border-[#502d26]/30">
          <h3 className="text-lg font-semibold text-[#ede8df]">Past Reports</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#302927]/40 text-[#b2a491]">
              <tr>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Period</th>
                <th className="p-4 font-medium">Generated</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#502d26]/30">
              {loadingPast ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[#b2a491]">Loading...</td>
                </tr>
              ) : pastReports.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[#b2a491]">No reports generated yet.</td>
                </tr>
              ) : (
                pastReports.map((report) => (
                  <tr key={report.id} className="hover:bg-[#302927]/20">
                    <td className="p-4 capitalize text-[#ede8df]">{report.report_type}</td>
                    <td className="p-4 text-[#b2a491]">
                      {formatDate(report.period_start)} — {formatDate(report.period_end)}
                    </td>
                    <td className="p-4 text-[#b2a491]">{formatDate(report.generated_at)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        report.status === 'ready'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {report.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
