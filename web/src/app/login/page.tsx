"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, Loader2, PackageOpen } from "lucide-react";

import ThemeToggle from "@/components/theme-toggle";
import { signIn } from "./actions";

const inputClass =
    "block h-12 w-full rounded-xl border border-input bg-background " +
    "px-4 text-base text-foreground caret-current shadow-sm outline-none " +
    "placeholder:text-muted-foreground focus-visible:border-ring " +
    "focus-visible:ring-2 focus-visible:ring-ring/30 " +
    "read-only:opacity-70";

export default function LoginPage() {
    const [state, formAction, pending] = useActionState(signIn, {
        error: "",
    });

    return (
        <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
            <div className="w-full max-w-md">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <Link
                        href="/"
                        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
                        <span>Back to invoice overview</span>
                    </Link>

                    <ThemeToggle />
                </div>

                <section
                    aria-labelledby="login-heading"
                    className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl shadow-black/5 sm:p-8"
                >
                    <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-blue-700 text-white">
                        <PackageOpen className="size-6" aria-hidden="true" />
                    </div>

                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-300">
                        EFL · 3PL
                    </p>

                    <h1
                        id="login-heading"
                        className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-card-foreground"
                    >
                        Sign in to your workspace
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Use the account provided by your administrator.
                    </p>

                    <form
                        action={formAction}
                        aria-busy={pending}
                        className="mt-8 space-y-5"
                    >
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-2 block text-sm font-medium text-card-foreground"
                            >
                                Email address
                            </label>

                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="username"
                                autoCapitalize="none"
                                spellCheck={false}
                                placeholder="you@company.com"
                                required
                                maxLength={254}
                                readOnly={pending}
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="mb-2 block text-sm font-medium text-card-foreground"
                            >
                                Password
                            </label>

                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                placeholder="Enter your password"
                                required
                                maxLength={1024}
                                readOnly={pending}
                                className={inputClass}
                            />
                        </div>

                        {state.error && (
                            <p
                                role="alert"
                                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                            >
                                {state.error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={pending}
                            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-wait disabled:opacity-60"
                        >
                            {pending && (
                                <Loader2
                                    className="size-4 animate-spin motion-reduce:animate-none"
                                    aria-hidden="true"
                                />
                            )}

                            {pending ? "Signing in..." : "Sign In"}
                        </button>
                    </form>

                    <div className="mt-7 border-t border-border pt-5">
                        <p className="text-center text-xs leading-6 text-muted-foreground">
                            Need access? Contact your dashboard administrator.
                        </p>
                    </div>
                </section>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                    Unloading Tracker · CSS Division
                </p>
            </div>
        </main>
    );
}