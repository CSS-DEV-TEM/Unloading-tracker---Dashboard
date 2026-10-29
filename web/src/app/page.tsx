import Image from "next/image";
import Link from "next/link";
import Form from "next/form";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowRight,
  CircleCheck,
  CircleX,
  Clock3,
  Eye,
  FileText,
  Search,
} from "lucide-react";

import ThemeToggle from "@/components/theme-toggle";
import OverviewRefresh from "@/components/overview-refresh";
import PendingReasonDialog from "@/components/pending-reason-dialog";
import VehicleLabel from "@/components/vehicle-label";
import { createClient as createSessionClient } from "@/lib/supabase/server";

type SearchParams = {
  q?: string | string[];
  status?: string | string[];
  system?: string | string[];
  page?: string | string[];
};

type Props = {
  searchParams: Promise<SearchParams>;
};

type InvoiceStatus = "Pending" | "Complete" | "Reject";

type PublicInvoice = {
  id: string;
  invoice_number: string;
  supplier: string;
  vehicle_number: string | null;
  vehicle_received_date: string | null;
  system_type: string;
  shipment_type: string;
  document_share_date: string | null;
  roll_quantity: number | null;
  meter_quantity: number | null;
  status: InvoiceStatus;
  pending_reason: string | null;
  remark: string | null;
  started_at: string | null;
  completed_at: string | null;
  asn_share_at: string | null;
  stages: {
    system_name: string;
    started_at: string | null;
    ended_at: string | null;
    is_done: boolean;
    assigned_user_name: string | null;
  }[];
  asn: {
    is_shared: boolean;
    share_date: string | null;
    assigned_user_name: string | null;
  } | null;
};

type Overview = {
  total: number;
  items: PublicInvoice[];
};

type PublicSummary = {
  total: number;
  pending: number;
  completed: number;
  rejected: number;
};

const PAGE_SIZE = 20;

const HEADINGS = [
  "Invoice",
  "Supplier",
  "System",
  "Shipment",
  "Document date",
  "Roll quantity",
  "Start date",
  "Completion date",
  "Status",
  "Processing",
];

const statusLabels: Record<InvoiceStatus, string> = {
  Pending: "Pending",
  Complete: "Completed",
  Reject: "Rejected",
};

const statusStyles: Record<InvoiceStatus, string> = {
  Pending:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  Complete:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  Reject:
    "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
};

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 " +
  "text-sm text-foreground outline-none focus:border-blue-600 " +
  "focus:ring-2 focus:ring-ring/25";

const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg " +
  "border border-input bg-card px-4 text-sm font-medium " +
  "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring";

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function overviewUrl(
  q: string,
  status: string,
  page: number,
  system: string,
) {
  const params = new URLSearchParams();

  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (system) params.set("system", system);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();

  return query ? `/?${query}` : "/";
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

function formatMeters(value: number | null) {
  return value == null
    ? "—"
    : Number(value).toLocaleString("en-GB", {
      maximumFractionDigits: 3,
    });
}

function DateTime({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-muted-foreground">—</span>;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return <span className="text-muted-foreground">—</span>;
  }

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);
  return (
    <time dateTime={date.toISOString()} title={`${dateLabel}, ${timeLabel} — Sri Lanka time`}
      className="inline-flex flex-col gap-1 whitespace-nowrap tabular-nums">
      <span>{dateLabel}</span>
      <span className="text-[10px] text-muted-foreground">{timeLabel} · SLST</span>
    </time>
  );
}

