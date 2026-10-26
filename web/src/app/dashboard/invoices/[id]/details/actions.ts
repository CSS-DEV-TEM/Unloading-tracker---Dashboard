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
    function text(name: string) {
        const value = formData.get(name);
        return typeof value === "string" ? value.trim() : "";
    }

    function fail(error: string, conflict = false): DetailsState {
        return { error, conflict };
    }

    function validDate(value: string) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        if (value < "0001-01-01" || value > "9999-12-31") return false;

        const parsed = new Date(`${value}T00:00:00Z`);

        return (
            !Number.isNaN(parsed.getTime()) &&
            parsed.toISOString().slice(0, 10) === value
        );
    }

    const id = text("invoiceId");
    const version = Number(text("version"));
    const invoiceNumber = text("invoiceNumber");
    const supplier = text("supplier");
    const rollText = text("rollQuantity");
    const documentDate = text("documentDate");
    const shipmentType = text("shipmentType");
    const vehicleNumber = text("vehicleNumber");
    const receivedDate = text("receivedDate");
    const originalReceivedDate = text("originalReceivedDate");
    const originalVehicleNumber = text("originalVehicleNumber");

    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
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

    if (vehicleNumber.length > 30) {
        return fail("Vehicle number must be 30 characters or fewer.");
    }

    if (!validDate(documentDate)) {
        return fail("Select a valid document share date.");
    }

    if (receivedDate && !validDate(receivedDate)) {
        return fail("Select a valid received date, or leave it blank.");
    }

    if (originalReceivedDate && !validDate(originalReceivedDate)) {
        return fail("Reload the page to get the current received date.", true);
    }

    if (receivedDate && !vehicleNumber) {
        return fail(
            "Enter a vehicle number, or leave the received date blank.",
        );
    }

    if (!["LOCAL", "IMPORT"].includes(shipmentType)) {
        return fail("Select Local or Import.");
    }

    const rollQuantity = rollText === "" ? null : Number(rollText);

    if (
        rollQuantity !== null &&
        (
            !/^\d+$/.test(rollText) ||
            !Number.isSafeInteger(rollQuantity) ||
            rollQuantity < 0 ||
            rollQuantity > 2147483647
        )
    ) {
        return fail(
            "Roll quantity must be a valid non-negative whole number.",
        );
    }

    const vehicleKey = (value: string) =>
        value.replace(/[\s-]+/g, "").toUpperCase();

    const receivedDateChanged =
        receivedDate !== "" &&
        (
            receivedDate !== originalReceivedDate ||
            vehicleKey(vehicleNumber) !== vehicleKey(originalVehicleNumber)
        );

    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return fail("Your session has expired. Please sign in again.");
    }

    const { data: existing, error: readError } = await supabase
        .from("invoices").select("meter_quantity, version").eq("id", id).maybeSingle();
    if (readError || !existing) return fail("Unable to load the invoice. Refresh and try again.");
    if (existing.version !== version) return fail("This invoice changed. Reload before saving.", true);

    const { error } = await supabase.rpc("save_invoice_with_meters", {
        p_invoice_id: id,
        p_expected_version: version,
        p_invoice_number: invoiceNumber,
        p_supplier: supplier,
        p_roll_quantity: rollQuantity,
        p_system_type: null,
        p_document_share_date: documentDate,
        p_shipment_type: shipmentType,
        p_vehicle_number: vehicleNumber || null,
        p_received_date: receivedDateChanged ? receivedDate : null,
        p_expected_received_date: receivedDateChanged
            ? originalReceivedDate || null
            : null,
        p_meter_quantity: existing.meter_quantity,
    });

    if (error) {
        if (
            error.code === "23505" &&
            error.message.includes("invoices_invoice_number_normalized_uidx")
        ) {
            return fail(
                `Invoice "${invoiceNumber}" is already used by another invoice. ` +
                "Enter a different invoice number.",
            );
        }

        if (error.code === "PVC01") {
            return fail(
                "Vehicle assignment or received date is locked by completed " +
                "or ASN shared invoices. Reopen the affected invoices as " +
                "Pending before changing it.",
            );
        }

        if (error.code === "PVA01") {
            return fail(
                "This vehicle is archived. Keep the existing assignment, " +
                "choose an active vehicle or ask an administrator to restore it.",
            );
        }

        if (error.code === "40001" || error.code === "40P01") {
            return fail(
                "The invoice or vehicle received date changed while you were " +
                "editing. Copy your changes, then reload the latest record.",
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
    revalidatePath("/dashboard/vehicles");
    revalidatePath("/dashboard/activity");
    revalidatePath("/dashboard/invoices/[id]", "page");
    revalidatePath("/dashboard/invoices/[id]/details", "page");

    redirect(`/dashboard/invoices/${id}?notice=invoice-updated`);
}