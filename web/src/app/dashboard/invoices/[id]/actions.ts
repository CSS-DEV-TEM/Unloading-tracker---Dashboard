"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type UpdateState = {
    error: string;
    conflict: boolean;
};

function parseDate(value: string): string | null {
    if (!value) return null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error("Select a valid ASN share date.");
    }

    const date = new Date(`${value}T00:00:00Z`);

    if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
    ) {
        throw new Error("Select a valid ASN share date.");
    }

    return value;
}

function toTimestamp(value: string): string | null {
    if (!value) return null;

    if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)
    ) {
        throw new Error("Select a valid processing date and time.");
    }

    const normalized = value.length === 16 ? `${value}:00` : value;

    // Form date/time values are interpreted in Sri Lanka time.
    const date = new Date(`${normalized}+05:30`);

    if (Number.isNaN(date.getTime())) {
        throw new Error("Select a valid processing date and time.");
    }

    const roundTrip = new Date(
        date.getTime() + 330 * 60 * 1000,
    ).toISOString().slice(0, 19);

    if (roundTrip !== normalized) {
        throw new Error("Select a valid processing date and time.");
    }

    return date.toISOString();
}

export async function updateInvoiceProcess(
    _previousState: UpdateState,
    formData: FormData,
): Promise<UpdateState> {
    const text = (name: string) => {
        const value = formData.get(name);
        return typeof value === "string" ? value.trim() : "";
    };

    const fail = (error: string, conflict = false): UpdateState => ({
        error,
        conflict,
    });

    const invoiceId = text("invoiceId");
    const version = Number(text("version"));
    const status = text("status");

    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            invoiceId,
        ) ||
        !Number.isSafeInteger(version) ||
        version < 1 ||
        version > 2147483647
    ) {
        return fail("Invalid invoice reference. Reload the page.");
    }

    if (!["Pending", "Complete", "Reject"].includes(status)) {
        return fail("Select a valid final status.");
    }

    const systems = text("systems").split(",");

    if (
        systems.length < 1 ||
        systems.length > 2 ||
        new Set(systems).size !== systems.length ||
        systems.some((system) => !["AX", "D365"].includes(system))
    ) {
        return fail("Invalid processing stages. Reload the page.");
    }

    const pendingReason = text("pendingReason");
    const remark = text("remark");
    const asnUser = text("asnUser");

    if (pendingReason.length > 5000 || remark.length > 5000) {
        return fail("Pending reason and remark must be within 5000 characters.");
    }

    if (asnUser.length > 150) {
        return fail("ASN user name must be within 150 characters.");
    }

    let asnDate: string | null;
    let stages: {
        system_name: string;
        started_at: string | null;
        ended_at: string | null;
        is_done: boolean;
        assigned_user_name: string | null;
    }[];

    try {
        asnDate = parseDate(text("asnDate"));

        stages = systems.map((system) => {
            const start = toTimestamp(text(`${system}.start`));
            const end = toTimestamp(text(`${system}.end`));
            const userName = text(`${system}.user`);

            if (end && (!start || Date.parse(end) < Date.parse(start))) {
                throw new Error(
                    `${system}: End date/time must not be before start date/time.`,
                );
            }

            if (userName.length > 150) {
                throw new Error(`${system}: User name must be within 150 characters.`);
            }

            return {
                system_name: system,
                started_at: start,
                ended_at: end,
                is_done: formData.get(`${system}.done`) === "on",
                assigned_user_name: userName || null,
            };
        });
    } catch (error) {
        return fail(
            error instanceof Error ? error.message : "Check the entered dates.",
        );
    }

    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return fail("Your session has expired. Sign in again before saving.");
    }

    const { error } = await supabase.rpc("update_invoice_process", {
        p_invoice_id: invoiceId,
        p_expected_version: version,
        p_stages: stages,
        p_pending_reason: pendingReason || null,
        p_asn_share_date: asnDate,
        p_asn_shared: formData.get("asnShared") === "on",
        p_asn_user_name: asnUser || null,
        p_remark: remark || null,
        p_status: status,
    });

    if (error) {
        if (error.code === "40001") {
            return fail(
                "Another user updated this invoice. Copy any changes you want to keep, then reload the latest record.",
                true,
            );
        }

        if (error.code === "42501") {
            return fail("Your account does not have active dashboard access.");
        }

        if (error.code === "P0002") {
            return fail("This invoice could not be found.");
        }

        return fail("Unable to save changes. Check the values and try again.");
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/invoices/${invoiceId}`);
    redirect("/dashboard?notice=process-updated");
}