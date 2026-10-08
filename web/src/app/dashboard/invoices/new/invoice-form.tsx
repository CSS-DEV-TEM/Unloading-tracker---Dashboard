"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createInvoice } from "./actions";

const inputStyle =
    "mt-2 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-blue-600 focus:ring-2 focus:ring-ring/25";

export default function InvoiceForm({ today }: { today: string }) {
    const [state, formAction, pending] = useActionState(createInvoice, {
        error: "",
    });

    return (
        <form action={formAction} className="space-y-6">
            <fieldset
                disabled={pending}
                className="grid gap-5 sm:grid-cols-2"
            >
                <legend className="sr-only">Invoice details</legend>

                <div>
                    <label
                        htmlFor="invoice"
                        className="text-sm font-medium"
                    >
                        Invoice number *
                    </label>

                    <input
                        id="invoice"
                        name="invoice"
                        required
                        maxLength={100}
                        placeholder="Enter invoice number"
                        className={inputStyle}
                    />
                </div>

                <div>
                    <label
                        htmlFor="supplier"
                        className="text-sm font-medium"
                    >
                        Supplier *
                    </label>

                    <input
                        id="supplier"
                        name="supplier"
                        required
                        maxLength={250}
                        placeholder="Enter supplier name"
                        className={inputStyle}
                    />
                </div>

                <div>
                    <label
                        htmlFor="rollQuantity"
                        className="text-sm font-medium"
                    >
                        Roll quantity
                    </label>

                    <input
                        id="rollQuantity"
                        name="rollQuantity"
                        type="number"
                        min={0}
                        max={2147483647}
                        step={1}
                        placeholder="Optional"
                        className={inputStyle}
                    />
                </div>

                <div>
                    <label
                        htmlFor="system"
                        className="text-sm font-medium"
                    >
                        System *
                    </label>

                    <select
                        id="system"
                        name="system"
                        required
                        defaultValue=""
                        className={inputStyle}
                    >
                        <option value="" disabled>
                            Select system
                        </option>
                        <option value="AX">AX</option>
                        <option value="D365">D365</option>
                        <option value="AX/D365">AX/D365</option>
                    </select>
                </div>

                <div>
                    <label
                        htmlFor="documentDate"
                        className="text-sm font-medium"
                    >
                        Document share date *
                    </label>

                    <input
                        id="documentDate"
                        name="documentDate"
                        type="date"
                        required
                        defaultValue={today}
                        className={inputStyle}
                    />
                </div>

                <div>
                    <label
                        htmlFor="shipment"
                        className="text-sm font-medium"
                    >
                        Local / Import *
                    </label>

                    <select
                        id="shipment"
                        name="shipment"
                        required
                        defaultValue=""
                        className={inputStyle}
                    >
                        <option value="" disabled>
                            Select shipment type
                        </option>
                        <option value="LOCAL">LOCAL</option>
                        <option value="IMPORT">IMPORT</option>
                    </select>
                </div>
            </fieldset>

            <p className="text-sm text-muted-foreground">
                New invoices start as Pending. Processing details can be updated
                after creation.
            </p>

            {state.error && (
                <p
                    role="alert"
                    className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-400"
                >
                    {state.error}
                </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
                <Link
                    href="/dashboard"
                    className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                    Back to dashboard
                </Link>

                <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
                >
                    {pending ? "Saving..." : "Create Invoice"}
                </button>
            </div>
        </form>
    );
}