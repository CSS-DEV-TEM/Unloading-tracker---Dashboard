import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

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

    const name = profile.full_name?.trim() || "Workspace user";

    const initials = name
        .split(/\s+/)
        .slice(0, 2)
        .map((part: string) => part[0])
        .join("")
        .toUpperCase();

    const role =
        profile.role === "ADMIN" ? "Administrator" : "User";

    return (
        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-4xl space-y-6">
                <header>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                        Account settings
                    </h1>

                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Your workspace identity and sign-in security.
                    </p>
                </header>

                <section
                    aria-labelledby="account-heading"
                    className="overflow-hidden rounded-xl border border-border bg-card"
                >
                    <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
                        <div
                            aria-hidden="true"
                            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-base font-semibold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300"
                        >
                            {initials}
                        </div>

                        <div className="min-w-0 flex-1">
                            <h2
                                id="account-heading"
                                className="break-words text-base font-semibold text-foreground"
                            >
                                {name}
                            </h2>

                            <p className="mt-1 break-all text-sm text-muted-foreground">
                                {user.email || "Email unavailable"}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                                <ShieldCheck
                                    aria-hidden="true"
                                    className="size-3.5"
                                />
                                {role}
                            </span>

                            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                                <span
                                    aria-hidden="true"
                                    className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"
                                />
                                Active
                            </span>
                        </div>
                    </div>

                    <p className="border-t border-border px-5 py-3 text-xs leading-5 text-muted-foreground sm:px-6">
                        To update your name, email or role, contact
                        your administrator.
                    </p>
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
                <div
                    role="status"
                    className="px-6 py-8 text-sm text-muted-foreground"
                >
                    Loading account settings…
                </div>
            }
        >
            <SettingsContent />
        </Suspense>
    );
}