function ProcessingDetails({ invoice }: { invoice: PublicInvoice }) {
  const stages = invoice.stages ?? [];

  return (
    <details className="group/details min-w-0">
      <summary className="cursor-pointer rounded-lg px-1 py-2 text-[11px] font-medium text-blue-700 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-blue-400">
        <span className="group-open/details:hidden">View progress</span>
        <span className="hidden group-open/details:inline">Hide progress</span>
        <span className="sr-only">
          {" "}for invoice {invoice.invoice_number}
        </span>
      </summary>

      <div className="mt-1 w-full min-w-0 [overflow-wrap:anywhere] divide-y divide-border rounded-lg border border-border bg-background text-[11px]">
        {stages.length === 0 ? (
          <p className="p-1.5 text-muted-foreground">
            Processing details unavailable.
          </p>
        ) : (
          stages.map((stage) => (
            <section key={stage.system_name} className="p-1.5">
              <div className="flex flex-col items-start gap-1">
                <h3 className="font-semibold">
                  {stage.system_name} Pre-GRN
                </h3>
                <span className="text-muted-foreground">
                  {stage.is_done
                    ? "Done"
                    : stage.started_at
                      ? "In progress"
                      : "Not started"}
                </span>
              </div>

              <dl className="mt-2 grid grid-cols-1 gap-y-1">
                <dt className="text-muted-foreground">Started</dt>
                <dd className="text-left">
                  <DateTime value={stage.started_at} />
                </dd>

                <dt className="text-muted-foreground">Ended</dt>
                <dd className="text-left">
                  <DateTime value={stage.ended_at} />
                </dd>

                <dt className="text-muted-foreground">
                  {stage.system_name} user
                </dt>
                <dd className="min-w-0 text-left font-medium [overflow-wrap:anywhere]">
                  {stage.assigned_user_name?.trim() || "Not assigned"}
                </dd>
              </dl>
            </section>
          ))
        )}

        <section className="p-1.5">
          <div className="flex flex-col items-start gap-1">
            <h3 className="font-semibold">ASN update</h3>
            <span className="text-muted-foreground">
              {!invoice.asn
                ? "Unavailable"
                : invoice.asn.is_shared
                  ? "Shared"
                  : "Not shared"}
            </span>
          </div>

          <dl className="mt-2 grid grid-cols-1 gap-y-1">
            <dt className="text-muted-foreground">Share date</dt>
            <dd className="text-left tabular-nums">
              {formatDate(invoice.asn?.share_date ?? null)}
            </dd>

            <dt className="text-muted-foreground">ASN user</dt>
            <dd className="min-w-0 text-left font-medium [overflow-wrap:anywhere]">
              {invoice.asn?.assigned_user_name?.trim() || "—"}
            </dd>
          </dl>
        </section>
      </div>
    </details>
  );
}

