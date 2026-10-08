"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { updateInvoiceProcess } from "./actions";
import type { ProcessFormData, ProcessStage } from "./types";

const inputClass =
    "mt-2 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-blue-600 focus:ring-2 focus:ring-ring/25";

const textareaClass =
    "mt-2 min-h-28 w-full rounded-lg border border-input bg-card p-3 text-sm text-foreground outline-none focus:border-blue-600 focus:ring-2 focus:ring-ring/25";

export default function ProcessForm({
    initial,
    userNames,
}: {
    initial: ProcessFormData;
    userNames: string[];
}) {
    const [form, setForm] = useState(initial);

    const [state, formAction, pending] = useActionState(
        updateInvoiceProcess,
        {
            error: "",
            conflict: false,
        },
    );

    function updateStage(
        system: ProcessStage["system_name"],
        changes: Partial<ProcessStage>,
    ) {
        setForm((previous) => ({
            ...previous,
            stages: previous.stages.map((stage) =>
                stage.system_name === system ? { ...stage, ...changes } : stage,
            ),
        }));
    }

    function reloadLatest() {
        const confirmed = window.confirm(
            "Reload the latest record? Unsaved changes in this form will be discarded.",
        );

        if (confirmed) window.location.reload();
    }

    return (
        <form action={formAction} className="space-y-6">
            <input type="hidden" name="invoiceId" value={form.invoice_id} />
            <input type="hidden" name="version" value={form.version} />
            <input
                type="hidden"
                name="systems"
                value={form.stages.map((stage) => stage.system_name).join(",")}
            />

            <datalist id="dashboard-users">
                {userNames.map((name) => (
                    <option key={name} value={name} />
                ))}
            </datalist>

            <p className="text-sm text-muted-foreground">
                All processing times use Sri Lanka time (UTC+05:30).
            </p>

            <fieldset disabled={pending} className="space-y-6">
                <legend className="sr-only">Invoice process updates</legend>

                {form.stages.map((stage) => {
                    const system = stage.system_name;

                    return (
                        <section
                            key={system}
                            aria-labelledby={`${system}-heading`}
                            className="rounded-xl border border-border bg-card p-6"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <h2 id={`${system}-heading`} className="font-semibold">
                                        {system} Pre GRN
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Record processing dates and the responsible user.
                                    </p>
                                </div>

                                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                                    <input
                                        name={`${system}.done`}
                                        type="checkbox"
                                        checked={stage.is_done}
                                        onChange={(event) =>
                                            updateStage(system, { is_done: event.target.checked })
                                        }
                                        className="size-4 accent-blue-700"
                                    />
                                    Done
                                </label>
                            </div>

                            <div className="mt-5 grid gap-5 sm:grid-cols-2">
                                <div>
                                    <label
                                        htmlFor={`${system}-start`}
                                        className="text-sm font-medium"
                                    >
                                        Start date &amp; time
                                    </label>
                                    <input
                                        id={`${system}-start`}
                                        name={`${system}.start`}
                                        type="datetime-local"
                                        step="1"
                                        value={stage.started_at}
                                        onChange={(event) =>
                                            updateStage(system, { started_at: event.target.value })
                                        }
                                        className={inputClass}
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor={`${system}-end`}
                                        className="text-sm font-medium"
                                    >
                                        End date &amp; time
                                    </label>
                                    <input
                                        id={`${system}-end`}
                                        name={`${system}.end`}
                                        type="datetime-local"
                                        step="1"
                                        min={stage.started_at || undefined}
                                        value={stage.ended_at}
                                        onChange={(event) =>
                                            updateStage(system, { ended_at: event.target.value })
                                        }
                                        className={inputClass}
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label
                                        htmlFor={`${system}-user`}
                                        className="text-sm font-medium"
                                    >
                                        {system} Pre GRN user
                                    </label>
                                    <input
                                        id={`${system}-user`}
                                        name={`${system}.user`}
                                        list="dashboard-users"
                                        autoComplete="off"
                                        maxLength={150}
                                        value={stage.assigned_user_name}
                                        onChange={(event) =>
                                            updateStage(system, {
                                                assigned_user_name: event.target.value,
                                            })
                                        }
                                        placeholder="Type a name or choose a suggestion"
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </section>
                    );
                })}

                <section className="rounded-xl border border-border bg-card p-6">
                    <h2 className="font-semibold">Pending reason</h2>
                    <label htmlFor="pending-reason" className="sr-only">
                        Reason for pending work
                    </label>
                    <textarea
                        id="pending-reason"
                        name="pendingReason"
                        maxLength={5000}
                        value={form.pending_reason}
                        onChange={(event) =>
                            setForm({ ...form, pending_reason: event.target.value })
                        }
                        placeholder="If the task is pending, add a reason here (optional)."
                        className={textareaClass}
                    />
                </section>

                <section className="rounded-xl border border-border bg-card p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <h2 className="font-semibold">ASN details</h2>

                        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                            <input
                                type="checkbox"
                                name="asnShared"
                                checked={form.asn_shared}
                                onChange={(event) =>
                                    setForm({ ...form, asn_shared: event.target.checked })
                                }
                                className="size-4 accent-blue-700"
                            />
                            ASN SHARE
                        </label>
                    </div>

                    <div className="mt-5 grid gap-5 sm:grid-cols-2">
                        <div>
                            <label htmlFor="asn-date" className="text-sm font-medium">
                                ASN share date
                            </label>
                            <input
                                id="asn-date"
                                name="asnDate"
                                type="date"
                                value={form.asn_share_date}
                                onChange={(event) =>
                                    setForm({ ...form, asn_share_date: event.target.value })
                                }
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label htmlFor="asn-user" className="text-sm font-medium">
                                ASN user
                            </label>
                            <input
                                id="asn-user"
                                name="asnUser"
                                list="dashboard-users"
                                autoComplete="off"
                                maxLength={150}
                                value={form.asn_user_name}
                                onChange={(event) =>
                                    setForm({ ...form, asn_user_name: event.target.value })
                                }
                                placeholder="Type or select a name"
                                className={inputClass}
                            />
                        </div>
                    </div>
                </section>

                <section
                    className={`rounded-xl border p-6 ${form.remark.trim()
                            ? "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40"
                            : "border-border bg-card"
                        }`}
                >
                    <h2 className="font-semibold">Remark</h2>
                    <label htmlFor="remark" className="sr-only">
                        Additional remark
                    </label>
                    <textarea
                        id="remark"
                        name="remark"
                        maxLength={5000}
                        value={form.remark}
                        onChange={(event) =>
                            setForm({ ...form, remark: event.target.value })
                        }
                        placeholder="Add an optional remark."
                        className={textareaClass}
                    />
                </section>

                <section className="rounded-xl border border-border bg-card p-6">
                    <label htmlFor="status" className="font-semibold">
                        Final status
                    </label>

                    <select
                        id="status"
                        name="status"
                        value={form.status}
                        onChange={(event) =>
                            setForm({
                                ...form,
                                status: event.target.value as ProcessFormData["status"],
                            })
                        }
                        className={`${inputClass} sm:max-w-xs`}
                    >
                        <option value="Pending">Pending</option>
                        <option value="Complete">Complete</option>
                        <option value="Reject">Reject</option>
                    </select>

                    <p className="mt-3 text-sm text-muted-foreground">
                        Choose Complete when the overall task is finished.
                    </p>
                </section>
            </fieldset>

            {state.error && (
                <div
                    role="alert"
                    className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-800 dark:text-red-300"
                >
                    <p>{state.error}</p>

                    {state.conflict && (
                        <button
                            type="button"
                            onClick={reloadLatest}
                            className="mt-3 rounded-lg border border-red-300 dark:border-red-900 bg-card px-3 py-2 font-semibold"
                        >
                            Reload latest record
                        </button>
                    )}
                </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3">
                <Link
                    href="/dashboard"
                    className="rounded-lg border border-input bg-card px-4 py-3 text-sm font-medium"
                >
                    Back to dashboard
                </Link>

                <button
                    type="submit"
                    disabled={pending || state.conflict}
                    className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {pending ? "Saving changes..." : "Save Changes"}
                </button>
            </div>
        </form>
    );
}