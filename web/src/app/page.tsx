import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { PackageOpen, Search } from "lucide-react";
import OverviewRefresh from "@/components/overview-refresh";

type SearchParams = {
  q?: string | string[];
  status?: string | string[];
  page?: string | string[];
};

type Props = {
  searchParams: Promise<SearchParams>;
};

type PublicInvoice = {
  invoice_number: string;
  supplier: string;
  status: "Pending" | "Complete" | "Reject";
  started_at: string | null;
  completed_at: string | null;
};

type Overview = {
  total: number;
  items: PublicInvoice[];
};

const statusStyles = {
  Pending: "border-amber-200 bg-amber-50 text-amber-800",
  Complete: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Reject: "border-rose-200 bg-rose-50 text-rose-800",
};

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function overviewUrl(q: string, status: string, page: number) {
  const params = new URLSearchParams();

  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function DateTime({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-slate-400">—</span>;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <time dateTime={date.toISOString()} className="whitespace-nowrap">
      {new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Colombo",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(date)}
    </time>
  );
}

async function PublicOverview({ searchParams }: Props) {
  await connection();

  const params = await searchParams;

  const q = single(params.q).trim().slice(0, 100);
  const requestedStatus = single(params.status);

  const status = ["Pending", "Complete", "Reject"].includes(
    requestedStatus,
  )
    ? requestedStatus
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

  // Public access only. No user cookies or administrator key.
  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.rpc(
    "get_public_invoice_overview",
    {
      p_search: q,
      p_status: status,
      p_page: page,
    },
  );

  const overview = data as Overview | null;
  const total = overview?.total ?? 0;
  const items = overview?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const failed = Boolean(error) || !overview;

  if (!failed && page > totalPages) {
    redirect(overviewUrl(q, status, totalPages));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-700 p-3 text-white">
              <PackageOpen className="h-6 w-6" aria-hidden="true" />
            </div>

            <div>
              <p className="text-sm font-bold">EFL · 3PL</p>
              <p className="text-xs text-slate-500">
                Unloading Tracker Dashboard
              </p>
            </div>
          </Link>

          <Link
            href="/login"
            className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-8">
        <section className="rounded-2xl bg-blue-700 p-7 text-white sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-100">
            Operations overview
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Unloading Tracker
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">
            Check invoice progress and completion dates.
            Team members can sign in to create invoices and update
            the unloading process.
          </p>

          <span className="mt-5 inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs">
            Read-only overview
          </span>
        </section>

        <OverviewRefresh />

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="font-semibold">Invoice overview</h2>
            <p className="mt-1 text-sm text-slate-500">
              Dates and times are displayed in Sri Lanka time.
            </p>
          </div>

          <form
            action="/"
            method="get"
            className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label
                htmlFor="public-search"
                className="mb-2 block text-xs font-medium text-slate-600"
              >
                Invoice / Supplier
              </label>

              <div className="relative">
                <Search
                  className="absolute left-3 top-3 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />

                <input
                  key={`q-${q}`}
                  id="public-search"
                  name="q"
                  type="search"
                  defaultValue={q}
                  maxLength={100}
                  placeholder="Search invoices..."
                  className="h-10 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="sm:w-44">
              <label
                htmlFor="public-status"
                className="mb-2 block text-xs font-medium text-slate-600"
              >
                Status
              </label>

              <select
                key={`status-${status}`}
                id="public-status"
                name="status"
                defaultValue={status}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="Complete">Complete</option>
                <option value="Reject">Reject</option>
              </select>
            </div>

            <button
              type="submit"
              className="h-10 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Search
            </button>

            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm hover:bg-slate-50"
            >
              Reset
            </Link>
          </form>

          {failed ? (
            <p
              role="alert"
              className="mx-6 mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"
            >
              Invoice overview is temporarily unavailable.
              Please refresh the page to try again.
            </p>
          ) : (
            <>
              <div
                role="region"
                aria-label="Public invoice list"
                tabIndex={0}
                className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <table className="w-full min-w-[850px] text-left text-sm">
                  <caption className="sr-only">
                    Read-only invoice status overview
                  </caption>

                  <thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500">
                    <tr>
                      {[
                        "Invoice",
                        "Supplier",
                        "Status",
                        "Start Date",
                        "Completion Date",
                      ].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="px-5 py-4 font-medium"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {items.map((invoice, index) => (
                      <tr
                        key={`${page}-${index}`}
                        className="hover:bg-slate-50"
                      >
                        <th
                          scope="row"
                          className="px-5 py-4 font-semibold text-slate-900"
                        >
                          {invoice.invoice_number}
                        </th>

                        <td className="px-5 py-4">
                          {invoice.supplier}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusStyles[invoice.status]}`}
                          >
                            {invoice.status}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          <DateTime value={invoice.started_at} />
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          <DateTime value={invoice.completed_at} />
                        </td>
                      </tr>
                    ))}

                    {items.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-14 text-center text-slate-500"
                        >
                          {q || status
                            ? "No invoices match your search."
                            : "No invoices available yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-6 py-4">
                <p className="text-xs text-slate-500">
                  {total} invoices · Page {page} of {totalPages}
                </p>

                <nav
                  aria-label="Public invoice pagination"
                  className="flex gap-3 text-sm"
                >
                  {page > 1 && (
                    <Link
                      href={overviewUrl(q, status, page - 1)}
                      className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50"
                    >
                      Previous
                    </Link>
                  )}

                  {page < totalPages && (
                    <Link
                      href={overviewUrl(q, status, page + 1)}
                      className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50"
                    >
                      Next
                    </Link>
                  )}
                </nav>
              </div>
            </>
          )}
        </section>

        <footer className="flex flex-wrap justify-between gap-3 text-xs text-slate-500">
          <p>EFL · 3PL — CSS Division</p>
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
        <p
          role="status"
          className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500"
        >
          Loading invoice overview...
        </p>
      }
    >
      <PublicOverview {...props} />
    </Suspense>
  );
}