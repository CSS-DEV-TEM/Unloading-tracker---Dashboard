"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveInvoiceDetails } from "./actions";

type Props = {
    invoice: {
        id: string;
        version: number;
        invoice_number: string;
        supplier: string;
        roll_quantity: number | null;
        document_share_date: string;
        shipment_type: string;
        system_type: string;
    };
};

export default function DetailsForm({ invoice }: Props) {
    const [values, setValues] = useState({
        invoiceNumber: invoice.invoice_number,
        supplier: invoice.supplier,
        rollQuantity:
            invoice.roll_quantity === null
                ? ""
                : String(invoice.roll_quantity),
        documentDate: invoice.document_share_date,
        shipmentType: invoice.shipment_type,
    });

    const [state, formAction, pending] = useActionState(
        saveInvoiceDetails,
        { error: "", conflict: false },
    );

    function update(name: keyof typeof values, value: string) {
        setValues((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    const inputClass =
        "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-blue-600 focus:ring-2 focus:ring-ring/25";
    return (
        <form
            action={formAction}
            className="rounded-xl border border-border bg-card p-4 sm:p-6"
        >
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <input type="hidden" name="version" value={invoice.version} />

            <fieldset disabled={pending} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                        <label
                            htmlFor="invoice-number"
                            className="mb-2 block text-sm font-medium"
                        >
                            Invoice number
                        </label>

                        <input
                            id="invoice-number"
                            name="invoiceNumber"
                            required
                            maxLength={100}
                            value={values.invoiceNumber}
                            onChange={(event) =>
                                update("invoiceNumber", event.target.value)
                            }
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="supplier"
                            className="mb-2 block text-sm font-medium"
                        >
                            Supplier
                        </label>

                        <input
                            id="supplier"
                            name="supplier"
                            required
                            maxLength={250}
                            value={values.supplier}
                            onChange={(event) =>
                                update("supplier", event.target.value)
                            }
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="roll-quantity"
                            className="mb-2 block text-sm font-medium"
                        >
                            Roll quantity — optional
                        </label>

                        <input
                            id="roll-quantity"
                            name="rollQuantity"
                            type="number"
                            min={0}
                            max={2147483647}
                            step={1}
                            value={values.rollQuantity}
                            onChange={(event) =>
                                update("rollQuantity", event.target.value)
                            }
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="document-date"
                            className="mb-2 block text-sm font-medium"
                        >
                            Document share date
                        </label>

                        <input
                            id="document-date"
                            name="documentDate"
                            type="date"
                            required
                            value={values.documentDate}
                            onChange={(event) =>
                                update("documentDate", event.target.value)
                            }
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="shipment-type"
                            className="mb-2 block text-sm font-medium"
                        >
                            Local / Import
                        </label>

                        <select
                            id="shipment-type"
                            name="shipmentType"
                            value={values.shipmentType}
                            onChange={(event) =>
                                update("shipmentType", event.target.value)
                            }
                            className={inputClass}
                        >
                            <option value="LOCAL">Local</option>
                            <option value="IMPORT">Import</option>
                        </select>
                    </div>

                    <div className="rounded-xl bg-background p-4">
                        <p className="text-xs text-muted-foreground">Current system</p>
                        <p className="mt-2 font-semibold">
                            {invoice.system_type}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            System selection cannot be changed in this form.
                        </p>
                    </div>
                </div>

                {state.error && (
                    <div
                        role="alert"
                        className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400"
                    >
                        <p>{state.error}</p>

                        {state.conflict && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (
                                        window.confirm(
                                            "Discard unsaved changes and reload the latest invoice?",
                                        )
                                    ) {
                                        window.location.reload();
                                    }
                                }}
                                className="mt-3 font-semibold underline"
                            >
                                Reload latest record
                            </button>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
                    <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        Cancel
                    </Link>

                    <button
                        type="submit"
                        disabled={pending || state.conflict}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {pending ? "Saving…" : "Save changes"}
                    </button>
                </div>
            </fieldset>
        </form>
    );
}