"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type PasswordState = {
    error: string;
    success: string;
};

export async function changePassword(
    _previous: PasswordState,
    formData: FormData,
): Promise<PasswordState> {
    const currentPassword = String(
        formData.get("currentPassword") ?? "",
    );

    const newPassword = String(formData.get("newPassword") ?? "");

    const confirmPassword = String(
        formData.get("confirmPassword") ?? "",
    );

    const fail = (error: string): PasswordState => ({
        error,
        success: "",
    });

    if (!currentPassword || currentPassword.length > 1024) {
        return fail("Enter your current password.");
    }

    if (newPassword.length < 12 || newPassword.length > 128) {
        return fail("Use a new password between 12 and 128 characters.");
    }

    if (newPassword !== confirmPassword) {
        return fail("The new passwords do not match.");
    }

    if (currentPassword === newPassword) {
        return fail("Choose a password different from your current password.");
    }

    const supabase = await createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
        return fail("Your session has expired. Please sign in again.");
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile?.is_active) {
        return fail("An active dashboard account is required.");
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
        return fail("Account settings are not configured.");
    }

    // A separate, in-memory client verifies the current password.
    // It does not replace the browser's session cookies.
    const verificationClient = createSupabaseClient(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });

    let verifiedSessionCreated = false;

    try {
        const { data: verified, error: verificationError } =
            await verificationClient.auth.signInWithPassword({
                email: user.email,
                password: currentPassword,
            });

        verifiedSessionCreated = Boolean(verified.session);

        if (
            verificationError ||
            !verified.session ||
            verified.user?.id !== user.id
        ) {
            return fail(
                "Unable to verify your current password. Check it and try again.",
            );
        }

        const { error: updateError } =
            await verificationClient.auth.updateUser({
                password: newPassword,
            });

        if (updateError) {
            if (updateError.code === "weak_password") {
                return fail(
                    "The new password does not meet the project's password policy.",
                );
            }

            if (updateError.code === "same_password") {
                return fail("Choose a different new password.");
            }

            return fail(
                "Unable to change the password. Please try again.",
            );
        }

        return {
            error: "",
            success:
                "Your password has been changed. Use the new password the next time you sign in.",
        };
    } catch {
        return fail(
            "The result could not be confirmed. Try signing in with the new password before repeating the change.",
        );
    } finally {
        if (verifiedSessionCreated) {
            // Clean up only the temporary verification session.
            try {
                await verificationClient.auth.signOut({ scope: "local" });
            } catch {
                // Do not hide a successful password update if cleanup fails.
            }
        }
    }
}