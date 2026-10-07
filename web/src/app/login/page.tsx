"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PackageOpen } from "lucide-react";
import { signIn } from "./actions";

export default function LoginPage() {
    const [state, formAction, pending] = useActionState(signIn, {
        error: "",
    });

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
            <div className="w-full max-w-md">
                <Link
                    href="/"
                    className="mb-6 inline-block text-sm text-blue-700 hover:underline"
                >
                    ← Back to invoice overview
                </Link>

                <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                    <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-blue-700 text-white">
                        <PackageOpen className="size-6" aria-hidden="true" />
                    </div>

                    <p className="text-xs font-semibold tracking-widest text-blue-700">
                        EFL · 3PL
                    </p>

                    <h1 className="mt-3 text-2xl font-semibold text-slate-900">
                        Sign in to your workspace
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                        Use the account provided by your administrator.
                    </p>

                    <form action={formAction} className="mt-7 space-y-5">
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-2 block text-sm font-medium text-slate-700"
                            >
                                Email address
                            </label>

                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="username"
                                required
                                maxLength={254}
                                readOnly={pending}
                                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="mb-2 block text-sm font-medium text-slate-700"
                            >
                                Password
                            </label>

                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                maxLength={1024}
                                readOnly={pending}
                                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        {state.error && (
                            <p
                                role="alert"
                                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                            >
                                {state.error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={pending}
                            className="h-11 w-full rounded-lg bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
                        >
                            {pending ? "Signing in..." : "Sign In"}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-xs leading-5 text-slate-500">
                        Need access? Contact your dashboard administrator.
                    </p>
                </section>
            </div>
        </main>
    );
}