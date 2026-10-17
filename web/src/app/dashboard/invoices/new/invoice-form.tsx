"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import VehicleInput from "@/components/vehicle-input";
import { MAX_METERS } from "@/lib/meter-quantity";
import { createInvoice } from "./actions";

type QuantityUnit = "ROLLS" | "MTR";

const MAX_ROLLS = 2147483647;

const inputClass =
    "block h-11 w-full min-w-0 rounded-lg border border-input " +
    "bg-card px-3 text-sm text-foreground outline-none " +
    "placeholder:text-muted-foreground focus:border-blue-600 " +
    "focus:ring-2 focus:ring-ring/25";

const labelClass =
    "mb-2 block text-sm font-medium text-foreground";

export default function InvoiceForm({ today }: { today: string }) {
    const [state, formAction, pending] = useActionState(
        createInvoice,
        { error: "" },
    );

    const [quantity, setQuantity] = useState("");
    const [quantityUnit, setQuantityUnit] =
        useState<QuantityUnit>("ROLLS");

    const isMeters = quantityUnit === "MTR";

    return (
        <form
            action={formAction}
            aria-busy={pending}
            className="space-y-6"
        >
            {/* Send the quantity to the selected database field. */}
            <input
                type="hidden"
                name="rollQuantity"
                value={isMeters ? "" : quantity}
            />

            <input
                type="hidden"
                name="meterQuantity"
                value={isMeters ? quantity : ""}
            />

            <fieldset
                disabled={pending}
                className="min-w-0 space-y-5"
            >
                <legend className="sr-only">
                    Invoice details
                </legend>

                <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                        <label
                            htmlFor="invoice"
                            className={labelClass}
                        >
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

                    <div>
                        <label
                            htmlFor="supplier"
                            className={labelClass}
                        >
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

                    <div>
                        <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
                            <div>
                                <label
                                    htmlFor="quantity"
                                    className={labelClass}
                                >
                                    Quantity
                                </label>

                                <input
                                    id="quantity"
                                    type="number"
                                    min={0}
                                    max={isMeters ? MAX_METERS : MAX_ROLLS}
                                    step={isMeters ? 0.001 : 1}
                                    inputMode={isMeters ? "decimal" : "numeric"}
                                    placeholder="Optional"
                                    value={quantity}
                                    onChange={(event) =>
                                        setQuantity(event.target.value)
                                    }
                                    aria-describedby="quantity-help"
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="quantity-unit"
                                    className={labelClass}
                                >
                                    Unit
                                </label>

                                <select
                                    id="quantity-unit"
                                    value={quantityUnit}
                                    onChange={(event) => {
                                        setQuantityUnit(
                                            event.target.value === "MTR"
                                                ? "MTR"
                                                : "ROLLS",
                                        );
                                    }}
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
                                : "Enter the number of rolls as a whole number."}
                            {" "}Changing the unit does not convert the value.
                        </p>
                    </div>

                    <div>
                        <label
                            htmlFor="system"
                            className={labelClass}
                        >
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

                    <div>
                        <label
                            htmlFor="vehicleNumber"
                            className={labelClass}
                        >
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
                    </div>

                    <div>
                        <label
                            htmlFor="receivedDate"
                            className={labelClass}
                        >
                            Received date
                        </label>

                        <input
                            id="receivedDate"
                            name="receivedDate"
                            type="date"
                            min="0001-01-01"
                            max="9999-12-31"
                            className={inputClass}
                        />

                        <p className="mt-1.5 text-xs text-muted-foreground">
                            Optional. Leave blank to keep an existing
                            vehicle date.
                        </p>
                    </div>

                    <div>
                        <label
                            htmlFor="documentDate"
                            className={labelClass}
                        >
                            Document share date *
                        </label>

                        <input
                            id="documentDate"
                            name="documentDate"
                            type="date"
                            required
                            min="0001-01-01"
                            max="9999-12-31"
                            defaultValue={today}
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="shipment"
                            className={labelClass}
                        >
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
                New invoices start as Pending. Processing details
                can be updated after creation.
            </p>

            {state.error && (
                <p
                    role="alert"
                    className="rounded-lg border border-red-200
                    bg-red-50 p-3 text-sm text-red-700
                    dark:border-red-900 dark:bg-red-950/40
                    dark:text-red-300"
                >
                    {state.error}
                </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
                {pending ? (
                    <button
                        type="button"
                        disabled
                        className="rounded-lg border border-input
                        px-4 py-2.5 text-sm opacity-60"
                    >
                        Cancel
                    </button>
                ) : (
                    <Link
                        href="/dashboard"
                        className="rounded-lg border border-input
                        px-4 py-2.5 text-sm hover:bg-muted"
                    >
                        Cancel
                    </Link>
                )}

                <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex min-h-11 items-center
                    justify-center gap-2 rounded-lg bg-blue-700
                    px-5 py-2.5 text-sm font-semibold text-white
                    hover:bg-blue-800 disabled:cursor-wait
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