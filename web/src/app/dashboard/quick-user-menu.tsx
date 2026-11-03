"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Users, X } from "lucide-react";

import {
    invoiceQuickUsers,
    type Assignment,
    type QuickField,
} from "./quick-user-actions";

type Values = Record<QuickField, string>;

const EMPTY_VALUES: Values = {
    AX: "",
    D365: "",
    ASN: "",
    ROLL: "",
};

function valuesFrom(data: Assignment): Values {
    return {
        AX:
            data.stages.find((stage) => stage.system_name === "AX")
                ?.assigned_user_name ?? "",
        D365:
            data.stages.find((stage) => stage.system_name === "D365")
                ?.assigned_user_name ?? "",
        ASN: data.asn_user_name ?? "",
        ROLL:
            data.roll_quantity == null
                ? ""
                : String(data.roll_quantity),
    };
}

const inputClass =
    "mt-1 h-9 w-full rounded-md border border-border " +
    "bg-background px-2 text-sm font-normal text-foreground " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-blue-500 disabled:opacity-60";

export default function QuickUserMenu({
    invoiceId,
    invoiceNumber,
}: {
    invoiceId: string;
    invoiceNumber: string;
}) {
    const router = useRouter();
    const dialog = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const lock = useRef(false);

    const titleId = useId();
    const namesId = useId();

    const [data, setData] = useState<Assignment | null>(null);
    const [values, setValues] = useState<Values>(EMPTY_VALUES);
    const [busy, setBusy] = useState(false);
    const [blocked, setBlocked] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);

    async function load() {
        if (lock.current) return;

        lock.current = true;
        setBusy(true);
        setBlocked(false);
        setError("");
        setSaved(false);
        setData(null);

        try {
            const result = await invoiceQuickUsers(invoiceId);

            if (result.error || !result.data) {
                setBlocked(true);
                setError(result.error || "Unable to load details.");
            } else {
                setData(result.data);
                setValues(valuesFrom(result.data));
            }
        } catch {
            setBlocked(true);
            setError("Connection interrupted. Reload details.");
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }

    function open() {
        const box = trigger.current?.getBoundingClientRect();
        const panel = dialog.current;

        if (!box || !panel) return;

        panel.style.left = `${Math.max(
            8,
            Math.min(box.left, window.innerWidth - 328),
        )}px`;

        panel.style.top = `${Math.max(
            8,
            Math.min(box.bottom + 6, window.innerHeight - 490),
        )}px`;

        panel.showModal();
        void load();
    }

    function edit(field: QuickField, value: string) {
        setValues((previous) => ({
            ...previous,
            [field]: value,
        }));
        setSaved(false);

        if (!blocked) {
            setError("");
        }
    }

    async function save(field: QuickField, raw: string) {
        if (!data || lock.current || blocked) return;

        let value = raw.trim();

        if (field === "ROLL") {
            if (
                value !== "" &&
                (
                    !/^\d{1,10}$/.test(value) ||
                    Number(value) > 2147483647
                )
            ) {
                setError(
                    "Roll quantity must be a whole number " +
                    "between 0 and 2147483647.",
                );
                return;
            }

            if (value !== "") {
                value = String(Number(value));
            }
        } else if (value.length > 150) {
            setError("User name must be 150 characters or fewer.");
            return;
        }

        const previousValue = valuesFrom(data)[field];

        if (value === previousValue) {
            setValues((previous) => ({
                ...previous,
                [field]: value,
            }));
            return;
        }

        lock.current = true;
        setBusy(true);
        setSaved(false);
        setError("");

        try {
            const result = await invoiceQuickUsers(invoiceId, {
                field,
                value,
                version: data.version,
            });

            if (result.error || !result.data) {
                setBlocked(true);
                setError(
                    result.error ||
                    "Reload details to confirm the saved values.",
                );
            } else {
                const updated = result.data;

                setData(updated);
                setValues((previous) => ({
                    ...previous,
                    [field]: valuesFrom(updated)[field],
                }));
                setSaved(true);
                router.refresh();
            }
        } catch {
            setBlocked(true);
            setError(
                "Save confirmation was not received. " +
                "Reload details before editing again.",
            );
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }

    const userFields: {
        field: QuickField;
        label: string;
    }[] = data
            ? [
                ...data.stages.map((stage) => ({
                    field: stage.system_name,
                    label: `${stage.system_name} User`,
                })),
                { field: "ASN", label: "ASN User" },
            ]
            : [];

    return (
        <>
            <button
                ref={trigger}
                type="button"
                onClick={open}
                title="Edit users and roll quantity"
                aria-label={`Edit users and roll quantity for ${invoiceNumber}`}
                aria-haspopup="dialog"
                className="inline-flex h-8 shrink-0 items-center gap-0.5
                    rounded-md border border-border px-1.5
                    text-muted-foreground hover:bg-muted
                    hover:text-foreground focus-visible:outline-2
                    focus-visible:outline-blue-500"
            >
                <Users className="size-3.5" aria-hidden="true" />
                <ChevronDown className="size-3" aria-hidden="true" />
            </button>

            <dialog
                ref={dialog}
                aria-labelledby={titleId}
                onClose={() => trigger.current?.focus()}
                onClick={(event) => {
                    if (event.target === event.currentTarget) {
                        dialog.current?.close();
                    }
                }}
                className="fixed m-0 max-h-[calc(100dvh-16px)]
                    w-80 max-w-[calc(100vw-16px)] overflow-y-auto
                    rounded-xl border border-border bg-card p-0
                    text-left text-foreground shadow-xl
                    backdrop:bg-black/20"
            >
                <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h2
                                id={titleId}
                                className="text-sm font-semibold"
                            >
                                Quick edit
                            </h2>

                            <p className="mt-1 break-all text-xs font-normal text-muted-foreground">
                                {invoiceNumber}
                            </p>
                        </div>

                        <button
                            type="button"
                            aria-label="Close quick edit"
                            onClick={() => dialog.current?.close()}
                            className="rounded p-1 hover:bg-muted"
                        >
                            <X className="size-4" aria-hidden="true" />
                        </button>
                    </div>

                    {data && (
                        <>
                            <datalist id={namesId}>
                                {data.user_names.map((name) => (
                                    <option key={name} value={name} />
                                ))}
                            </datalist>

                            {userFields.map(({ field, label }) => (
                                <label
                                    key={field}
                                    className="block text-xs font-medium"
                                >
                                    {label}

                                    <input
                                        type="text"
                                        list={namesId}
                                        value={values[field]}
                                        maxLength={150}
                                        autoComplete="off"
                                        placeholder="Select or type a name"
                                        disabled={busy || blocked}
                                        onChange={(event) =>
                                            edit(field, event.target.value)
                                        }
                                        onBlur={(event) =>
                                            void save(
                                                field,
                                                event.currentTarget.value,
                                            )
                                        }
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                event.currentTarget.blur();
                                            }
                                        }}
                                        className={inputClass}
                                    />
                                </label>
                            ))}

                            <div className="border-t border-border pt-3">
                                <label className="block text-xs font-medium">
                                    Roll quantity

                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={values.ROLL}
                                        maxLength={10}
                                        autoComplete="off"
                                        placeholder="Optional"
                                        disabled={busy || blocked}
                                        onChange={(event) =>
                                            edit("ROLL", event.target.value)
                                        }
                                        onBlur={(event) =>
                                            void save(
                                                "ROLL",
                                                event.currentTarget.value,
                                            )
                                        }
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                event.currentTarget.blur();
                                            }
                                        }}
                                        className={inputClass}
                                    />
                                </label>
                            </div>
                        </>
                    )}

                    <p
                        role="status"
                        aria-live="polite"
                        className="text-xs font-normal text-muted-foreground"
                    >
                        {busy
                            ? data
                                ? "Saving…"
                                : "Loading details…"
                            : saved
                                ? "Saved ✓"
                                : "Press Enter or leave a field to save."}
                    </p>

                    {error && (
                        <div
                            role="alert"
                            className="space-y-2 text-xs font-normal
                                text-red-700 dark:text-red-300"
                        >
                            <p>{error}</p>

                            {blocked && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void load()}
                                    className="rounded border border-current
                                        px-2 py-1.5"
                                >
                                    Reload details
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </dialog>
        </>
    );
}