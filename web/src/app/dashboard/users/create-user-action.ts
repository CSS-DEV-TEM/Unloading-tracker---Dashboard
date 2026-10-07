"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CreateUserState = {
    error: string;
    success: string;
};

export async function createDashboardUser(
    _previous: CreateUserState,
    formData: FormData,
): Promise<CreateUserState> {
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "")
        .trim()
        .toLowerCase();

    // Preserve the password exactly as entered.
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(
        formData.get("confirmPassword") ?? "",
    );

    const fail = (error: string): CreateUserState => ({
        error,
        success: "",
    });

    if (!fullName || fullName.length > 150) {
        return fail("Enter a full name of up to 150 characters.");
    }

    if (
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
        return fail("Enter a valid email address.");
    }

    if (password.length < 12 || password.length > 128) {
        return fail("Use a password between 12 and 128 characters.");
    }

    if (password !== confirmPassword) {
        return fail("The passwords do not match.");
    }

    if (formData.get("emailVerified") !== "on") {
        return fail("Confirm that you checked the user's email address.");
    }

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return fail("Your session has expired. Please sign in again.");
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        return fail("Unable to verify your administrator access.");
    }

    if (!profile?.is_active || profile.role !== "ADMIN") {
        return fail("Active administrator access is required.");
    }

    // Only initialize the privileged client after authorization.
    if (!process.env.SUPABASE_SECRET_KEY) {
        return fail("User creation is not configured on the server.");
    }

    const admin = createAdminClient();

    try {
        const { data, error } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            app_metadata: {
                dashboard_provisioning: "v1",
                dashboard_created_by: user.id,
                dashboard_full_name: fullName,
            },
        });

        if (error) {
            if (
                error.code === "email_exists" ||
                error.code === "user_already_exists"
            ) {
                return fail("An account with this email already exists.");
            }

            if (error.code === "weak_password") {
                return fail(
                    "This password does not meet the project's password policy.",
                );
            }

            return fail(
                "Unable to create the account. Check the server configuration and Supabase Auth logs.",
            );
        }

        if (!data.user) {
            return fail("Account creation could not be confirmed.");
        }
    } catch {
        return fail(
            "The account creation result could not be confirmed. Check the users list and Supabase Authentication before retrying.",
        );
    }

    revalidatePath("/dashboard", "layout");

    return {
        error: "",
        success: `Account created for ${fullName}. They can now sign in.`,
    };
}