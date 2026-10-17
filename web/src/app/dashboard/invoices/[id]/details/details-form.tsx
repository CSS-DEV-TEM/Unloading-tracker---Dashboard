"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import VehicleInput from "@/components/vehicle-input";
import { MAX_METERS } from "@/lib/meter-quantity";
import { saveInvoiceDetails } from "./actions";

type QuantityUnit = "ROLLS" | "MTR";

type Props = {
    invoice: {
        id: string;
        version: number;
        invoice_number: string;
        supplier: string;
        roll_quantity: number | null;
        meter_quantity: number | null;
        vehicle_number: string | null;
        vehicle_received_date: string | null;
        document_share_date: string;
        shipment_type: string;
        system_type: string;
        status: string;
    };
};

const MAX_ROLLS = 2147483647;

const inputClass =
    "h-11 w-full min-w-0 rounded-lg border border-input " +
    "bg-card px-3 text-sm text-foreground outline-none " +
    "focus:border-blue-600 focus:ring-2 focus:ring-ring/25";

const labelClass = "mb-2 block text-sm font-medium";

export default function DetailsForm({ invoice }: Props) {
    const metersLoaded = invoice.meter_quantity !== undefined;

    // Preserve both quantities when an imported invoice contains both.
    const hasBothQuantities =
        invoice.roll_quantity != null &&
        invoice.meter_quantity != null;

    const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>(
        invoice.roll_quantity == null && invoice.meter_quantity != null
            ? "MTR"
            : "ROLLS",
    );

    const [values, setValues] = useState({
        invoiceNumber: invoice.invoice_number,
        supplier: invoice.supplier,
        rollQuantity:
            invoice.roll_quantity == null
                ? ""
                : String(invoice.roll_quantity),
        meterQuantity:
            invoice.meter_quantity == null
                ? ""
                : String(invoice.meter_quantity),
        vehicleNumber: invoice.vehicle_number ?? "",
        receivedDate: invoice.vehicle_received_date ?? "",
        originalReceivedDate: invoice.vehicle_received_date ?? "",
        documentDate: invoice.document_share_date,
        shipmentType: invoice.shipment_type,
    });

    const [state, formAction, pending] = useActionState(
        saveInvoiceDetails,
        { error: "", conflict: false },
    );

    const isMeters = quantityUnit === "MTR";

    const selectedQuantity = isMeters
        ? values.meterQuantity
        : values.rollQuantity;

    const submittedRolls =
        hasBothQuantities || !isMeters ? values.rollQuantity : "";

    const submittedMeters =
        hasBothQuantities || isMeters ? values.meterQuantity : "";

    useEffect(() => {
        const latestDate = invoice.vehicle_received_date ?? "";
        const originalVehicle = invoice.vehicle_number ?? "";

        setValues((previous) => {
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

    function update(name: keyof typeof values, value: string) {
        setValues((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    function changeUnit(nextUnit: QuantityUnit) {
        if (nextUnit === quantityUnit || hasBothQuantities) return;

        // Keep the entered number; changing units is not a conversion.
        const currentQuantity = selectedQuantity;

        setValues((previous) => ({
            ...previous,
            rollQuantity: nextUnit === "ROLLS" ? currentQuantity : "",
            meterQuantity: nextUnit === "MTR" ? currentQuantity : "",
        }));

        setQuantityUnit(nextUnit);
    }

    return (
        <form
            action={formAction}
            aria-busy={pending}
            className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6"
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

            <input
                type="hidden"
                name="rollQuantity"
                value={submittedRolls}
            />

            {metersLoaded && (
                <input
                    type="hidden"
                    name="meterQuantity"
                    value={submittedMeters}
                />
            )}

            <fieldset disabled={pending} className="space-y-5">
                <legend className="sr-only">
                    Edit invoice details
                </legend>

                <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                        <label
                            htmlFor="invoice-number"
                            className={labelClass}
                        >
                            Invoice number *
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
                        <label htmlFor="supplier" className={labelClass}>
                            Supplier *
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
                        {hasBothQuantities ? (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label
                                            htmlFor="edit-rolls"
                                            className={labelClass}
                                        >
                                            Roll quantity
                                        </label>

                                        <input
                                            id="edit-rolls"
                                            type="number"
                                            min={0}
                                            max={MAX_ROLLS}
                                            step={1}
                                            inputMode="numeric"
                                            placeholder="Optional"
                                            value={values.rollQuantity}
                                            onChange={(event) =>
                                                update(
                                                    "rollQuantity",
                                                    event.target.value,
                                                )
                                            }
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="edit-meters"
                                            className={labelClass}
                                        >
                                            Quantity (MTR)
                                        </label>

                                        <input
                                            id="edit-meters"
                                            type="number"
                                            min={0}
                                            max={MAX_METERS}
                                            step={0.001}
                                            inputMode="decimal"
                                            placeholder="Optional"
                                            value={values.meterQuantity}
                                            onChange={(event) =>
                                                update(
                                                    "meterQuantity",
                                                    event.target.value,
                                                )
                                            }
                                            className={inputClass}
                                        />
                                    </div>
                                </div>

                                <p className="mt-1.5 text-xs text-muted-foreground">
                                    This invoice contains both rolls and meters.
                                    Edit each quantity separately.
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
                                    <div>
                                        <label
                                            htmlFor="edit-quantity"
                                            className={labelClass}
                                        >
                                            Quantity
                                        </label>

                                        <input
                                            id="edit-quantity"
                                            type="number"
                                            min={0}
                                            max={
                                                isMeters
                                                    ? MAX_METERS
                                                    : MAX_ROLLS
                                            }
                                            step={isMeters ? 0.001 : 1}
                                            inputMode={
                                                isMeters ? "decimal" : "numeric"
                                            }
                                            placeholder="Optional"
                                            disabled={!metersLoaded}
                                            value={selectedQuantity}
                                            onChange={(event) =>
                                                update(
                                                    isMeters
                                                        ? "meterQuantity"
                                                        : "rollQuantity",
                                                    event.target.value,
                                                )
                                            }
                                            aria-describedby="quantity-help"
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="edit-unit"
                                            className={labelClass}
                                        >
                                            Unit
                                        </label>

                                        <select
                                            id="edit-unit"
                                            value={quantityUnit}
                                            disabled={!metersLoaded}
                                            onChange={(event) =>
                                                changeUnit(
                                                    event.target.value === "MTR"
                                                        ? "MTR"
                                                        : "ROLLS",
                                                )
                                            }
                                            className={inputClass}
                                        >
                                            <option value="ROLLS">Rolls</option>
                                            <option value="MTR">MTR</option>
                                        </select>
                                    </div>
                                </div>

                                <p
                                    id="quantity-help"
                                    className="mt-1.5 text-xs text-muted-foreground"
                                >
                                    {isMeters
                                        ? "Enter meters with up to 3 decimal places."
                                        : "Enter rolls as a whole number."}
                                    {" "}Changing the unit does not convert
                                    the value.
                                </p>
                            </>
                        )}
                    </div>

                    <div>
                        <label
                            htmlFor="current-system"
                            className={labelClass}
                        >
                            System
                        </label>

                        <input
                            id="current-system"
                            type="text"
                            value={invoice.system_type}
                            readOnly
                            aria-describedby="system-help"
                            className={`${inputClass} text-muted-foreground`}
                        />

                        <p
                            id="system-help"
                            className="mt-1.5 text-xs text-muted-foreground"
                        >
                            System cannot be changed in this form.
                        </p>
                    </div>

                    <div>
                        <label
                            htmlFor="vehicle-number"
                            className={labelClass}
                        >
                            Vehicle number
                        </label>

                        {invoice.status === "Complete" ? (
                            <>
                                <input
                                    id="vehicle-number"
                                    name="vehicleNumber"
                                    type="text"
                                    value={values.vehicleNumber}
                                    readOnly
                                    placeholder="Not assigned"
                                    aria-describedby="vehicle-locked-help"
                                    className={`${inputClass} opacity-70`}
                                />

                                <p
                                    id="vehicle-locked-help"
                                    className="mt-1.5 text-xs text-muted-foreground"
                                >
                                    Vehicle assignment is locked while this
                                    invoice is Complete. Save it as Pending
                                    before changing the vehicle.
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
                                placeholder="Optional · ABC-1234"
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
                    </div>

                    <div>
                        <label
                            htmlFor="received-date"
                            className={labelClass}
                        >
                            Received date
                        </label>

                        <input
                            id="received-date"
                            name="receivedDate"
                            type="date"
                            min="0001-01-01"
                            max="9999-12-31"
                            value={values.receivedDate}
                            onChange={(event) =>
                                update("receivedDate", event.target.value)
                            }
                            className={inputClass}
                        />

                        <p className="mt-1.5 text-xs text-muted-foreground">
                            Leave blank to keep the vehicle&apos;s current
                            received date.
                        </p>
                    </div>

                    <div>
                        <label
                            htmlFor="document-date"
                            className={labelClass}
                        >
                            Document share date *
                        </label>

                        <input
                            id="document-date"
                            name="documentDate"
                            type="date"
                            required
                            min="0001-01-01"
                            max="9999-12-31"
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
                            className={labelClass}
                        >
                            Local / Import *
                        </label>

                        <select
                            id="shipment-type"
                            name="shipmentType"
                            required
                            value={values.shipmentType}
                            onChange={(event) =>
                                update("shipmentType", event.target.value)
                            }
                            className={inputClass}
                        >
                            <option value="">Select</option>
                            <option value="LOCAL">Local</option>
                            <option value="IMPORT">Import</option>
                        </select>
                    </div>
                </div>

                {!metersLoaded && (
                    <p
                        role="alert"
                        className="text-sm text-red-700 dark:text-red-300"
                    >
                        Meter quantity was not loaded. Include meter_quantity
                        in the invoice query before saving.
                    </p>
                )}

                {state.error && (
                    <div
                        role="alert"
                        className="rounded-xl border border-red-200
                        bg-red-50 p-4 text-sm text-red-700
                        dark:border-red-900 dark:bg-red-950/40
                        dark:text-red-300"
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
                        aria-disabled={pending}
                        onClick={(event) => {
                            if (pending) event.preventDefault();
                        }}
                        className="rounded-lg border border-input
                        px-4 py-2.5 text-sm hover:bg-muted"
                    >
                        Cancel
                    </Link>

                    <button
                        type="submit"
                        disabled={
                            pending ||
                            state.conflict ||
                            !metersLoaded
                        }
                        className="inline-flex min-h-11 items-center
                        justify-center rounded-lg bg-blue-700 px-5
                        py-2.5 text-sm font-semibold text-white
                        hover:bg-blue-800 disabled:cursor-not-allowed
                        disabled:opacity-60"
                    >
                        {pending ? "Saving…" : "Save changes"}
                    </button>
                </div>
            </fieldset>
        </form>
    );
}