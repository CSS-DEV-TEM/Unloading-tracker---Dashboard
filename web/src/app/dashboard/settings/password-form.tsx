"use client";

import { useActionState, useState } from "react";
import {
    AlertCircle,
    CheckCircle2,
    Eye,
    EyeOff,
    Loader2,
    LockKeyhole,
} from "lucide-react";

import { changePassword } from "./actions";

const inputClass =
    "block h-11 w-full rounded-md border border-input " +
    "bg-background px-3 text-base text-foreground " +
    "outline-none placeholder:text-muted-foreground " +
    "focus-visible:border-ring focus-visible:ring-3 " +
    "focus-visible:ring-ring/25 read-only:opacity-60";

const labelClass =
    "mb-1.5 block text-sm font-semibold text-foreground";

export default function PasswordForm() {
    const [showPasswords, setShowPasswords] = useState(false);

    const [state, formAction, pending] = useActionState(
        changePassword,
        {
            error: "",
            success: "",
        },
    );

    const passwordType = showPasswords ? "text" : "password";

    return (
        <section
            aria-labelledby="security-heading"
            className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
        >
            <div className="flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <LockKeyhole
                        aria-hidden="true"
                        className="size-4"
                    />
                </span>

                <div>
                    <h2
                        id="security-heading"
                        className="font-heading text-lg font-semibold leading-tight text-foreground"
                    >
                        Change password
                    </h2>

                    <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                        Enter your current password first, then choose a new one.
                    </p>
                </div>
            </div>

            <form action={formAction} aria-busy={pending}>
                <div className="space-y-5 p-5 sm:p-6">
                    <div className="max-w-xl">
                        <label
                            htmlFor="current-password"
                            className={labelClass}
                        >
                            Current password
                        </label>

                        <input
                            id="current-password"
                            name="currentPassword"
                            type={passwordType}
                            autoComplete="current-password"
                            required
                            maxLength={1024}
                            readOnly={pending}
                            className={inputClass}
                        />
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="min-w-0">
                            <label
                                htmlFor="new-password"
                                className={labelClass}
                            >
                                New password
                            </label>

                            <input
                                id="new-password"
                                name="newPassword"
                                type={passwordType}
                                autoComplete="new-password"
                                required
                                minLength={12}
                                maxLength={128}
                                readOnly={pending}
                                aria-describedby="password-requirements"
                                className={inputClass}
                            />
                        </div>

                        <div className="min-w-0">
                            <label
                                htmlFor="confirm-password"
                                className={labelClass}
                            >
                                Confirm new password
                            </label>

                            <input
                                id="confirm-password"
                                name="confirmPassword"
                                type={passwordType}
                                autoComplete="new-password"
                                required
                                minLength={12}
                                maxLength={128}
                                readOnly={pending}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <p
                            id="password-requirements"
                            className="max-w-md text-sm leading-5 text-muted-foreground"
                        >
                            Use 12–128 characters, and a password you do not
                            use for any other account.
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                setShowPasswords((current) => !current)
                            }
                            aria-pressed={showPasswords}
                            aria-controls="current-password new-password confirm-password"
                            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {showPasswords ? (
                                <EyeOff
                                    aria-hidden="true"
                                    className="size-4"
                                />
                            ) : (
                                <Eye
                                    aria-hidden="true"
                                    className="size-4"
                                />
                            )}

                            {showPasswords
                                ? "Hide passwords"
                                : "Show passwords"}
                        </button>
                    </div>

                    {state.error && (
                        <p
                            role="alert"
                            className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                        >
                            <AlertCircle
                                aria-hidden="true"
                                className="mt-1 size-4 shrink-0"
                            />
                            {state.error}
                        </p>
                    )}

                    {state.success && (
                        <p
                            role="status"
                            className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium leading-6 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                        >
                            <CheckCircle2
                                aria-hidden="true"
                                className="mt-1 size-4 shrink-0"
                            />
                            {state.success}
                        </p>
                    )}
                </div>

                <div className="flex justify-end border-t border-border bg-muted/30 px-5 py-4 sm:px-6">
                    <button
                        type="submit"
                        disabled={pending}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                    >
                        {pending ? (
                            <Loader2
                                aria-hidden="true"
                                className="size-4 animate-spin motion-reduce:animate-none"
                            />
                        ) : (
                            <LockKeyhole
                                aria-hidden="true"
                                className="size-4"
                            />
                        )}

                        {pending
                            ? "Updating password…"
                            : "Update password"}
                    </button>
                </div>
            </form>
        </section>
    );
}