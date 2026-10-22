"use client";

import Link from "next/link";
import {
    useActionState,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import {
    AlertCircle,
    CalendarDays,
    FileText,
    Loader2,
    Save,
    Truck,
} from "lucide-react";

import VehicleInput from "@/components/vehicle-input";
import { MAX_METERS } from "@/lib/meter-quantity";
import { createInvoice } from "./actions";

type QuantityUnit = "ROLLS" | "MTR";
type FieldErrors = Record<string, string>;

const MAX_ROLLS = 2147483647;

const inputClass =
    "block h-11 w-full min-w-0 rounded-md border border-input " +
    "bg-background px-3 text-sm text-foreground outline-none " +
    "placeholder:text-muted-foreground focus:border-ring " +
    "focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed " +
    "disabled:opacity-60 aria-[invalid=true]:border-destructive";

const labelClass =
    "mb-2 block text-sm font-medium text-foreground";

const secondaryButton =
    "inline-flex min-h-11 items-center justify-center gap-2 " +
    "rounded-md border border-input bg-card px-4 text-sm " +
    "font-medium shadow-sm transition-colors hover:bg-muted " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-ring disabled:opacity-50";

function FormSection({
    title,
    description,
    icon,
    optional = false,
    wide = false,
    children,
}: {
    title: string;
    description: string;
    icon: ReactNode;
    optional?: boolean;
    wide?: boolean;
    children: ReactNode;
}) {
    return (
        <section
            aria-label={title}
            className={`min-w-0 rounded-xl border border-border bg-card shadow-sm ${wide ? "md:col-span-2 xl:col-span-1" : ""
                }`}
        >
            <header className="flex min-h-14 items-center gap-2.5 border-b border-border px-4 py-3">
                <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center
                        rounded-md bg-blue-50 text-blue-700
                        dark:bg-blue-400/10 dark:text-blue-300"
                >
                    {icon}
                </span>

                <h2 className="min-w-0 text-sm font-semibold">
                    {title}
                </h2>

                {optional && (
                    <span className="ml-auto shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Optional
                    </span>
                )}

                <p className="sr-only">{description}</p>
            </header>

            <div
                className={
                    wide
                        ? "grid min-w-0 gap-4 p-4 sm:grid-cols-2"
                        : "grid min-w-0 grid-cols-1 gap-4 p-4"
                }
            >
                {children}
            </div>
        </section>
    );
}

export default function InvoiceForm({ today }: { today: string }) {
    const [state, formAction, pending] = useActionState(
        createInvoice,
        { error: "" },
    );

    const [fields, setFields] = useState({
        invoice: "",
        supplier: "",
        system: "",
        shipment: "",
        documentDate: today,
        receivedDate: "",
    });

    const [quantity, setQuantity] = useState("");
    const [quantityUnit, setQuantityUnit] =
        useState<QuantityUnit>("ROLLS");

    const [errors, setErrors] = useState<FieldErrors>({});
    const errorSummary = useRef<HTMLDivElement>(null);

    const isMeters = quantityUnit === "MTR";

    useEffect(() => {
        if (state.error && !pending) {
            errorSummary.current?.focus();
        }
    }, [state, pending]);

    function updateField(
        name: keyof typeof fields,
        value: string,
    ) {
        setFields((previous) => ({
            ...previous,
            [name]: value,
        }));

        clearError(name);
    }

    function clearError(name: string) {
        setErrors((previous) => {
            if (!previous[name]) return previous;

            const next = { ...previous };
            delete next[name];
            return next;
        });
    }

    function errorProps(name: string) {
        return {
            "aria-invalid": Boolean(errors[name]),
            "aria-describedby": errors[name]
                ? `${name}-error`
                : undefined,
        };
    }

    function fieldError(name: string) {
        if (!errors[name]) return null;

        return (
            <p
                id={`${name}-error`}
                className="mt-2 text-xs text-destructive"
            >
                {errors[name]}
            </p>
        );
    }

    return (
        <form
            action={formAction}
            aria-busy={pending}
            className="space-y-5"
            onInvalidCapture={(event) => {
                const target = event.target;

                if (
                    target instanceof HTMLInputElement ||
                    target instanceof HTMLSelectElement
                ) {
                    const key = target.id;

                    if (key) {
                        setErrors((previous) => ({
                            ...previous,
                            [key]: target.validationMessage,
                        }));
                    }
                }
            }}
            onInputCapture={(event) => {
                const target = event.target;

                if (
                    target instanceof HTMLInputElement ||
                    target instanceof HTMLSelectElement
                ) {
                    clearError(target.id);
                }
            }}
            onSubmit={(event) => {
                const form = event.currentTarget;
                const data = new FormData(form);

                const invoice = String(data.get("invoice") ?? "").trim();
                const supplier = String(data.get("supplier") ?? "").trim();
                const vehicle = String(data.get("vehicleNumber") ?? "").trim();
                const received = String(data.get("receivedDate") ?? "").trim();

                const nextErrors: FieldErrors = {};

                if (!invoice) {
                    nextErrors.invoice = "Enter an invoice number.";
                }

                if (!supplier) {
                    nextErrors.supplier = "Enter a supplier name.";
                }

                if (received && !vehicle) {
                    nextErrors.vehicleNumber =
                        "Enter a vehicle number, or leave the received date blank.";
                }

                if (Object.keys(nextErrors).length > 0) {
                    event.preventDefault();
                    setErrors(nextErrors);

                    const firstName = Object.keys(nextErrors)[0];
                    const firstField = form.elements.namedItem(firstName);

                    if (firstField instanceof HTMLElement) {
                        firstField.focus();
                    }
                }
            }}
        >
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
                className="grid min-w-0 grid-cols-1 items-stretch gap-4
                           md:grid-cols-2
                           xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]"
            >
                <legend className="sr-only">
                    New invoice details
                </legend>

                <FormSection
                    title="Invoice details"
                    description="Enter the invoice reference and choose how it will be processed."
                    icon={<FileText className="size-4" />}
                    wide
                >
                    <div className="min-w-0 sm:col-span-2">
                        <label htmlFor="invoice" className={labelClass}>
                            Invoice number *
                        </label>

                        <input
                            id="invoice"
                            name="invoice"
                            type="text"
                            required
                            maxLength={100}
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="e.g. FA-8217"
                            value={fields.invoice}
                            onChange={(event) =>
                                updateField("invoice", event.target.value)
                            }
                            className={inputClass}
                            {...errorProps("invoice")}
                        />

                        {fieldError("invoice")}
                    </div>

                    <div className="min-w-0 sm:col-span-2">
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
                            value={fields.supplier}
                            onChange={(event) =>
                                updateField("supplier", event.target.value)
                            }
                            className={inputClass}
                            {...errorProps("supplier")}
                        />

                        {fieldError("supplier")}
                    </div>

                    <div>
                        <label htmlFor="system" className={labelClass}>
                            System *
                        </label>

                        <select
                            id="system"
                            name="system"
                            required
                            value={fields.system}
                            onChange={(event) =>
                                updateField("system", event.target.value)
                            }
                            className={inputClass}
                            {...errorProps("system")}
                        >
                            <option value="" disabled>
                                Select system
                            </option>
                            <option value="AX">AX</option>
                            <option value="D365">D365</option>
                            <option value="AX/D365">AX/D365</option>
                        </select>

                        {fieldError("system")}
                    </div>

                    <div>
                        <label htmlFor="shipment" className={labelClass}>
                            Local / Import *
                        </label>

                        <select
                            id="shipment"
                            name="shipment"
                            required
                            value={fields.shipment}
                            onChange={(event) =>
                                updateField("shipment", event.target.value)
                            }
                            className={inputClass}
                            {...errorProps("shipment")}
                        >
                            <option value="" disabled>
                                Select shipment type
                            </option>
                            <option value="LOCAL">Local</option>
                            <option value="IMPORT">Import</option>
                        </select>

                        {fieldError("shipment")}
                    </div>
                </FormSection>

                <FormSection
                    title="Quantity & date"
                    description="Choose the quantity unit and confirm the document share date."
                    icon={<CalendarDays className="size-4" />}
                >
                    <div>
                        <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2">
                            <div>
                                <label htmlFor="quantity" className={labelClass}>
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
                                    onChange={(event) => {
                                        setQuantity(event.target.value);
                                        clearError("quantity");
                                    }}
                                    className={inputClass}
                                    aria-invalid={Boolean(errors.quantity)}
                                    aria-describedby={
                                        errors.quantity
                                            ? "quantity-help quantity-error"
                                            : "quantity-help"
                                    }
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

                                        clearError("quantity");
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
                            className="mt-2 text-xs leading-5 text-muted-foreground"
                        >
                            {isMeters
                                ? "Meters: up to 3 decimal places."
                                : "Rolls: whole numbers only."}
                            {" "}Changing the unit does not convert the value.
                        </p>

                        {fieldError("quantity")}
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
                            value={fields.documentDate}
                            onChange={(event) =>
                                updateField("documentDate", event.target.value)
                            }
                            className={inputClass}
                            {...errorProps("documentDate")}
                        />

                        {fieldError("documentDate")}
                    </div>
                </FormSection>

                <FormSection
                    title="Vehicle details"
                    description="Assign a vehicle now, or add it later from Vehicle management."
                    icon={<Truck className="size-4" />}
                    optional
                >
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
                            placeholder="Search or enter vehicle number"
                            className={inputClass}
                            {...errorProps("vehicleNumber")}
                        />

                        {fieldError("vehicleNumber")}
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
                            value={fields.receivedDate}
                            onChange={(event) => {
                                updateField("receivedDate", event.target.value);
                                clearError("vehicleNumber");
                            }}
                            className={inputClass}
                            aria-invalid={Boolean(errors.receivedDate)}
                            aria-describedby={
                                errors.receivedDate
                                    ? "received-date-help receivedDate-error"
                                    : "received-date-help"
                            }
                        />

                        <p
                            id="received-date-help"
                            className="mt-2 text-xs leading-5 text-muted-foreground"
                        >
                            Requires a vehicle number. Leave blank to keep
                            an existing vehicle’s received date.
                        </p>

                        {fieldError("receivedDate")}
                    </div>
                </FormSection>
            </fieldset>

            {state.error && (
                <div
                    ref={errorSummary}
                    tabIndex={-1}
                    role="alert"
                    className="flex items-start gap-3 rounded-xl border
                        border-destructive/30 bg-destructive/5 p-4
                        text-sm text-destructive focus:outline-none
                        focus:ring-2 focus:ring-destructive/30"
                >
                    <AlertCircle
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                    />

                    <div>
                        <p className="font-semibold">
                            Invoice could not be saved
                        </p>

                        <p className="mt-1 leading-6">
                            {state.error}
                        </p>
                    </div>
                </div>
            )}

            <footer className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                    <p className="text-sm font-medium">
                        Ready to start tracking
                    </p>

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        The invoice will start as Pending.
                        Processing details can be added after saving.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:flex sm:shrink-0">
                    {pending ? (
                        <button
                            type="button"
                            disabled
                            className={secondaryButton}
                        >
                            Cancel
                        </button>
                    ) : (
                        <Link
                            href="/dashboard"
                            className={secondaryButton}
                        >
                            Cancel
                        </Link>
                    )}

                    <button
                        type="submit"
                        disabled={pending}
                        className="inline-flex min-h-11 items-center
                            justify-center gap-2 rounded-md bg-blue-700
                            px-5 text-sm font-semibold text-white shadow-sm
                            transition-colors hover:bg-blue-800
                            focus-visible:outline-none focus-visible:ring-2
                            focus-visible:ring-blue-500 focus-visible:ring-offset-2
                            focus-visible:ring-offset-card
                            disabled:cursor-wait disabled:opacity-60"
                    >
                        {pending ? (
                            <Loader2
                                className="size-4 animate-spin motion-reduce:animate-none"
                                aria-hidden="true"
                            />
                        ) : (
                            <Save className="size-4" aria-hidden="true" />
                        )}

                        {pending ? "Saving…" : "Save invoice"}
                    </button>
                </div>
            </footer>
        </form>
    );
}