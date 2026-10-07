"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AccessState = {
    error: string;
    success: string;
};

export async function changeUserAccess(
    _previous: AccessState,
    formData: FormData,
): Promise<AccessState> {
    const userId = String(formData.get("userId") ?? "");
    const expected = String(formData.get("expectedActive") ?? "");
    const desired = String(formData.get("isActive") ?? "");

    const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
        !uuidPattern.test(userId) ||
        !["true", "false"].includes(expected) ||
        !["true", "false"].includes(desired)
    ) {
        return {
            error: "Invalid account update.",
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

    const { error } = await supabase.rpc("set_user_active", {
        p_user_id: userId,
        p_expected_active: expected === "true",
        p_is_active: desired === "true",
    });

    if (error) {
        const messages: Record<string, string> = {
            "42501": "Active administrator access is required.",
            "40001":
                "Another administrator changed this account. Refresh the page before trying again.",
            "P0002": "This user profile could not be found.",
            "22023": "This account access change is not allowed.",
        };

        return {
            error: messages[error.code] ?? "Unable to update account access.",
            success: "",
        };
    }

    revalidatePath("/dashboard", "layout");

    return {
        error: "",
        success:
            desired === "true"
                ? "Account activated."
                : "Account deactivated.",
    };
}