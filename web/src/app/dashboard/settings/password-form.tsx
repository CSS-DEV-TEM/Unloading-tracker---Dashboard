"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import { changePassword } from "./actions";

export default function PasswordForm() {
    const [state, formAction, pending] = useActionState(
        changePassword,
        {
            error: "",
            success: "",
        },
    );

    const inputClass =
        "w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-ring/25";

    return (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3 text-blue-600 dark:text-blue-400">
                    <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                </div>

                <div>
                    <h2 className="font-semibold text-foreground">
                        Change password
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                        Confirm your current password to set a new one.
                    </p>
                </div>
            </div>

            <form action={formAction}>
                <fieldset disabled={pending} className="space-y-5">
                    <div>
                        <label
                            htmlFor="current-password"
                            className="mb-2 block text-sm font-medium text-foreground"
                        >
                            Current password
                        </label>

                        <input
                            id="current-password"
                            name="currentPassword"
                            type="password"
                            autoComplete="current-password"
                            required
                            maxLength={1024}
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="new-password"
                            className="mb-2 block text-sm font-medium text-foreground"
                        >
                            New password
                        </label>

                        <input
                            id="new-password"
                            name="newPassword"
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={12}
                            maxLength={128}
                            aria-describedby="new-password-help"
                            className={inputClass}
                        />

                        <p
                            id="new-password-help"
                            className="mt-2 text-xs text-muted-foreground"
                        >
                            Use 12–128 characters and a password you do not use
                            for other accounts.
                        </p>
                    </div>

                    <div>
                        <label
                            htmlFor="confirm-password"
                            className="mb-2 block text-sm font-medium text-foreground"
                        >
                            Confirm new password
                        </label>

                        <input
                            id="confirm-password"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={12}
                            maxLength={128}
                            className={inputClass}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={pending}
                        className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                    >
                        {pending ? "Updating password..." : "Update password"}
                    </button>
                </fieldset>

                {state.error && (
                    <p
                        role="alert"
                        className="mt-5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400"
                    >
                        {state.error}
                    </p>
                )}

                {state.success && (
                    <p
                        role="status"
                        className="mt-5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-4 text-sm text-blue-700 dark:text-blue-400"
                    >
                        {state.success}
                    </p>
                )}
            </form>
        </section>
    );
}