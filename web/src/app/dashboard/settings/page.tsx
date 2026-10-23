import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Info, Mail, ShieldCheck } from "lucide-react";

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
                <header className="dock-rise flex items-start gap-3.5 border-b border-border pb-6">
                    <span
                        aria-hidden="true"
                        className="mt-1 h-8 w-1 shrink-0 rounded-full bg-signal"
                    />

                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                            Account settings
                        </h1>

                        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                            Review your workspace profile and keep your
                            sign-in secure.
                        </p>
                    </div>
                </header>

                <section
                    aria-labelledby="account-heading"
                    className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
                >
                    <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
                        <div
                            aria-hidden="true"
                            className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground"
                        >
                            {initials}
                        </div>

                        <div className="min-w-0 flex-1">
                            <h2
                                id="account-heading"
                                className="break-words text-xl font-semibold text-foreground"
                            >
                                {name}
                            </h2>

                            <p className="mt-1 flex items-center gap-1.5 break-all text-sm text-muted-foreground">
                                <Mail
                                    aria-hidden="true"
                                    className="size-3.5 shrink-0"
                                />
                                {user.email || "Email unavailable"}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                                <ShieldCheck
                                    aria-hidden="true"
                                    className="size-3.5"
                                />
                                {role}
                            </span>

                            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 before:size-1.5 before:rounded-full before:bg-current before:content-[''] dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                                Active
                            </span>
                        </div>
                    </div>

                    <p className="flex items-start gap-2 border-t border-border bg-muted/30 px-5 py-3.5 text-sm leading-5 text-muted-foreground sm:px-6">
                        <Info
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0"
                        />
                        Your name, email and role are managed by an
                        administrator. Contact them if any of these need to
                        change.
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