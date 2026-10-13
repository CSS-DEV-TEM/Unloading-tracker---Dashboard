"use client";

import Link from "next/link";
import VehicleInput from "@/components/vehicle-input";
import { useActionState, useEffect, useState } from "react";
import { saveInvoiceDetails } from "./actions";

type Props = {
    invoice: {
        id: string;
        version: number;
        invoice_number: string;
        supplier: string;
        roll_quantity: number | null;
        vehicle_number: string | null;
        vehicle_received_date: string | null;
        document_share_date: string;
        shipment_type: string;
        system_type: string;
        status: string;
    };
};

export default function DetailsForm({ invoice }: Props) {
    const [values, setValues] = useState({
        invoiceNumber: invoice.invoice_number,
        supplier: invoice.supplier,
        vehicleNumber: invoice.vehicle_number ?? "",
        receivedDate: invoice.vehicle_received_date ?? "",
        originalReceivedDate: invoice.vehicle_received_date ?? "",
        rollQuantity:
            invoice.roll_quantity === null
                ? ""
                : String(invoice.roll_quantity),
        documentDate: invoice.document_share_date,
        shipmentType: invoice.shipment_type,
    });
    useEffect(() => {
        const latestDate = invoice.vehicle_received_date ?? "";
        const originalVehicle = invoice.vehicle_number ?? "";

        setValues((previous) => {
            // Keep any vehicle or date change the user is editing.
            if (
                previous.vehicleNumber !== originalVehicle ||
                previous.receivedDate !== previous.originalReceivedDate
            ) {
                return previous;
            }

            if (previous.originalReceivedDate === latestDate) {
                return previous;
            }

            return {
                ...previous,
                receivedDate: latestDate,
                originalReceivedDate: latestDate,
            };
        });
    }, [invoice.vehicle_received_date, invoice.vehicle_number]);

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
            <input
                type="hidden"
                name="originalReceivedDate"
                value={values.originalReceivedDate}
            />
            <input
                type="hidden"
                name="originalVehicleNumber"
                value={invoice.vehicle_number ?? ""}
            />

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

                    <div className="grid gap-5 sm:col-span-2 sm:grid-cols-3">
                        <div className="min-w-0">
                            <label
                                htmlFor="roll-quantity"
                                className="mb-2 block text-sm font-medium"
                            >
                                Roll quantity
                            </label>

                            <input
                                id="roll-quantity"
                                name="rollQuantity"
                                type="number"
                                min={0}
                                max={2147483647}
                                step={1}
                                placeholder="Optional"
                                value={values.rollQuantity}
                                onChange={(event) =>
                                    update("rollQuantity", event.target.value)
                                }
                                className={inputClass}
                            />
                        </div>

                        <div className="min-w-0">
                            <label
                                htmlFor="vehicle-number"
                                className="mb-2 block text-sm font-medium"
                            >
                                Vehicle number
                                <span className="ml-1 text-xs font-normal text-muted-foreground">
                                    (optional)
                                </span>
                            </label>

                            {invoice.status === "Complete" ? (
                                <>
                                    <input id="vehicle-number" name="vehicleNumber" type="text"
                                        value={values.vehicleNumber} readOnly className={`${inputClass} opacity-70`}
                                        aria-describedby="vehicle-locked-help" placeholder="Not assigned" />
                                    <p id="vehicle-locked-help" className="mt-1.5 text-xs text-muted-foreground">
                                        Vehicle assignment is locked while this invoice is Complete. Save it as Pending before changing the vehicle.
                                    </p>
                                </>
                            ) : (
                                <VehicleInput
                                    id="vehicle-number"
                                    name="vehicleNumber"
                                    type="text"
                                    maxLength={30}
                                    autoComplete="off"
                                    spellCheck={false}
                                    placeholder="e.g. WP ABC-1234"
                                    value={values.vehicleNumber}
                                    onChange={(event) => {
                                        const nextNumber = event.target.value;

                                        setValues((previous) => ({
                                            ...previous,
                                            vehicleNumber: nextNumber,
                                            receivedDate: "",
                                        }));
                                    }}
                                    className={inputClass}
                                />
                            )}
                            <div className="mt-3">
                                <label
                                    htmlFor="received-date"
                                    className="mb-2 block text-sm font-medium"
                                >
                                    Received date
                                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                                        (optional)
                                    </span>
                                </label>

                                <input
                                    id="received-date"
                                    name="receivedDate"
                                    type="date"
                                    value={values.receivedDate}
                                    onChange={(event) =>
                                        update("receivedDate", event.target.value)
                                    }
                                    min="0001-01-01"
                                    max="9999-12-31"
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <div className="min-w-0">
                            <label
                                htmlFor="current-system"
                                className="mb-2 block text-sm font-medium"
                            >
                                System
                            </label>

                            <input
                                id="current-system"
                                type="text"
                                value={invoice.system_type}
                                readOnly
                                aria-describedby="current-system-help"
                                className={`${inputClass} text-muted-foreground`}
                            />

                            <p
                                id="current-system-help"
                                className="mt-1.5 text-xs text-muted-foreground"
                            >
                                System cannot be changed.
                            </p>
                        </div>
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