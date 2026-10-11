"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type DeleteState = {
    error: string;
};

export async function deleteInvoice(
    _previousState: DeleteState,
    formData: FormData,
): Promise<DeleteState> {
    const invoiceId = formData.get("invoiceId");
    const versionValue = formData.get("version");
    const confirmation = formData.get("confirmation");

    const version =
        typeof versionValue === "string"
            ? Number(versionValue)
            : NaN;

    if (
        typeof invoiceId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            invoiceId,
        ) ||
        !Number.isSafeInteger(version) ||
        version < 1 ||
        version > 2147483647 ||
        typeof confirmation !== "string" ||
        confirmation.length < 1 ||
        confirmation.length > 100
    ) {
        return { error: "Invalid request. Reload the invoice and try again." };
    }

    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: "Your session has expired. Sign in again." };
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        return { error: "Unable to verify administrator access." };
    }

    if (!profile?.is_active || profile.role !== "ADMIN") {
        return { error: "Only active administrators can delete invoices." };
    }

    const { error } = await supabase.rpc("delete_invoice", {
        p_invoice_id: invoiceId,
        p_expected_version: version,
        p_confirmation: confirmation,
    });

    if (error) {
        if (error.code === "40001") {
            return {
                error:
                    "This invoice was updated after you opened it. Reload and review the latest details before deleting.",
            };
        }

        if (error.code === "42501") {
            return { error: "Active administrator access is required." };
        }

        if (error.code === "P0002") {
            return { error: "This invoice no longer exists. Return to the dashboard." };
        }

        if (error.code === "22023") {
            return { error: "Enter the invoice number exactly as displayed." };
        }

        return { error: "Unable to delete this invoice. Please try again." };
    }

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/activity");
    revalidatePath(`/dashboard/invoices/${invoiceId}`);
    revalidatePath(`/dashboard/invoices/${invoiceId}/details`);

    redirect("/dashboard");
}