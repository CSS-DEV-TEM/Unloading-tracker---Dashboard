import ThemeToggle from "@/components/theme-toggle";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PasswordForm from "./password-form";

async function SettingsContent() {
    await connection();

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name, role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (error) {
        throw new Error("Unable to load account settings.");
    }

    if (!profile?.is_active) {
        redirect("/dashboard");
    }

    return (
        <main className="min-h-screen bg-background px-4 py-8 sm:px-8">
            <div className="mx-auto max-w-2xl">
                <div className="mb-5 flex justify-end"><ThemeToggle /></div>
                <Link
                    href="/dashboard"
                    className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline"
                >
                    ← Back to dashboard
                </Link>

                <header className="mb-7 mt-6">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        Account Settings
                    </h1>

                    <p className="mt-2 text-sm text-muted-foreground">
                        Manage your account password.
                    </p>
                </header>

                <section className="mb-6 rounded-2xl border border-border bg-card p-6">
                    <p className="font-semibold text-foreground">
                        {profile.full_name}
                    </p>

                    <p className="mt-1 break-all text-sm text-muted-foreground">
                        {user.email}
                    </p>

                    <span className="mt-3 inline-flex rounded-full bg-blue-50 dark:bg-blue-950/40 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
                        {profile.role === "ADMIN" ? "Administrator" : "User"}
                    </span>
                </section>

                <PasswordForm />
            </div>
        </main>
    );
}

export default function SettingsPage() {
    return (
        <Suspense
            fallback={
                <div className="p-8 text-sm text-muted-foreground">
                    Loading account settings...
                </div>
            }
        >
            <SettingsContent />
        </Suspense>
    );
}