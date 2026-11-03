"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type QuickField = "AX" | "D365" | "ASN" | "ROLL";

export type Assignment = {
    version: number;
    roll_quantity: number | null;
    stages: {
        system_name: "AX" | "D365";
        assigned_user_name: string | null;
    }[];
    asn_user_name: string | null;
    user_names: string[];
};

export async function invoiceQuickUsers(
    invoiceId: string,
    change?: {
        field: QuickField;
        value: string;
        version: number;
    },
): Promise<{ data?: Assignment; error?: string }> {
    if (
        !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
            invoiceId,
        )
    ) {
        return { error: "Invalid invoice reference." };
    }

    if (change) {
        if (
            !["AX", "D365", "ASN", "ROLL"].includes(change.field) ||
            typeof change.value !== "string" ||
            !Number.isSafeInteger(change.version) ||
            change.version < 1
        ) {
            return { error: "Invalid change." };
        }

        const value = change.value.trim();

        if (change.field === "ROLL") {
            if (
                value !== "" &&
                (
                    !/^\d{1,10}$/.test(value) ||
                    Number(value) > 2147483647
                )
            ) {
                return {
                    error:
                        "Roll quantity must be a whole number " +
                        "between 0 and 2147483647.",
                };
            }
        } else if (value.length > 150) {
            return {
                error: "User name must be 150 characters or fewer.",
            };
        }
    }

    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: "Sign in again to edit this invoice." };
    }

    const { data, error } = await supabase.rpc(
        "invoice_quick_edit",
        {
            p_invoice_id: invoiceId,
            p_field: change?.field ?? null,
            p_value: change?.value.trim() || null,
            p_expected_version: change?.version ?? null,
        },
    );

    if (error) {
        return {
            error:
                error.code === "40001"
                    ? "This invoice changed. Reload details before trying again."
                    : error.code === "42501"
                        ? "Your account does not have active dashboard access."
                        : "Unable to load or save details. Reload and try again.",
        };
    }

    if (change) {
        for (const path of [
            "/",
            "/dashboard",
            "/dashboard/activity",
            "/dashboard/vehicles",
            `/dashboard/invoices/${invoiceId}`,
            `/dashboard/invoices/${invoiceId}/details`,
        ]) {
            revalidatePath(path);
        }
    }

    return { data: data as Assignment };
}