
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import ProcessForm from "./process-form";
import type { ProcessFormData, ProcessStage } from "./types";
import { Pencil } from "lucide-react";


type PageProps = {
    params: Promise<{ id: string }>;
};

function toSriLankaInput(value: string | null): string {
    if (!value) return "";

    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).formatToParts(new Date(value));

    const part = (type: string) =>
        parts.find((item) => item.type === type)?.value ?? "";

    return (
        `${part("year")}-${part("month")}-${part("day")}` +
        `T${part("hour")}:${part("minute")}:${part("second")}`
    );
}

async function InvoiceContent({ params }: PageProps) {
    await connection();

    const { id } = await params;

    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
        notFound();
    }

    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect("/login");
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (
        profileError ||
        !profile?.is_active ||
        !["ADMIN", "USER"].includes(profile.role)
    ) {
        redirect("/dashboard");
    }

    const [
        invoiceResult,
        stagesResult,
        asnResult,
        usersResult,
    ] = await Promise.all([
        supabase
            .from("invoices")
            .select(
                `
          id, invoice_number, supplier, roll_quantity,
          system_type, shipment_type, document_share_date,
          pending_reason, remark, status, version
        `,
            )
            .eq("id", id)
            .maybeSingle(),

        supabase
            .from("pre_grn_stages")
            .select(
                "system_name, started_at, ended_at, is_done, assigned_user_name",
            )
            .eq("invoice_id", id)
            .order("system_name"),

        supabase
            .from("asn_updates")
            .select("share_date, is_shared, assigned_user_name")
            .eq("invoice_id", id)
            .maybeSingle(),

        supabase
            .from("profiles")
            .select("full_name")
            .eq("is_active", true)
            .order("full_name"),
    ]);

    if (
        invoiceResult.error ||
        stagesResult.error ||
        asnResult.error ||
        usersResult.error
    ) {
        throw new Error("Unable to load invoice details. Please try again.");
    }

    const invoice = invoiceResult.data;

    if (!invoice) notFound();

    const asn = asnResult.data;
    const stages = stagesResult.data ?? [];

    const expectedSystems =
        invoice.system_type === "AX/D365"
            ? ["AX", "D365"]
            : [invoice.system_type];

    if (
        !asn ||
        stages.length !== expectedSystems.length ||
        expectedSystems.some(
            (system) => !stages.some((stage) => stage.system_name === system),
        )
    ) {
        throw new Error("This invoice has incomplete processing records.");
    }

    const initial: ProcessFormData = {
        invoice_id: invoice.id,
        version: invoice.version,

        stages: stages.map((stage) => ({
            system_name: stage.system_name as ProcessStage["system_name"],
            started_at: toSriLankaInput(stage.started_at),
            ended_at: toSriLankaInput(stage.ended_at),
            is_done: stage.is_done,
            assigned_user_name: stage.assigned_user_name ?? "",
        })),

        pending_reason: invoice.pending_reason ?? "",
        asn_share_date: asn.share_date ?? "",
        asn_shared: asn.is_shared,
        asn_user_name: asn.assigned_user_name ?? "",
        remark: invoice.remark ?? "",
        status: invoice.status as ProcessFormData["status"],
    };

    const userNames = Array.from(
        new Set((usersResult.data ?? []).map((item) => item.full_name)),
    );

    return (
        <main className="min-h-screen bg-background px-5 py-8 text-foreground">
            <div className="mx-auto max-w-4xl space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <Link
                        href="/dashboard"
                        className="inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        ← Back to dashboard
                    </Link>


                </div>

                <section
                    aria-label="Invoice summary"
                    className="overflow-hidden rounded-xl border border-border bg-card"
                >
                    <div className="flex items-start gap-4 px-5 py-5 sm:px-6">
                        <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2 sm:gap-6">
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Invoice number
                                </p>

                                <h1 className="mt-1.5 break-words text-xl font-semibold tracking-tight text-foreground">
                                    {invoice.invoice_number}
                                </h1>
                            </div>

                            <dl className="min-w-0 sm:border-l sm:border-border sm:pl-6">
                                <dt className="text-xs font-medium text-muted-foreground">
                                    Supplier
                                </dt>

                                <dd className="mt-1.5 break-words text-base font-medium text-foreground">
                                    {invoice.supplier}
                                </dd>
                            </dl>
                        </div>

                        <Link
                            href={`/dashboard/invoices/${invoice.id}/details`}
                            aria-label="Edit invoice details"
                            title="Edit invoice details"
                            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <Pencil aria-hidden="true" className="size-4" />
                        </Link>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border bg-muted/20 px-5 py-4 text-sm sm:grid-cols-4 sm:px-6">
                        <div className="min-w-0">
                            <dt className="text-xs text-muted-foreground">
                                System
                            </dt>
                            <dd className="mt-1.5 break-words font-medium text-foreground">
                                {invoice.system_type}
                            </dd>
                        </div>

                        <div className="min-w-0">
                            <dt className="text-xs text-muted-foreground">
                                Shipment
                            </dt>
                            <dd className="mt-1.5 break-words font-medium text-foreground">
                                {invoice.shipment_type === "IMPORT"
                                    ? "Import"
                                    : invoice.shipment_type === "LOCAL"
                                        ? "Local"
                                        : invoice.shipment_type}
                            </dd>
                        </div>

                        <div className="min-w-0">
                            <dt className="text-xs text-muted-foreground">
                                Roll quantity
                            </dt>
                            <dd className="mt-1.5 font-medium tabular-nums text-foreground">
                                {invoice.roll_quantity == null
                                    ? "—"
                                    : invoice.roll_quantity.toLocaleString("en-GB")}
                            </dd>
                        </div>

                        <div className="min-w-0">
                            <dt className="text-xs text-muted-foreground">
                                Document date
                            </dt>
                            <dd className="mt-1.5 font-medium tabular-nums text-foreground">
                                {invoice.document_share_date
                                    .split("-")
                                    .reverse()
                                    .join("/")}
                            </dd>
                        </div>
                    </dl>
                </section>

                <ProcessForm
                    key={`${invoice.id}-${invoice.version}`}
                    initial={initial}
                    userNames={userNames}
                />
            </div>
        </main>
    );
}

export default function InvoicePage({ params }: PageProps) {
    return (
        <Suspense
            fallback={
                <p className="p-10 text-sm text-muted-foreground" role="status">
                    Loading invoice...
                </p>
            }
        >
            <InvoiceContent params={params} />
        </Suspense>
    );
}