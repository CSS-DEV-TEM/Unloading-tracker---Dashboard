"use client";

import Link from "next/link";
import VehicleInput from "@/components/vehicle-input";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { createInvoice } from "./actions";

const inputClass =
    "block h-11 w-full min-w-0 rounded-lg border border-input " +
    "bg-card px-3 text-sm text-foreground outline-none " +
    "placeholder:text-muted-foreground focus:border-blue-600 " +
    "focus:ring-2 focus:ring-ring/25";

const labelClass =
    "mb-2 block text-sm font-medium text-foreground";

export default function InvoiceForm({ today }: { today: string }) {
    const [state, formAction, pending] = useActionState(createInvoice, {
        error: "",
    });

    return (
        <form
            action={formAction}
            aria-busy={pending}
            className="space-y-6"
        >
            <fieldset
                disabled={pending}
                className="min-w-0 space-y-5"
            >
                <legend className="sr-only">Invoice details</legend>

                {/* First row: two equal columns */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="min-w-0">
                        <label htmlFor="invoice" className={labelClass}>
                            Invoice number *
                        </label>

                        <input
                            id="invoice"
                            name="invoice"
                            type="text"
                            required
                            maxLength={100}
                            placeholder="Enter invoice number"
                            className={inputClass}
                        />
                    </div>

                    <div className="min-w-0">
                        <label htmlFor="supplier" className={labelClass}>
                            Supplier *
                        </label>

                        <input
                            id="supplier"
                            name="supplier"
                            type="text"
                            required
                            maxLength={250}
                            placeholder="Enter supplier name"
                            className={inputClass}
                        />
                    </div>
                </div>

                {/* Middle row: three equal columns */}
                <div className="invoice-middle-row">
                    <div className="min-w-0">
                        <label htmlFor="rollQuantity" className={labelClass}>
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
                            className={inputClass}
                        />
                    </div>

                    <div className="min-w-0">
                        <label htmlFor="vehicleNumber" className={labelClass}>
                            Vehicle number
                        </label>

                        <VehicleInput
                            id="vehicleNumber"
                            name="vehicleNumber"
                            type="text"
                            maxLength={30}
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="Optional · ABC-1234"
                            className={inputClass}
                        />
                        <div className="mt-3">
                            <label htmlFor="receivedDate" className={labelClass}>
                                Received date
                                <span className="ml-1 text-xs font-normal text-muted-foreground">
                                    (optional)
                                </span>
                            </label>

                            <input
                                id="receivedDate"
                                name="receivedDate"
                                type="date"
                                min="0001-01-01"
                                max="9999-12-31"
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div className="min-w-0">
                        <label htmlFor="system" className={labelClass}>
                            System *
                        </label>

                        <select
                            id="system"
                            name="system"
                            required
                            defaultValue=""
                            className={inputClass}
                        >
                            <option value="" disabled>
                                Select system
                            </option>
                            <option value="AX">AX</option>
                            <option value="D365">D365</option>
                            <option value="AX/D365">AX/D365</option>
                        </select>
                    </div>
                </div>

                {/* Last row: two equal columns */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="min-w-0">
                        <label htmlFor="documentDate" className={labelClass}>
                            Document share date *
                        </label>

                        <input
                            id="documentDate"
                            name="documentDate"
                            type="date"
                            required
                            defaultValue={today}
                            className={inputClass}
                        />
                    </div>

                    <div className="min-w-0">
                        <label htmlFor="shipment" className={labelClass}>
                            Local / Import *
                        </label>

                        <select
                            id="shipment"
                            name="shipment"
                            required
                            defaultValue=""
                            className={inputClass}
                        >
                            <option value="" disabled>
                                Select shipment type
                            </option>
                            <option value="LOCAL">Local</option>
                            <option value="IMPORT">Import</option>
                        </select>
                    </div>
                </div>
            </fieldset>

            <p className="text-sm leading-6 text-muted-foreground">
                New invoices start as Pending. Processing details can be
                updated after creation.
            </p>

            {state.error && (
                <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50
            p-3 text-sm text-red-700 dark:border-red-900
            dark:bg-red-950/40 dark:text-red-300"
                >
                    {state.error}
                </p>
            )}

            <div
                className="flex flex-wrap items-center justify-end gap-3
          border-t border-border pt-5"
            >
                {pending ? (
                    <button
                        type="button"
                        disabled
                        className="inline-flex min-h-11 items-center justify-center
              rounded-lg border border-input bg-card px-4 py-2.5
              text-sm font-medium text-muted-foreground opacity-60"
                    >
                        Cancel
                    </button>
                ) : (
                    <Link
                        href="/dashboard"
                        className="inline-flex min-h-11 items-center justify-center
              rounded-lg border border-input bg-card px-4 py-2.5
              text-sm font-medium text-foreground hover:bg-muted
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-ring"
                    >
                        Cancel
                    </Link>
                )}

                <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex min-h-11 items-center justify-center
            gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm
            font-semibold text-white hover:bg-blue-800
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-ring disabled:cursor-wait
            disabled:opacity-60"
                >
                    {pending && (
                        <Loader2
                            className="size-4 animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                        />
                    )}

                    {pending ? "Creating invoice…" : "Create Invoice"}
                </button>
            </div>
        </form>
    );
}