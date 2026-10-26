"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import VehicleInput from "@/components/vehicle-input";
import { saveInvoiceDetails } from "./actions";
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
const inputClass = "h-11 w-full min-w-0 rounded-lg border border-input " +
    "bg-background px-3 text-sm text-foreground outline-none " +
    "focus:border-blue-600 focus:ring-2 focus:ring-ring/25";
const labelClass = "mb-2 block text-sm font-medium";
export default function DetailsForm({ invoice }: Props) {
    const [values, setValues] = useState({
        invoiceNumber: invoice.invoice_number,
        supplier: invoice.supplier,
        rollQuantity: invoice.roll_quantity == null
            ? ""
            : String(invoice.roll_quantity),
        vehicleNumber: invoice.vehicle_number ?? "",
        receivedDate: invoice.vehicle_received_date ?? "",
        originalReceivedDate: invoice.vehicle_received_date ?? "",
        documentDate: invoice.document_share_date,
        shipmentType: invoice.shipment_type,
    });
    const [state, formAction, pending] = useActionState(saveInvoiceDetails, { error: "", conflict: false });
    const submittedRolls = values.rollQuantity;
    useEffect(() => {
        const latestDate = invoice.vehicle_received_date ?? "";
        const originalVehicle = invoice.vehicle_number ?? "";
        setValues((previous) => {
            if (previous.vehicleNumber !== originalVehicle ||
                previous.receivedDate !== previous.originalReceivedDate) {
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
    return (<form action={formAction} aria-busy={pending} className="space-y-4">
        <input type="hidden" name="invoiceId" value={invoice.id} />
        <input type="hidden" name="version" value={invoice.version} />

        <input type="hidden" name="originalReceivedDate" value={values.originalReceivedDate} />

        <input type="hidden" name="originalVehicleNumber" value={invoice.vehicle_number ?? ""} />

        <input type="hidden" name="rollQuantity" value={submittedRolls} />


        <fieldset disabled={pending} className="space-y-5">
            <legend className="sr-only">
                Edit invoice details
            </legend>

            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]"><section aria-label="Invoice details" className="min-w-0 rounded-xl border border-border bg-card shadow-sm md:col-span-2 xl:col-span-1"><h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Invoice details</h2><div className="grid min-w-0 gap-4 p-4 sm:grid-cols-2"><div className="min-w-0 sm:col-span-2">
                <label htmlFor="invoice-number" className={labelClass}>
                    Invoice number *
                </label>

                <input id="invoice-number" name="invoiceNumber" required maxLength={100} value={values.invoiceNumber} onChange={(event) => update("invoiceNumber", event.target.value)} className={inputClass} />
            </div>
                <div className="min-w-0 sm:col-span-2">
                    <label htmlFor="supplier" className={labelClass}>
                        Supplier *
                    </label>

                    <input id="supplier" name="supplier" required maxLength={250} value={values.supplier} onChange={(event) => update("supplier", event.target.value)} className={inputClass} />
                </div>
                <div>
                    <label htmlFor="current-system" className={labelClass}>
                        System
                    </label>

                    <input id="current-system" type="text" value={invoice.system_type} readOnly aria-describedby="system-help" className={`${inputClass} text-muted-foreground`} />

                    <p id="system-help" className="mt-1.5 text-xs text-muted-foreground">
                        System cannot be changed in this form.
                    </p>
                </div>
                <div>
                    <label htmlFor="shipment-type" className={labelClass}>
                        Local / Import *
                    </label>

                    <select id="shipment-type" name="shipmentType" required value={values.shipmentType} onChange={(event) => update("shipmentType", event.target.value)} className={inputClass}>
                        <option value="">Select</option>
                        <option value="LOCAL">Local</option>
                        <option value="IMPORT">Import</option>
                    </select>
                </div></div></section><section aria-label="Quantity & date" className="min-w-0 rounded-xl border border-border bg-card shadow-sm "><h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Quantity & date</h2><div className="grid min-w-0 gap-4 p-4 "><div>
                    <label htmlFor="edit-rolls" className={labelClass}>Roll quantity</label>
                    <input id="edit-rolls" type="number" min={0} max={MAX_ROLLS} step={1} inputMode="numeric" placeholder="Optional" value={values.rollQuantity} onChange={(event) => update("rollQuantity", event.target.value)} className={inputClass} />
                    <p className="mt-1.5 text-xs text-muted-foreground">Enter rolls as a whole number, or leave blank.</p>
                </div>
                    <div>
                        <label htmlFor="document-date" className={labelClass}>
                            Document share date *
                        </label>

                        <input id="document-date" name="documentDate" type="date" required min="0001-01-01" max="9999-12-31" value={values.documentDate} onChange={(event) => update("documentDate", event.target.value)} className={inputClass} />
                    </div></div></section><section aria-label="Vehicle details · Optional" className="min-w-0 rounded-xl border border-border bg-card shadow-sm "><h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Vehicle details · Optional</h2><div className="grid min-w-0 gap-4 p-4 "><div>
                        <label htmlFor="vehicle-number" className={labelClass}>
                            Vehicle number
                        </label>

                        {invoice.status === "Complete" ? (<>
                            <input id="vehicle-number" name="vehicleNumber" type="text" value={values.vehicleNumber} readOnly placeholder="Not assigned" aria-describedby="vehicle-locked-help" className={`${inputClass} opacity-70`} />

                            <p id="vehicle-locked-help" className="mt-1.5 text-xs text-muted-foreground">
                                Vehicle assignment is locked while this
                                invoice is Complete. Save it as Pending
                                before changing the vehicle.
                            </p>
                        </>) : (<VehicleInput id="vehicle-number" name="vehicleNumber" type="text" maxLength={30} autoComplete="off" spellCheck={false} placeholder="Optional · ABC-1234" value={values.vehicleNumber} onChange={(event) => {
                            const nextNumber = event.target.value;
                            setValues((previous) => ({
                                ...previous,
                                vehicleNumber: nextNumber,
                                receivedDate: "",
                            }));
                        }} className={inputClass} />)}
                    </div>
                        <div>
                            <label htmlFor="received-date" className={labelClass}>
                                Received date
                            </label>

                            <input id="received-date" name="receivedDate" type="date" min="0001-01-01" max="9999-12-31" value={values.receivedDate} onChange={(event) => update("receivedDate", event.target.value)} className={inputClass} />

                            <p className="mt-1.5 text-xs text-muted-foreground">
                                Leave blank to keep the vehicle&apos;s current
                                received date.
                            </p>
                        </div></div></section></div>

            {state.error && (<div role="alert" className="rounded-xl border border-red-200
                        bg-red-50 p-4 text-sm text-red-700
                        dark:border-red-900 dark:bg-red-950/40
                        dark:text-red-300">
                <p>{state.error}</p>

                {state.conflict && (<button type="button" onClick={() => {
                    if (window.confirm("Discard unsaved changes and reload the latest invoice?")) {
                        window.location.reload();
                    }
                }} className="mt-3 font-semibold underline">
                    Reload latest record
                </button>)}
            </div>)}

            <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-border bg-card p-4">
                <Link href={`/dashboard/invoices/${invoice.id}`} aria-disabled={pending} onClick={(event) => {
                    if (pending)
                        event.preventDefault();
                }} className="rounded-lg border border-input
                        px-4 py-2.5 text-sm hover:bg-muted">
                    Cancel
                </Link>

                <button type="submit" disabled={pending ||
                    state.conflict} className="inline-flex min-h-11 items-center
                        justify-center rounded-lg bg-blue-700 px-5
                        py-2.5 text-sm font-semibold text-white
                        hover:bg-blue-800 disabled:cursor-not-allowed
                        disabled:opacity-60">
                    {pending ? "Saving…" : "Save changes"}
                </button>
            </div>
        </fieldset>
    </form>);
}
