import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Form from "next/form";
import { Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import OverviewRefresh from "@/components/overview-refresh";
import { AssignDialog, RemoveAssignment, VehicleEditor } from "./vehicle-controls";
import type { InvoiceChoice, VehicleRow } from "./actions";

type Params = { q?: string; page?: string; vehicle?: string; invoicePage?: string };
const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-input px-4 text-sm hover:bg-muted";
function pageNumber(value?: string) { const n = Number(value || 1); return Number.isSafeInteger(n) && n > 0 && n <= 100000 ? n : 1; }
function url(q: string, page: number, vehicle?: string, invoicePage = 1) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (page > 1) params.set("page", String(page));
    if (vehicle) params.set("vehicle", vehicle);
    if (invoicePage > 1) params.set("invoicePage", String(invoicePage));
    return `/dashboard/vehicles${params.size ? `?${params}` : ""}`;
}
async function Content({ searchParams }: { searchParams: Promise<Params> }) {
    await connection();
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) redirect("/login");
    const { data: profile, error: profileError } = await db.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
    if (profileError) throw new Error("Unable to load permissions.");
    if (!profile?.is_active || !["ADMIN", "USER"].includes(profile.role)) redirect("/dashboard");
    const params = await searchParams;
    const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
    const page = pageNumber(params.page);
    const invoicePage = pageNumber(params.invoicePage);
    const selectedId = typeof params.vehicle === "string" && /^[0-9a-f-]{36}$/i.test(params.vehicle) ? params.vehicle : undefined;
    let query = db.from("vehicles").select("id,vehicle_number,version,invoices(count)", { count: "exact" }).order("vehicle_number").order("id");
    if (q) query = query.ilike("number_key", `%${q.replace(/[\s-]+/g, "").toUpperCase().replace(/[\\%_]/g, "\\$&")}%`);
    const { data, count, error } = await query.range((page - 1) * 20, page * 20 - 1);
    if (error) throw new Error("Unable to load vehicles. Confirm the vehicle migration has been applied.");
    const total = count ?? 0;
    const pages = Math.max(1, Math.ceil(total / 20));
    if (page > pages) redirect(url(q, pages, selectedId));
    let vehicle: VehicleRow | null = null;
    let invoices: InvoiceChoice[] = [];
    let invoiceCount = 0;
    if (selectedId) {
        const result = await db.from("vehicles").select("id,vehicle_number,version").eq("id", selectedId).maybeSingle();
        if (result.error) throw new Error("Unable to load vehicle.");
        vehicle = result.data;
        if (vehicle) {
            const assigned = await db.from("invoices").select("id,invoice_number,supplier,vehicle_number,vehicle_id,version", { count: "exact" })
                .eq("vehicle_id", selectedId).order("created_at", { ascending: false }).order("id")
                .range((invoicePage - 1) * 20, invoicePage * 20 - 1);
            if (assigned.error) throw new Error("Unable to load assigned invoices.");
            invoices = assigned.data ?? []; invoiceCount = assigned.count ?? 0;
            if (invoicePage > Math.max(1, Math.ceil(invoiceCount / 20))) redirect(url(q, page, selectedId));
        }
    }
    return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Vehicle management</h1><p className="mt-2 text-sm text-muted-foreground">Manage vehicles and the invoices assigned to each one.</p></div><VehicleEditor /></header>
        <div className="flex justify-end"><OverviewRefresh /></div>
        <section className="overflow-hidden rounded-xl border border-border bg-card" aria-label="Vehicles">
            <Form action="/dashboard/vehicles" scroll={false} className="flex flex-wrap items-end gap-3 border-b border-border p-4">
                <div className="min-w-0 flex-1"><label htmlFor="vehicle-search" className="mb-2 block text-xs font-medium">Vehicle number</label><input id="vehicle-search" name="q" key={q} defaultValue={q} maxLength={100} placeholder="Search vehicle number" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" /></div>
                <button className={button}>Search</button><Link href="/dashboard/vehicles" scroll={false} className={button}>Reset</Link>
            </Form>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-4">Vehicle number</th><th className="p-4">Assigned invoices</th><th className="p-4"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody className="divide-y divide-border">{(data ?? []).map(row => <tr key={row.id} className={selectedId === row.id ? "bg-muted" : "hover:bg-muted/50"}><th scope="row" className="p-4 font-semibold"><span className="inline-flex items-center gap-2"><Truck className="size-4 text-muted-foreground" aria-hidden="true" />{row.vehicle_number}</span></th><td className="p-4 tabular-nums">{row.invoices?.[0]?.count ?? 0}</td><td className="p-4 text-right"><Link href={url(q, page, row.id)} scroll={false} className={button}>View invoices<span className="sr-only"> for {row.vehicle_number}</span></Link></td></tr>)}</tbody>
            </table></div>
            {!data?.length && <p className="p-8 text-center text-sm text-muted-foreground">{q ? "No matching vehicles. Try another number." : "No vehicles yet. Add a vehicle or enter a vehicle number when creating an invoice."}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 text-xs"><span>{total} vehicles · Page {page} of {pages}</span><div className="flex gap-2">{page > 1 && <Link scroll={false} href={url(q, page - 1, selectedId)} className={button}>Previous</Link>}{page < pages && <Link scroll={false} href={url(q, page + 1, selectedId)} className={button}>Next</Link>}</div></div>
        </section>
        {selectedId && !vehicle && <p role="status" className="text-sm text-muted-foreground">Vehicle not found. Select another vehicle.</p>}
        {vehicle && <section className="overflow-hidden rounded-xl border border-border bg-card" aria-label={`Invoices for ${vehicle.vehicle_number}`}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5"><div><h2 className="text-lg font-semibold">{vehicle.vehicle_number}</h2><p className="mt-1 text-sm text-muted-foreground">{invoiceCount} assigned invoices</p></div><div className="flex flex-wrap gap-2">{profile.role === "ADMIN" && <VehicleEditor key={`${vehicle.id}-${vehicle.version}`} vehicle={vehicle} />}<AssignDialog key={vehicle.id} vehicle={vehicle} /></div></div>
            <div className="divide-y divide-border">{invoices.map(invoice => <div key={`${invoice.id}-${invoice.version}`} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><Link href={`/dashboard/invoices/${invoice.id}`} className="break-words text-sm font-semibold text-blue-600 dark:text-blue-300">{invoice.invoice_number}</Link><p className="mt-1 break-words text-sm text-muted-foreground">{invoice.supplier}</p></div><RemoveAssignment invoice={invoice} /></div>)}</div>
            {!invoices.length && <p className="p-8 text-center text-sm text-muted-foreground">No invoices assigned. Use Assign invoices to add existing records.</p>}
            <div className="flex items-center justify-between gap-3 border-t border-border p-4 text-xs"><span>Page {invoicePage} of {Math.max(1, Math.ceil(invoiceCount / 20))}</span><div className="flex gap-2">{invoicePage > 1 && <Link scroll={false} href={url(q, page, vehicle.id, invoicePage - 1)} className={button}>Previous</Link>}{invoicePage * 20 < invoiceCount && <Link scroll={false} href={url(q, page, vehicle.id, invoicePage + 1)} className={button}>Next</Link>}</div></div>
        </section>}
    </main>;
}
export default function VehiclePage(props: { searchParams: Promise<Params> }) {
    return <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Loading vehicles…</p>}><Content {...props} /></Suspense>;
}