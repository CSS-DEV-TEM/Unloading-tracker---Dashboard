"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type DetailsState = {
    error: string;
    conflict: boolean;
};

export async function saveInvoiceDetails(
    _previous: DetailsState,
    formData: FormData,
): Promise<DetailsState> {
    const text = (name: string) =>
        String(formData.get(name) ?? "").trim();

    const id = text("invoiceId");
    const version = Number(text("version"));
    const invoiceNumber = text("invoiceNumber");
    const supplier = text("supplier");
    const rollText = text("rollQuantity");
    const documentDate = text("documentDate");
    const shipmentType = text("shipmentType");

    const fail = (
        error: string,
        conflict = false,
    ): DetailsState => ({ error, conflict });

    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            id,
        ) ||
        !Number.isSafeInteger(version) ||
        version < 1 ||
        version > 2147483647
    ) {
        return fail("Invalid invoice reference. Reload the page.");
    }

    if (!invoiceNumber || invoiceNumber.length > 100) {
        return fail("Enter an invoice number of up to 100 characters.");
    }

    if (!supplier || supplier.length > 250) {
        return fail("Enter a supplier name of up to 250 characters.");
    }

    const rollQuantity = rollText === "" ? null : Number(rollText);

    if (
        rollQuantity !== null &&
        (!/^\d+$/.test(rollText) ||
            !Number.isSafeInteger(rollQuantity) ||
            rollQuantity < 0 ||
            rollQuantity > 2147483647)
    ) {
        return fail("Roll quantity must be a valid non-negative whole number.");
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) {
        return fail("Select a valid document share date.");
    }

    const parsedDate = new Date(`${documentDate}T00:00:00.000Z`);

    if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== documentDate
    ) {
        return fail("Select a valid document share date.");
    }

    if (!["LOCAL", "IMPORT"].includes(shipmentType)) {
        return fail("Select Local or Import.");
    }

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return fail("Your session has expired. Please sign in again.");
    }

    const { error } = await supabase.rpc("update_invoice_details", {
        p_invoice_id: id,
        p_expected_version: version,
        p_invoice_number: invoiceNumber,
        p_supplier: supplier,
        p_roll_quantity: rollQuantity,
        p_document_share_date: documentDate,
        p_shipment_type: shipmentType,
    });

    if (error) {
        if (error.code === "40001") {
            return fail(
                "Another user updated this invoice. Copy any changes you want to keep, then reload the latest record.",
                true,
            );
        }

        if (error.code === "42501") {
            return fail("Active dashboard access is required.");
        }

        if (error.code === "P0002") {
            return fail("This invoice could not be found.");
        }

        return fail("Unable to save invoice details. Please try again.");
    }

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/activity");
    revalidatePath(`/dashboard/invoices/${id}`);
    revalidatePath(`/dashboard/invoices/${id}/details`);

    redirect(`/dashboard/invoices/${id}?notice=invoice-updated`);
}