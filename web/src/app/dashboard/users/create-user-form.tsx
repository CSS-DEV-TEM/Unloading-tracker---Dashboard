"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { createDashboardUser } from "./create-user-action";

export default function CreateUserForm() {
    const [state, formAction, pending] = useActionState(
        createDashboardUser,
        {
            error: "",
            success: "",
        },
    );

    const inputClass =
        "w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-ring/25";

    return (
        <details className="group rounded-xl border border-border bg-card">
            <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                    <UserPlus className="size-4" aria-hidden="true" />
                </span>

                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                        Create user
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                        Add an account with standard user access.
                    </span>
                </span>

                <span
                    aria-hidden="true"
                    className="text-xl text-muted-foreground group-open:hidden"
                >
                    +
                </span>

                <span
                    aria-hidden="true"
                    className="hidden text-xl text-muted-foreground group-open:block"
                >
                    −
                </span>
            </summary>

            <form
                action={formAction}
                aria-busy={pending}
                className="border-t border-border p-4 sm:p-5"
            >
                <fieldset disabled={pending} className="space-y-5">
                    <div className="grid gap-5 md:grid-cols-2">
                        <div>
                            <label
                                htmlFor="new-user-name"
                                className="mb-2 block text-sm font-medium text-foreground"
                            >
                                Full name
                            </label>

                            <input
                                id="new-user-name"
                                name="fullName"
                                type="text"
                                required
                                maxLength={150}
                                autoComplete="off"
                                placeholder="Enter full name"
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="new-user-email"
                                className="mb-2 block text-sm font-medium text-foreground"
                            >
                                Email address
                            </label>

                            <input
                                id="new-user-email"
                                name="email"
                                type="email"
                                required
                                maxLength={254}
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                placeholder="user@company.com"
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="new-user-password"
                                className="mb-2 block text-sm font-medium text-foreground"
                            >
                                Initial password
                            </label>

                            <input
                                id="new-user-password"
                                name="password"
                                type="password"
                                required
                                minLength={12}
                                maxLength={128}
                                autoComplete="new-password"
                                aria-describedby="password-help"
                                className={inputClass}
                            />

                            <p
                                id="password-help"
                                className="mt-2 text-xs text-muted-foreground"
                            >
                                Use 12–128 characters and a unique password.
                            </p>
                        </div>

                        <div>
                            <label
                                htmlFor="new-user-confirm-password"
                                className="mb-2 block text-sm font-medium text-foreground"
                            >
                                Confirm password
                            </label>

                            <input
                                id="new-user-confirm-password"
                                name="confirmPassword"
                                type="password"
                                required
                                minLength={12}
                                maxLength={128}
                                autoComplete="new-password"
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <label className="flex items-start gap-3 text-sm text-muted-foreground">
                        <input
                            name="emailVerified"
                            type="checkbox"
                            required
                            className="mt-1 h-4 w-4 accent-blue-600"
                        />

                        <span>
                            I have checked that this email belongs to the intended
                            user. This account will be enabled without an email
                            confirmation message.
                        </span>
                    </label>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                            Share the initial credentials directly with the user.
                        </p>

                        <button
                            type="submit"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                        >
                            <UserPlus className="h-4 w-4" aria-hidden="true" />
                            {pending ? "Creating account..." : "Create user"}
                        </button>
                    </div>
                </fieldset>

                {state.error && (
                    <p
                        role="alert"
                        className="mt-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400"
                    >
                        {state.error}
                    </p>
                )}

                {state.success && (
                    <p
                        role="status"
                        className="mt-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-sm text-blue-700 dark:text-blue-400"
                    >
                        {state.success}
                    </p>
                )}
            </form>
        </details>
    );
}