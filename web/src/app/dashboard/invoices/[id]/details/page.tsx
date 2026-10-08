

import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DetailsForm from "./details-form";

type Props = {
    params: Promise<{ id: string }>;
};

async function DetailsContent({ params }: Props) {
    await connection();

    const { id } = await params;

    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            id,
        )
    ) {
        notFound();
    }

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        throw new Error("Unable to verify dashboard access.");
    }

    if (
        !profile?.is_active ||
        !["ADMIN", "USER"].includes(profile.role)
    ) {
        redirect("/dashboard");
    }

    const { data: invoice, error } = await supabase
        .from("invoices")
        .select(
            "id, version, invoice_number, supplier, roll_quantity, document_share_date, shipment_type, system_type",
        )
        .eq("id", id)
        .maybeSingle();

    if (error) {
        throw new Error("Unable to load invoice details.");
    }

    if (!invoice) {
        notFound();
    }

    return (
        <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6">
            <div className="mx-auto max-w-3xl">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <div className="mb-6 flex justify-end">

                    </div>
                </div>

                <header className="mb-5">
                    <p className="mt-2 break-words text-2xl font-semibold tracking-tight text-foreground">
                        Edit Invoice details
                    </p>

                    <p className="mt-2 text-sm text-muted-foreground">
                        Update the invoice information. Changes are recorded
                        in the activity history.
                    </p>
                </header>

                <DetailsForm
                    key={`${invoice.id}-${invoice.version}`}
                    invoice={invoice}
                />
            </div>
        </main>
    );
}

export default function EditInvoiceDetailsPage(props: Props) {
    return (
        <Suspense
            fallback={
                <p className="p-8 text-sm text-muted-foreground">
                    Loading invoice details...
                </p>
            }
        >
            <DetailsContent {...props} />
        </Suspense>
    );
}