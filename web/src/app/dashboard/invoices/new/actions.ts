"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type CreateState = {
    error: string;
};

export async function saveImportedInvoice(
    _previousState: CreateState,
    formData: FormData,
): Promise<CreateState> {
    function text(name: string) {
        const value = formData.get(name);
        return typeof value === "string" ? value.trim() : "";
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

    const invoice = text("invoice");
    const supplier = text("supplier");
    const system = text("system");
    const shipment = text("shipment");
    const date = text("documentDate");
    const quantityText = text("rollQuantity");
    const vehicleNumber = text("vehicleNumber");
    const receivedDate = text("receivedDate");

    if (!invoice || invoice.length > 100) {
        return {
            error: "Enter an invoice number of up to 100 characters.",
        };
    }

    if (!supplier || supplier.length > 250) {
        return {
            error: "Enter a supplier name of up to 250 characters.",
        };
    }

    if (!["AX", "D365", "AX/D365"].includes(system)) {
        return { error: "Select a valid system." };
    }

    if (!["LOCAL", "IMPORT"].includes(shipment)) {
        return { error: "Select Local or Import." };
    }

    if (!validDate(date)) {
        return { error: "Select a valid document share date." };
    }

    if (vehicleNumber.length > 30) {
        return {
            error: "Vehicle number must be 30 characters or fewer.",
        };
    }

    if (receivedDate && !vehicleNumber) {
        return {
            error: "Enter a vehicle number, or leave the received date blank.",
        };
    }

    if (receivedDate && !validDate(receivedDate)) {
        return {
            error: "Select a valid received date, or leave it blank.",
        };
    }

    const quantity = quantityText === "" ? null : Number(quantityText);

    if (
        quantity !== null &&
        (
            !/^\d+$/.test(quantityText) ||
            !Number.isSafeInteger(quantity) ||
            quantity < 0 ||
            quantity > 2147483647
        )
    ) {
        return {
            error: "Roll quantity must be a valid non-negative whole number.",
        };
    }

    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return {
            error: "Your session has expired. Sign in again.",
        };
    }

    const { error } = await supabase.rpc("save_invoice_with_meters", {
        p_invoice_id: null,
        p_expected_version: null,
        p_invoice_number: invoice,
        p_supplier: supplier,
        p_roll_quantity: quantity,
        p_system_type: system,
        p_document_share_date: date,
        p_shipment_type: shipment,
        p_vehicle_number: vehicleNumber || null,
        p_received_date: receivedDate || null,
        p_expected_received_date: null,
        p_meter_quantity: null,
    });

    if (error) {
        if (
            error.code === "23505" &&
            error.message.includes("invoices_invoice_number_normalized_uidx")
        ) {
            return {
                error:
                    `Invoice "${invoice}" already exists. ` +
                    "Open the existing invoice to edit it, or remove this draft.",
            };
        }

        if (error.code === "PVC01") {
            return {
                error:
                    "This vehicle has completed or ASN shared invoices. " +
                    "Leave the received date blank to keep its current date, " +
                    "or reopen the linked invoices before changing it.",
            };
        }

        if (error.code === "40001" || error.code === "40P01") {
            return {
                error:
                    "A record changed while saving. Review your details and try again.",
            };
        }

        if (error.code === "PVA01") {
            return {
                error:
                    "This vehicle is archived. Choose an active vehicle " +
                    "or ask an administrator to restore it.",
            };
        }

        if (error.code === "42501") {
            return {
                error: "Your account does not have active dashboard access.",
            };
        }

        return {
            error: "Unable to save the invoice. Please try again.",
        };
    }

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/vehicles");
    revalidatePath("/dashboard/activity");
    revalidatePath("/dashboard/invoices/[id]", "page");
    revalidatePath("/dashboard/invoices/[id]/details", "page");

    return { error: "" };
}

export async function createInvoice(
    previousState: CreateState,
    formData: FormData,
): Promise<CreateState> {
    const result = await saveImportedInvoice(previousState, formData);

    if (result.error) {
        return result;
    }

    redirect("/dashboard?notice=invoice-created");
}