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
        "w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

    return (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                    <UserPlus className="h-5 w-5" aria-hidden="true" />
                </div>

                <div>
                    <h2 className="font-semibold text-slate-900">
                        Create user
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                        New accounts receive standard user access.
                    </p>
                </div>
            </div>

            <form action={formAction}>
                <fieldset disabled={pending} className="space-y-5">
                    <div className="grid gap-5 md:grid-cols-2">
                        <div>
                            <label
                                htmlFor="new-user-name"
                                className="mb-2 block text-sm font-medium text-slate-700"
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
                                className="mb-2 block text-sm font-medium text-slate-700"
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
                                className="mb-2 block text-sm font-medium text-slate-700"
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
                                className="mt-2 text-xs text-slate-500"
                            >
                                Use 12–128 characters and a unique password.
                            </p>
                        </div>

                        <div>
                            <label
                                htmlFor="new-user-confirm-password"
                                className="mb-2 block text-sm font-medium text-slate-700"
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

                    <label className="flex items-start gap-3 text-sm text-slate-600">
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
                        <p className="text-xs text-slate-500">
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
                        className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                        {state.error}
                    </p>
                )}

                {state.success && (
                    <p
                        role="status"
                        className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700"
                    >
                        {state.success}
                    </p>
                )}
            </form>
        </section>
    );
}