async function PublicOverview({ searchParams }: Props) {
  await connection();

  const sessionClient = await createSessionClient();

  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  let canOpenDashboard = false;

  if (user) {
    const { data: profile, error: profileError } = await sessionClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    canOpenDashboard =
      !profileError &&
      profile?.is_active === true &&
      ["ADMIN", "USER"].includes(profile.role);
  }

  const params = await searchParams;
  const q = single(params.q).trim().slice(0, 100);

  const requestedStatus = single(params.status);
  const status = ["Pending", "Complete", "Reject"].includes(requestedStatus)
    ? requestedStatus
    : "";

  const requestedSystem = single(params.system);
  const system = ["AX", "D365", "AX/D365"].includes(requestedSystem)
    ? requestedSystem
    : "";

  const requestedPage = Number(single(params.page) || "1");
  const page =
    Number.isSafeInteger(requestedPage) &&
      requestedPage >= 1 &&
      requestedPage <= 100000
      ? requestedPage
      : 1;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Public overview is not configured.");
  }

  // Public read-only client. Do not use an admin secret here.
  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const [overviewResult, summaryResult] = await Promise.all([
    supabase.rpc("get_public_invoice_overview_v6", {
      p_search: q,
      p_status: status,
      p_page: page,
      p_system: system,
    }),
    supabase.rpc("get_public_invoice_summary"),
  ]);

  const overview = overviewResult.data as Overview | null;
  const summary = summaryResult.data as PublicSummary | null;

  const failed = Boolean(overviewResult.error) || !overview;
  const summaryFailed = Boolean(summaryResult.error) || !summary;

  const items = overview?.items ?? [];
  const total = overview?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = (page - 1) * PAGE_SIZE;
  const hasFilters = Boolean(q || status || system);

  if (!failed && page > totalPages) {
    redirect(overviewUrl(q, status, totalPages, system));
  }

  const summaryCards = [
    {
      label: "Total invoices",
      value: summary?.total,
      icon: FileText,
      filter: "",
      iconClass:
        "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300",
      bar: "bg-primary",
    },
    {
      label: "Pending",
      value: summary?.pending,
      icon: Clock3,
      filter: "Pending",
      iconClass:
        "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
      bar: "bg-amber-500",
    },
    {
      label: "Completed",
      value: summary?.completed,
      icon: CircleCheck,
      filter: "Complete",
      iconClass:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
      bar: "bg-emerald-500",
    },
    {
      label: "Rejected",
      value: summary?.rejected,
      icon: CircleX,
      filter: "Reject",
      iconClass:
        "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300",
      bar: "bg-rose-500",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#public-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-lg bg-blue-700 px-4 py-3 text-white focus:not-sr-only"
      >
        Skip to invoice overview
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            aria-label="EFL 3PL Unloading Tracker overview"
            className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Image
              src="/efl-logo.png"
              alt=""
              width={40}
              height={40}
              unoptimized
              className="size-10 shrink-0 object-contain"
            />

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">
                Unloading Tracker
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                EFL 3PL · CSS Division
              </p>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              href={canOpenDashboard ? "/dashboard" : "/login"}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {canOpenDashboard ? "Back to dashboard" : "Sign in"}
              <ArrowRight
                aria-hidden="true"
                className="hidden size-4 sm:block"
              />
            </Link>
          </div>
        </div>
      </header>

      <main
        id="public-content"
        tabIndex={-1}
        className="mx-auto max-w-[1600px] scroll-mt-20 space-y-6 px-4 py-6 outline-none sm:px-6"
      >
        <section
          aria-labelledby="overview-title"
          className="flex flex-wrap items-start justify-between gap-4"
        >
          <div className="max-w-2xl">
            <h1
              id="overview-title"
              className="text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Unloading Tracker Dashboard Overview
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Find an invoice, check its status and follow
              processing progress in one place.
            </p>
          </div>

          <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-card">
            <Eye aria-hidden="true" className="size-4" />
            Read-only access
          </span>
        </section>

        <section aria-labelledby="summary-title" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="summary-title" className="text-sm font-semibold">
              Invoice summary
            </h2>
            <p className="text-xs text-muted-foreground">
              All time · Independent of table filters
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summaryCards.map(
              ({ label, value, icon: Icon, filter, iconClass, bar }) => {
                const active = status === filter;

                return (
                  <Link
                    key={label}
                    href={overviewUrl(q, filter, 1, system)}
                    scroll={false}
                    aria-current={active ? "true" : undefined}
                    aria-label={
                      filter
                        ? `Filter invoices: ${label}`
                        : "Show all statuses"
                    }
                    className={[
                      "relative flex min-h-24 items-center justify-between gap-3 overflow-hidden rounded-xl border py-4 pl-5 pr-4 shadow-card transition-shadow hover:shadow-raised",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                      active
                        ? "border-primary bg-blue-50/60 ring-1 ring-primary dark:bg-blue-400/10"
                        : "border-border bg-card",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 left-0 w-1 ${bar}`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        {label}
                      </p>
                      <p className="mt-1.5 font-heading text-3xl font-semibold tracking-tight tabular-nums">
                        {summaryFailed
                          ? "—"
                          : (value ?? 0).toLocaleString("en-GB")}
                      </p>
                    </div>

                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
                    >
                      <Icon aria-hidden="true" className="size-4" />
                    </div>
                  </Link>
                );
              },
            )}
          </div>

          {summaryFailed && (
            <p role="alert" className="text-sm text-muted-foreground">
              Summary counts are temporarily unavailable.
            </p>
          )}
        </section>

        <div className="flex justify-end">
          <OverviewRefresh />
        </div>

        <section
          aria-labelledby="invoice-list-title"
          className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
            <div>
              <h2 id="invoice-list-title" className="font-semibold">
                Invoice overview
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Dates and times use Sri Lanka time (UTC+05:30).
              </p>
            </div>

            {!failed && (
              <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold">
                {total.toLocaleString("en-GB")} results
              </span>
            )}
          </div>

          <Form
            action="/"
            scroll={false}
            role="search"
            aria-label="Search public invoices"
            className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-[minmax(220px,1fr)_160px_160px_auto_auto] lg:items-end"
          >
            <div className="min-w-0">
              <label
                htmlFor="public-search"
                className="mb-2 block text-xs font-medium text-muted-foreground"
              >
                Invoice / Supplier / Vehicle Number
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  key={`q-${q}`}
                  id="public-search"
                  name="q"
                  type="search"
                  defaultValue={q}
                  maxLength={100}
                  placeholder="Search invoice, supplier or vehicle"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="public-status"
                className="mb-2 block text-xs font-medium text-muted-foreground"
              >
                Status
              </label>
              <select
                key={`status-${status}`}
                id="public-status"
                name="status"
                defaultValue={status}
                className={inputClass}
              >
                <option value="">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="Complete">Completed</option>
                <option value="Reject">Rejected</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="public-system"
                className="mb-2 block text-xs font-medium text-muted-foreground"
              >
                System
              </label>
              <select
                key={`system-${system}`}
                id="public-system"
                name="system"
                defaultValue={system}
                className={inputClass}
              >
                <option value="">All systems</option>
                <option value="AX">AX</option>
                <option value="D365">D365</option>
                <option value="AX/D365">AX / D365</option>
              </select>
            </div>

            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Search
            </button>

            <Link href="/" className={secondaryButtonClass}>
              Reset
            </Link>
          </Form>

          {failed ? (
            <div
              role="alert"
              className="mx-4 mb-5 rounded-lg border border-border bg-background p-4 sm:mx-6"
            >
              <p className="text-sm font-medium">
                Unable to load invoice details.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Please refresh the page to try again.
              </p>
            </div>
          ) : (
            <>
              <div
                role="region"
                aria-label="Public invoice list — scroll to view more rows"
                tabIndex={0}
                className="relative isolate max-h-[65vh] overflow-auto scroll-pt-14 scroll-pl-44 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <table className="w-full min-w-[960px] table-fixed border-separate border-spacing-0 text-left text-[11px] leading-4">
                  <caption className="sr-only">
                    Read-only invoice details, quantities and
                    processing progress in Sri Lanka time.
                  </caption>
                  <colgroup>
                    <col style={{ width: "17%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "12%" }} />
                  </colgroup>


                  <thead>
                    <tr>
                      {HEADINGS.map((heading, index) => (
                        <th
                          key={heading}
                          scope="col"
                          className={[
                            "sticky top-0 whitespace-normal break-words border-y border-border bg-background px-1.5 py-2.5 text-[11px] font-medium text-muted-foreground",
                            index === 0
                              ? "left-0 z-30 min-w-0 border-r"
                              : "z-20",
                          ].join(" ")}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="[&>tr>td]:[overflow-wrap:anywhere]">
                    {items.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="group hover:bg-muted focus-within:bg-muted [&>td]:border-b [&>td]:border-border"
                      >
                        <th
                          scope="row"
                          style={
                            invoice.status === "Pending" &&
                              invoice.pending_reason?.trim()
                              ? { boxShadow: "inset 3px 0 0 #f59e0b" }
                              : undefined
                          }
                          className="sticky left-0 z-10 min-w-0 border-b border-r border-border bg-card px-1.5 py-2.5 align-top font-semibold text-foreground group-hover:bg-muted group-focus-within:bg-muted [overflow-wrap:anywhere]"
                        >
                          <div>{invoice.invoice_number}</div>
                          <VehicleLabel
                            value={invoice.vehicle_number}
                            receivedDate={invoice.vehicle_received_date}
                          />
                        </th>

                        <td className="min-w-0 [overflow-wrap:anywhere] px-1.5 py-2.5 align-top">
                          {invoice.supplier}
                        </td>

                        <td className="whitespace-nowrap px-1.5 py-2.5 align-top">
                          {invoice.system_type}
                        </td>

                        <td className="px-1.5 py-2.5 align-top">
                          {invoice.shipment_type === "IMPORT"
                            ? "Import"
                            : invoice.shipment_type === "LOCAL"
                              ? "Local"
                              : invoice.shipment_type}
                        </td>

                        {/* Document date */}
                        <td className="whitespace-nowrap px-1.5 py-2.5 align-top tabular-nums">
                          {formatDate(invoice.document_share_date)}
                        </td>

                        <td className="whitespace-normal break-all px-1.5 py-2.5 align-top tabular-nums">
                          {invoice.roll_quantity == null
                            ? "—"
                            : Number(invoice.roll_quantity).toLocaleString("en-GB")}
                        </td>

                        {/* Start date */}
                        <td className="px-1.5 py-2.5 align-top text-muted-foreground">
                          <DateTime value={invoice.started_at} />
                        </td>

                        {/* Completion date */}
                        <td className="px-1.5 py-2.5 align-top text-muted-foreground">
                          <DateTime value={invoice.asn_share_at} />
                        </td>

                        <td className="px-1.5 py-2.5 align-top">
                          <div className="flex flex-col items-start">
                            <span
                              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-semibold before:size-1.5 before:rounded-full before:bg-current before:content-[''] ${statusStyles[invoice.status]}`}
                            >
                              {statusLabels[invoice.status]}
                            </span>

                            {invoice.status === "Pending" &&
                              invoice.pending_reason?.trim() && (
                                <PendingReasonDialog
                                  compact
                                  invoiceNumber={invoice.invoice_number}
                                  supplier={invoice.supplier}
                                  reason={invoice.pending_reason.trim()}
                                />
                              )}
                          </div>

                          {invoice.remark?.trim() && (
                            <div>
                              <PendingReasonDialog
                                compact
                                kind="remark"
                                invoiceNumber={invoice.invoice_number}
                                supplier={invoice.supplier}
                                reason={invoice.remark.trim()}
                              />
                            </div>
                          )}
                        </td>

                        <td className="px-1.5 py-2.5 align-top">
                          <ProcessingDetails invoice={invoice} />
                        </td>
                      </tr>
                    ))}

                    {items.length === 0 && (
                      <tr>
                        <td
                          colSpan={HEADINGS.length}
                          className="px-6 py-14 text-center"
                        >
                          <p className="font-medium">
                            {hasFilters
                              ? "No matching invoices"
                              : "No invoices available yet"}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {hasFilters
                              ? "Try another invoice number, supplier or filter."
                              : "Invoices will appear here when they are added."}
                          </p>

                          {hasFilters && (
                            <Link
                              href="/"
                              className="mt-4 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-muted dark:text-blue-400"
                            >
                              Clear filters
                            </Link>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-6">
                <p className="text-xs text-muted-foreground">
                  Showing {total === 0 ? 0 : from + 1}–
                  {Math.min(from + items.length, total)}
                  {" "}of {total.toLocaleString("en-GB")} invoices
                </p>

                <nav
                  aria-label="Public invoice pagination"
                  className="flex items-center gap-3"
                >
                  {page > 1 && (
                    <Link
                      href={overviewUrl(q, status, page - 1, system)}
                      className={secondaryButtonClass}
                    >
                      Previous
                    </Link>
                  )}

                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>

                  {page < totalPages && (
                    <Link
                      href={overviewUrl(q, status, page + 1, system)}
                      className={secondaryButtonClass}
                    >
                      Next
                    </Link>
                  )}
                </nav>
              </div>
            </>
          )}
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 pb-2 text-xs text-muted-foreground">
          <p>EFL 3PL · CSS Division</p>
          <p>Sign in to manage invoices.</p>
        </footer>
      </main>
    </div>
  );
}

export default function HomePage(props: Props) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="flex min-h-screen items-center justify-center bg-background px-6 text-sm text-muted-foreground"
        >
          Loading invoice overview…
        </div>
      }
    >
      <PublicOverview {...props} />
    </Suspense>
  );
}
