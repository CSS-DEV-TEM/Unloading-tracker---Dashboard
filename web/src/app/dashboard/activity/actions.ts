"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ClearActivityState = {
    error: string;
    success: string;
};

export async function clearActivityLogs(
    _previous: ClearActivityState,
    formData: FormData,
): Promise<ClearActivityState> {
    const confirmation = String(formData.get("confirmation") ?? "");

    if (confirmation !== "CLEAR") {
        return {
            error: "Type CLEAR exactly to confirm.",
            success: "",
        };
    }

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            error: "Your session has expired. Please sign in again.",
            success: "",
        };
    }

    const { data, error } = await supabase.rpc("clear_activity_logs", {
        p_confirmation: confirmation,
    });

    if (error) {
        console.error("[clear_activity_logs] Supabase error:", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
        });

        return {
            error:
                error.code === "42501"
                    ? "Active administrator access is required."
                    : `Unable to clear activity logs. Error code: ${error.code}`,
            success: "",
        };
    }

    revalidatePath("/dashboard/activity");

    return {
        error: "",
        success: `${data} activity records cleared. A record of this action was retained.`,
    };
}