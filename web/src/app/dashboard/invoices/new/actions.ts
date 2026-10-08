"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type CreateState = {
    error: string;
};

export async function createInvoice(
    _previousState: CreateState,
    formData: FormData,
): Promise<CreateState> {
    function text(name: string) {
        const value = formData.get(name);
        return typeof value === "string" ? value.trim() : "";
    }

    const invoice = text("invoice");
    const supplier = text("supplier");
    const system = text("system");
    const shipment = text("shipment");
    const date = text("documentDate");
    const quantityText = text("rollQuantity");

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

    const parsedDate = new Date(`${date}T00:00:00Z`);

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== date
    ) {
        return { error: "Select a valid document share date." };
    }

    const quantity = quantityText === "" ? null : Number(quantityText);

    if (
        quantity !== null &&
        (!/^\d+$/.test(quantityText) ||
            !Number.isSafeInteger(quantity) ||
            quantity > 2147483647)
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

    const { error } = await supabase.rpc("create_invoice", {
        p_invoice_number: invoice,
        p_supplier: supplier,
        p_roll_quantity: quantity,
        p_system_type: system,
        p_document_share_date: date,
        p_shipment_type: shipment,
    });

    if (error) {
        return {
            error:
                error.code === "42501"
                    ? "Your account does not have active dashboard access."
                    : "Unable to save the invoice. Please try again.",
        };
    }

    revalidatePath("/dashboard");
    redirect("/dashboard?notice=invoice-created");
}