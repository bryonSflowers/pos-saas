"use client";

import Link from "next/link";

type Report = {
  shift: {
    id: string; status: string; opened_at: string; closed_at: string | null;
    opening_float: number; expected_cash: number | null;
    closing_cash: number | null; cash_variance: number | null; notes: string | null;
  };
  cashier_name: string;
  location_name: string;
  summary: {
    order_count: number; refund_count: number;
    gross_sales: number; total_discounts: number;
    promo_discounts: number; loyalty_discounts: number; item_discounts: number;
    tax_collected: number; net_sales: number; refund_total: number;
  };
  payments_by_method: Record<string, { total: number; count: number }>;
  top_products: { name: string; qty: number; revenue: number }[];
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", card: "Card / Tap", qr_code: "QR Code",
  voucher: "Voucher", split: "Split",
};

function Row({ label, value, bold, colored }: { label: string; value: string; bold?: boolean; colored?: "green" | "red" | "orange" }) {
  const colorClass = colored === "red" ? "text-red-600" : colored === "orange" ? "text-orange-500" : colored === "green" ? "text-green-600" : "";
  return (
    <div className={`flex justify-between py-1.5 border-b border-gray-100 text-sm ${bold ? "font-semibold" : ""}`}>
      <span className="text-gray-600">{label}</span>
      <span className={colorClass || (bold ? "text-gray-900" : "text-gray-800")}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{title}</h2>
      <div className="bg-white rounded-xl shadow-sm p-4">{children}</div>
    </div>
  );
}

export default function ZReportClient({ report }: { report: Report }) {
  const { shift, cashier_name, location_name, summary, payments_by_method, top_products } = report;

  function fmt(n: number) { return `$${n.toFixed(2)}`; }
  function fmtDate(s: string) { return new Date(s).toLocaleString(); }

  const variance = shift.cash_variance;
  const varianceColor = variance === null ? undefined : variance < 0 ? "red" : variance > 0 ? "orange" : "green";

  const generatedAt = new Date().toLocaleString();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Screen-only toolbar */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href="/shifts" className="text-sm text-gray-500 hover:text-gray-900">← Back to Shifts</Link>
        <span className="flex-1" />
        <button onClick={() => window.print()}
          className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800">
          Print / Save PDF
        </button>
      </div>

      {/* Report body */}
      <div className="max-w-2xl mx-auto p-6 print:p-0 print:max-w-none">

        {/* Header */}
        <div className="text-center mb-8 print:mb-6">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Z-Report</h1>
          <p className="text-sm text-gray-500 mt-1">End-of-Shift Financial Summary</p>
          <p className="text-xs text-gray-400 mt-0.5">Generated {generatedAt}</p>
        </div>

        <Section title="Shift Info">
          <Row label="Location" value={location_name} />
          <Row label="Cashier" value={cashier_name} />
          <Row label="Opened" value={fmtDate(shift.opened_at)} />
          <Row label="Closed" value={shift.closed_at ? fmtDate(shift.closed_at) : "Still open"} />
          <Row label="Status" value={shift.status.toUpperCase()} bold />
        </Section>

        <Section title="Sales Summary">
          <Row label="Total Orders" value={String(summary.order_count)} />
          <Row label="Gross Sales" value={fmt(summary.gross_sales)} />
          {summary.promo_discounts > 0 && <Row label="  Promo Discounts" value={`−${fmt(summary.promo_discounts)}`} />}
          {summary.loyalty_discounts > 0 && <Row label="  Loyalty Discounts" value={`−${fmt(summary.loyalty_discounts)}`} />}
          {summary.item_discounts > 0 && <Row label="  Item Discounts" value={`−${fmt(summary.item_discounts)}`} />}
          {summary.total_discounts > 0 && <Row label="Total Discounts" value={`−${fmt(summary.total_discounts)}`} />}
          <Row label="Tax Collected" value={fmt(summary.tax_collected)} />
          {summary.refund_count > 0 && (
            <Row label={`Refunds (${summary.refund_count})`} value={`−${fmt(summary.refund_total)}`} />
          )}
          <div className="mt-2 pt-2 border-t-2 border-gray-200">
            <Row label="Net Sales" value={fmt(summary.net_sales)} bold />
          </div>
        </Section>

        <Section title="Payments by Method">
          {Object.keys(payments_by_method).length === 0
            ? <p className="text-sm text-gray-400">No payments recorded.</p>
            : Object.entries(payments_by_method).map(([method, data]) => (
              <Row
                key={method}
                label={`${METHOD_LABELS[method] ?? method} (${data.count} txn)`}
                value={fmt(data.total)}
              />
            ))
          }
        </Section>

        <Section title="Cash Reconciliation">
          <Row label="Opening Float" value={fmt(shift.opening_float)} />
          <Row label="Expected Cash" value={shift.expected_cash != null ? fmt(shift.expected_cash) : "—"} />
          <Row label="Actual Cash" value={shift.closing_cash != null ? fmt(shift.closing_cash) : "—"} />
          <div className="mt-2 pt-2 border-t-2 border-gray-200">
            <Row
              label="Variance"
              value={variance != null ? `${variance >= 0 ? "+" : ""}${fmt(variance)}` : "—"}
              bold
              colored={varianceColor}
            />
          </div>
          {shift.notes && (
            <p className="text-xs text-gray-500 mt-3 italic">Note: {shift.notes}</p>
          )}
        </Section>

        {top_products.length > 0 && (
          <Section title="Top Products">
            {top_products.map((p, i) => (
              <div key={i} className="flex justify-between py-1.5 border-b border-gray-100 text-sm">
                <span className="text-gray-700">
                  <span className="text-gray-400 font-mono mr-2">{i + 1}.</span>
                  {p.name}
                </span>
                <span className="text-gray-500">{p.qty} × <span className="text-gray-900 font-medium">{fmt(p.revenue)}</span></span>
              </div>
            ))}
          </Section>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-8 print:mt-4">
          <p>POS SaaS — Shift ID: {shift.id.slice(0, 8).toUpperCase()}</p>
          <p className="mt-0.5">This is an official Z-Report. Keep for your records.</p>
        </div>
      </div>
    </div>
  );
}
