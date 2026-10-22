import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DetailsForm from "./details-form";
type Props = {
    params: Promise<{
        id: string;
    }>;
};
async function DetailsContent({ params }: Props) {
    await connection();
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        notFound();
    }
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
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
    if (!profile?.is_active ||
        !["ADMIN", "USER"].includes(profile.role)) {
        redirect("/dashboard");
    }
    const { data: invoice, error } = await supabase
        .from("invoices")
        .select("id, version, invoice_number, supplier, roll_quantity, meter_quantity, vehicle_id, vehicle_number, document_share_date, shipment_type, system_type, status")
        .eq("id", id)
        .maybeSingle();
    if (error) {
        throw new Error("Unable to load invoice details.");
    }
    if (!invoice) {
        notFound();
    }
    let vehicleReceivedDate: string | null = null;
    if (invoice.vehicle_id) {
        const { data: vehicle, error: vehicleError } = await supabase
            .from("vehicles")
            .select("received_date")
            .eq("id", invoice.vehicle_id)
            .maybeSingle();
        if (vehicleError) {
            throw new Error("Unable to load the vehicle received date.");
        }
        vehicleReceivedDate = vehicle?.received_date ?? null;
    }
    return (<main className="mx-auto w-full max-w-[1600px] space-y-4 px-4 py-4 text-foreground sm:px-6">
        <header className="flex items-start gap-3 border-b border-border pb-4">
            <Link href={`/dashboard/invoices/${invoice.id}`} aria-label="Back to invoice process" className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-input bg-card text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
            <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Edit invoice details</h1>
                <p className="mt-1 break-words text-sm font-medium">{invoice.invoice_number}</p>
                <p className="mt-1 text-xs text-muted-foreground">Fields marked * are required. Saved changes are recorded in activity history.</p>
            </div>
        </header>
        <DetailsForm key={`${invoice.id}-${invoice.version}`} invoice={{ ...invoice, vehicle_received_date: vehicleReceivedDate }} />
    </main>);
}
export default function EditInvoiceDetailsPage(props: Props) {
    return (<Suspense fallback={<p className="p-8 text-sm text-muted-foreground">
        Loading invoice details...
    </p>}>
        <DetailsContent {...props} />
    </Suspense>);
}
