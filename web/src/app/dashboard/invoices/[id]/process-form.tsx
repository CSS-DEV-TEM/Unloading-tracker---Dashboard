"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { updateInvoiceProcess } from "./actions";
import type { ProcessFormData, ProcessStage } from "./types";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
const inputClass = "mt-2 h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-blue-600 focus:ring-2 focus:ring-ring/25";
const textareaClass = "mt-2 min-h-16 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm text-foreground outline-none focus:border-blue-600 focus:ring-2 focus:ring-ring/25";
export default function ProcessForm({ initial, userNames, }: {
    initial: ProcessFormData;
    userNames: string[];
}) {
    const [form, setForm] = useState(initial);
    const reopening = initial.asn_shared && !form.asn_shared;
    const effectiveStatus = form.asn_shared
        ? "Complete"
        : reopening
            ? "Pending"
            : form.status === "Reject"
                ? "Reject"
                : "Pending";
    const [state, formAction, pending] = useActionState(updateInvoiceProcess, {
        error: "",
        conflict: false,
    });
    const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(initial);
    const { reloadWithoutWarning } = useUnsavedChanges(hasUnsavedChanges, pending);
    function updateStage(system: ProcessStage["system_name"], changes: Partial<ProcessStage>) {
        setForm((previous) => ({
            ...previous,
            stages: previous.stages.map((stage) => stage.system_name === system ? { ...stage, ...changes } : stage),
        }));
    }
    function reloadLatest() {
        if (pending)
            return;
        if (hasUnsavedChanges &&
            !window.confirm("Reload the latest record? Your unsaved changes will be discarded.")) {
            return;
        }
        reloadWithoutWarning();
    }
    return (<form action={formAction} aria-busy={pending} className="space-y-3">
        <input type="hidden" name="invoiceId" value={form.invoice_id} />
        <input type="hidden" name="version" value={form.version} />
        <input type="hidden" name="systems" value={form.stages.map((stage) => stage.system_name).join(",")} />

        <datalist id="dashboard-users">
            {userNames.map((name) => (<option key={name} value={name} />))}
        </datalist>

        <p className="text-xs text-muted-foreground">
            Processing times · Sri Lanka (UTC+05:30)
        </p>

        <fieldset disabled={pending} className="min-w-0 space-y-3">
            <legend className="sr-only">Invoice process updates</legend>

            <div className="grid min-w-0 items-stretch gap-3 md:grid-cols-2">
                <div className={form.stages.length === 2
                    ? "grid min-w-0 grid-cols-1 divide-y divide-border rounded-xl border border-border bg-card xl:grid-cols-2 xl:divide-x xl:divide-y-0"
                    : "min-w-0"}>
                    {form.stages.map((stage) => {
                        const system = stage.system_name;
                        return (<section key={system} aria-labelledby={`${system}-heading`} className={form.stages.length === 2
                            ? "min-w-0 p-4"
                            : "min-w-0 rounded-xl border border-border bg-card p-4"}>
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <h2 id={`${system}-heading`} className="font-semibold">
                                        {system} Pre GRN
                                    </h2>

                                </div>

                                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                                    <input name={`${system}.done`} type="checkbox" checked={stage.is_done} onChange={(event) => updateStage(system, { is_done: event.target.checked })} className="size-4 accent-blue-700" />
                                    Done
                                </label>
                            </div>

                            <div className="mt-3 grid min-w-0 gap-3">
                                <div>
                                    <label htmlFor={`${system}-start`} className="text-sm font-medium">
                                        Start date &amp; time
                                    </label>
                                    <input id={`${system}-start`} name={`${system}.start`} type="datetime-local" step="1" value={stage.started_at} onChange={(event) => updateStage(system, { started_at: event.target.value })} className={inputClass} />
                                </div>

                                <div>
                                    <label htmlFor={`${system}-end`} className="text-sm font-medium">
                                        End date &amp; time
                                    </label>
                                    <input id={`${system}-end`} name={`${system}.end`} type="datetime-local" step="1" min={stage.started_at || undefined} value={stage.ended_at} onChange={(event) => updateStage(system, { ended_at: event.target.value })} className={inputClass} />
                                </div>

                                <div className="min-w-0">
                                    <label htmlFor={`${system}-user`} className="text-sm font-medium">
                                        {system} Pre GRN user
                                    </label>
                                    <input id={`${system}-user`} name={`${system}.user`} list="dashboard-users" autoComplete="off" maxLength={150} value={stage.assigned_user_name} onChange={(event) => updateStage(system, {
                                        assigned_user_name: event.target.value,
                                    })} placeholder="Type a name or choose a suggestion" className={inputClass} />
                                </div>
                            </div>
                        </section>);
                    })}
                </div>

                <section className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <h2 className="font-semibold">ASN details</h2>

                        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                            <input type="checkbox" name="asnShared" checked={form.asn_shared} onChange={(event) => setForm({ ...form, asn_shared: event.target.checked, status: event.target.checked ? "Complete" : "Pending" })} className="size-4 accent-blue-700" />
                            ASN SHARE
                        </label>
                    </div>

                    <div className="mt-3 grid min-w-0 gap-3">
                        <div>
                            <label htmlFor="asn-date" className="text-sm font-medium">
                                ASN share date
                            </label>
                            <input id="asn-date" name="asnDate" type="date" value={form.asn_share_date} onChange={(event) => setForm({ ...form, asn_share_date: event.target.value })} className={inputClass} />
                        </div>

                        <div>
                            <label htmlFor="asn-user" className="text-sm font-medium">
                                ASN user
                            </label>
                            <input id="asn-user" name="asnUser" list="dashboard-users" autoComplete="off" maxLength={150} value={form.asn_user_name} onChange={(event) => setForm({ ...form, asn_user_name: event.target.value })} placeholder="Type or select a name" className={inputClass} />
                        </div>
                    </div>
                </section>

            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <section className="rounded-xl border border-border bg-card p-4">
                    <h2 className="font-semibold">Pending reason</h2>
                    <label htmlFor="pending-reason" className="sr-only">
                        Reason for pending work
                    </label>
                    <textarea id="pending-reason" name="pendingReason" maxLength={5000} value={form.pending_reason} onChange={(event) => setForm({ ...form, pending_reason: event.target.value })} placeholder="If the task is pending, add a reason here (optional)." className={textareaClass} />
                </section>

                <section className={`rounded-xl border p-4 ${form.remark.trim()
                    ? "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40"
                    : "border-border bg-card"}`}>
                    <h2 className="font-semibold">Remark</h2>
                    <label htmlFor="remark" className="sr-only">
                        Additional remark
                    </label>
                    <textarea id="remark" name="remark" maxLength={5000} value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} placeholder="Add an optional remark." className={textareaClass} />
                </section>

                <section className="rounded-xl border border-border bg-card p-4 md:col-span-2 xl:col-span-1">
                    <input type="hidden" name="status" value={effectiveStatus} />

                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h2 className="text-sm font-semibold">
                                Invoice status
                            </h2>

                            <p className="mt-1 text-xs text-muted-foreground">
                                Status changes are applied when you save.
                            </p>
                        </div>

                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${effectiveStatus === "Complete"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : effectiveStatus === "Reject"
                                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                                : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"}`}>
                            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                            {effectiveStatus}
                        </span>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {form.asn_shared
                            ? "ASN SHARE is selected. Saving will complete this invoice."
                            : reopening
                                ? "Saving will return this invoice to Pending. Save this change before rejecting it."
                                : effectiveStatus === "Reject"
                                    ? "This invoice is marked for rejection. Save changes to apply."
                                    : "This invoice remains Pending until ASN SHARE is selected and saved."}
                    </p>

                    {!form.asn_shared && (<div className="mt-2 flex flex-wrap items-center gap-3">
                        {effectiveStatus === "Reject" ? (<button type="button" disabled={pending || reopening} onClick={() => setForm((previous) => ({
                            ...previous,
                            status: "Pending",
                        }))} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-input px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">
                            Undo rejection
                        </button>) : (<button type="button" disabled={pending || reopening} onClick={() => setForm((previous) => ({
                            ...previous,
                            status: "Reject",
                        }))} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50">
                            Reject invoice
                        </button>)}
                    </div>)}
                </section>
            </div>
        </fieldset>

        {state.error && (<div role="alert" className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-800 dark:text-red-300">
            <p>{state.error}</p>

            {state.conflict && (<button type="button" onClick={reloadLatest} className="mt-3 rounded-lg border border-red-300 dark:border-red-900 bg-card px-3 py-2 font-semibold">
                Reload latest record
            </button>)}
        </div>)}

        <div className="flex flex-wrap items-center
        justify-between gap-3 rounded-xl border border-border
        bg-card p-3 shadow-lg sm:px-4">
            <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
                {pending
                    ? "Saving changes…"
                    : hasUnsavedChanges
                        ? "You have unsaved changes."
                        : "No unsaved changes."}
            </p>

            <div className="flex flex-wrap items-center gap-3">
                <Link href="/dashboard" aria-disabled={pending} onClick={(event) => {
                    if (pending)
                        event.preventDefault();
                }} className="inline-flex min-h-11 items-center justify-center
                rounded-lg border border-input bg-background px-4 py-2.5
                text-sm font-medium hover:bg-muted">
                    Back to dashboard
                </Link>

                <button type="submit" disabled={pending || state.conflict} className="inline-flex min-h-11 items-center justify-center
                rounded-lg bg-blue-700 px-5 py-2.5 text-sm
                font-semibold text-white hover:bg-blue-800
                disabled:cursor-not-allowed disabled:opacity-60">
                    {pending ? "Saving changes…" : "Save changes"}
                </button>
            </div>
        </div>
    </form>);
}
