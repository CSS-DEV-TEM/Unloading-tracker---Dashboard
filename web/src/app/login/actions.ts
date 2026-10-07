"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type LoginState = {
    error: string;
};

export async function signIn(
    _previousState: LoginState,
    formData: FormData,
): Promise<LoginState> {
    const emailValue = formData.get("email");
    const passwordValue = formData.get("password");

    if (
        typeof emailValue !== "string" ||
        typeof passwordValue !== "string"
    ) {
        return { error: "Enter your email and password." };
    }

    const email = emailValue.trim();
    const password = passwordValue;

    if (!email || !password || email.length > 254 || password.length > 1024) {
        return { error: "Enter a valid email and password." };
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error || !data.user) {
        return {
            error: "Unable to sign in. Check your credentials and try again.",
        };
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", data.user.id)
        .maybeSingle();

    if (profileError) {
        await supabase.auth.signOut({ scope: "local" });

        return {
            error: "Unable to verify account access. Please try again.",
        };
    }

    if (
        !profile?.is_active ||
        !["ADMIN", "USER"].includes(profile.role)
    ) {
        await supabase.auth.signOut({ scope: "local" });

        return {
            error: "Your account has no active dashboard access. Contact an administrator.",
        };
    }

    redirect("/dashboard");
}

export async function signOut() {
    const supabase = await createClient();

    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
        throw new Error("Unable to sign out. Please try again.");
    }

    redirect("/login");
}