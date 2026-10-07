"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  ClipboardList,
  PackageOpen,
  Search,
} from "lucide-react";

type Status = "Pending" | "Complete" | "Reject";

type PublicInvoice = {
  id: string;
  invoice: string;
  supplier: string;
  status: Status;
  startDate: string | null;
  completeDate: string | null;
};

// UI preview only. Replace with the restricted public API response later.
const sampleInvoices: PublicInvoice[] = [
  {
    id: "demo-1",
    invoice: "DEMO-001",
    supplier: "Sample Supplier A",
    status: "Pending",
    startDate: "2026-10-07",
    completeDate: null,
  },
  {
    id: "demo-2",
    invoice: "DEMO-002",
    supplier: "Sample Supplier B",
    status: "Complete",
    startDate: "2026-10-06",
    completeDate: "2026-10-07",
  },
  {
    id: "demo-3",
    invoice: "DEMO-003",
    supplier: "Sample Supplier C",
    status: "Reject",
    startDate: "2026-10-05",
    completeDate: null,
  },
  {
    id: "demo-4",
    invoice: "DEMO-004",
    supplier: "Sample Supplier A",
    status: "Pending",
    startDate: null,
    completeDate: null,
  },
];

const statusStyles: Record<Status, string> = {
  Pending: "border-amber-200 bg-amber-50 text-amber-800",
  Complete: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Reject: "border-rose-200 bg-rose-50 text-rose-800",
};

function formatDate(value: string | null) {
  if (!value) return "—";

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default function PublicDashboard() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const query = search.trim().toLowerCase();

  const filteredInvoices = sampleInvoices.filter((item) => {
    const matchesSearch =
      item.invoice.toLowerCase().includes(query) ||
      item.supplier.toLowerCase().includes(query);

    const matchesStatus = status === "All" || item.status === status;

    return matchesSearch && matchesStatus;
  });

  const summaries = [
    {
      label: "Total invoices",
      value: sampleInvoices.length,
      detail: "All recorded tasks",
    },
    {
      label: "Pending",
      value: sampleInvoices.filter((item) => item.status === "Pending").length,
      detail: "Awaiting completion",
    },
    {
      label: "Complete",
      value: sampleInvoices.filter((item) => item.status === "Complete").length,
      detail: "Tasks completed",
    },
    {
      label: "Reject",
      value: sampleInvoices.filter((item) => item.status === "Reject").length,
      detail: "Tasks marked rejected",
    },
  ];

  function clearFilters() {
    setSearch("");
    setStatus("All");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-blue-700 text-white">
              <PackageOpen className="size-6" aria-hidden="true" />
            </div>

            <div>
              <p className="text-sm font-bold tracking-wide">EFL · 3PL</p>
              <p className="text-xs text-slate-500">CSS Division</p>
            </div>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800">
            Sign In
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-8 sm:py-10">
        <section
          aria-label="Preview notice"
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
        >
          <strong>Design preview:</strong> Sample records only. Sign in to access
          your workspace. Live public invoice data will be connected next.
        </section>

        <section>
          <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-blue-700">
            OPERATIONS OVERVIEW
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Unloading Tracker
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            View invoice progress, supplier details and completion dates in one
            place.
          </p>
        </section>

        <section
          aria-label="Summary of all sample invoices"
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          {summaries.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <p className="text-sm font-medium text-slate-500">
                {item.label}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {item.value}
              </p>
              <p className="mt-2 text-xs text-slate-500">{item.detail}</p>
            </div>
          ))}
        </section>

        <section
          aria-labelledby="invoice-list-title"
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
            <div>
              <h2 id="invoice-list-title" className="font-semibold">
                Invoice overview
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Search invoices and follow their current status.
              </p>
            </div>

            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
              Read-only access
            </span>
          </div>

          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-end sm:px-6">
            <div className="flex-1">
              <label
                htmlFor="invoice-search"
                className="mb-2 block text-xs font-medium text-slate-600"
              >
                Search invoices
              </label>

              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="invoice-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by invoice or supplier..."
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-100"
                />
              </div>
            </div>

            <div className="sm:w-48">
              <label
                htmlFor="status-filter"
                className="mb-2 block text-xs font-medium text-slate-600"
              >
                Status
              </label>
              <select
                id="status-filter"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-100"
              >
                <option value="All">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="Complete">Complete</option>
                <option value="Reject">Reject</option>
              </select>
            </div>
          </div>

          <div
            role="region"
            aria-label="Invoice results table"
            tabIndex={0}
            className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">
                Sample invoices with suppliers, statuses and processing dates
              </caption>
              <thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  {[
                    "Invoice",
                    "Supplier",
                    "Status",
                    "Start Date",
                    "Complete Date",
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-6 py-3.5 font-medium"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <th
                      scope="row"
                      className="whitespace-nowrap px-6 py-5 font-semibold text-blue-700"
                    >
                      {item.invoice}
                    </th>
                    <td className="px-6 py-5">{item.supplier}</td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[item.status]}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-slate-600">
                      {formatDate(item.startDate)}
                    </td>
                    <td className="px-6 py-5 text-slate-600">
                      {formatDate(item.completeDate)}
                    </td>
                  </tr>
                ))}

                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-14 text-center">
                      <ClipboardList
                        className="mx-auto mb-3 size-8 text-slate-400"
                        aria-hidden="true"
                      />
                      <p className="font-medium">No matching invoices</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Try another invoice, supplier or status.
                      </p>
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-4 rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div
            aria-live="polite"
            aria-atomic="true"
            className="border-t border-slate-200 px-6 py-4 text-xs text-slate-500"
          >
            Showing {filteredInvoices.length} of {sampleInvoices.length} sample
            invoices
          </div>
        </section>

        <footer className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
          <p>EFL · 3PL — CSS Division</p>
          <p>Unloading Tracker Dashboard</p>
        </footer>
      </main>
    </div>
  );
}