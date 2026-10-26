"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Progress = {
    version: number;
    status: string;
    asn_shared: boolean;
    stages: { system_name: "AX" | "D365"; is_done: boolean }[];
};
export type ProgressResult = { data?: Progress; error?: string };

export async function invoiceQuickProgress(
    invoiceId: string,
    change?: { field: "AX" | "D365" | "ASN"; checked: boolean; version: number },
): Promise<ProgressResult> {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(invoiceId)) {
        return { error: "Invalid invoice reference." };
    }
    if (change && (!['AX', 'D365', 'ASN'].includes(change.field) ||
        typeof change.checked !== 'boolean' || !Number.isSafeInteger(change.version) || change.version < 1)) {
        return { error: "Invalid progress change." };
    }
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "Sign in again to update progress." };
    const { data, error } = await supabase.rpc("invoice_quick_progress", {
        p_invoice_id: invoiceId,
        p_field: change?.field ?? null,
        p_checked: change?.checked ?? null,
        p_expected_version: change?.version ?? null,
    });
    if (error) return {
        error: error.code === '40001'
            ? "This invoice changed. Reload ticks before trying again."
            : error.code === '42501' ? "Your account does not have active dashboard access."
                : "Unable to update progress. Reload ticks and try again."
    };
    if (change) {
        for (const path of ['/', '/dashboard', '/dashboard/activity', '/dashboard/vehicles',
            `/dashboard/invoices/${invoiceId}`, `/dashboard/invoices/${invoiceId}/details`]) {
            revalidatePath(path);
        }
    }
    return { data: data as Progress };
}
