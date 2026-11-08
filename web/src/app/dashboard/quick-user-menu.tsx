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

// Remember recent names during this browser session.
// A full browser refresh clears this list.
let recentNames: string[] = [];

function rememberName(name: string) {
    const clean = name.trim();
    if (!clean) return;

    recentNames = [
        clean,
        ...recentNames.filter(
            (item) => item.toLowerCase() !== clean.toLowerCase(),
        ),
    ].slice(0, 6);
}

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

function normalize(field: QuickField, raw: string) {
    const value = raw.trim();

    if (field === "ROLL") {
        if (
            value !== "" &&
            (
                !/^\d{1,10}$/.test(value) ||
                Number(value) > 2147483647
            )
        ) {
            throw new Error(
                "Roll quantity must be a whole number " +
                "between 0 and 2147483647.",
            );
        }

        return value === "" ? "" : String(Number(value));
    }

    if (value.length > 150) {
        throw new Error(
            "User name must be 150 characters or fewer.",
        );
    }

    return value;
}

const inputClass =
    "mt-1 h-9 w-full rounded-md border border-border " +
    "bg-background px-2 text-sm font-normal text-foreground " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-blue-500";

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
    const inputs = useRef<
        Partial<Record<QuickField, HTMLInputElement | null>>
    >({});

    const currentData = useRef<Assignment | null>(null);
    const draft = useRef<Values>({ ...EMPTY_VALUES });

    // Only one save request runs at a time.
    const pending = useRef(new Map<QuickField, string>());
    const running = useRef<Promise<boolean> | null>(null);
    const blocked = useRef(false);
    const loadingRef = useRef(false);
    const closingRef = useRef(false);

    const titleId = useId();
    const namesId = useId();

    const [data, setData] = useState<Assignment | null>(null);
    const [values, setValues] = useState<Values>({
        ...EMPTY_VALUES,
    });
    const [recent, setRecent] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [closing, setClosing] = useState(false);
    const [error, setError] = useState("");
    const [needsReload, setNeedsReload] = useState(false);
    const [saved, setSaved] = useState(false);

    function fieldsFor(record: Assignment): QuickField[] {
        return [
            ...record.stages.map((stage) => stage.system_name),
            "ASN",
            "ROLL",
        ];
    }

    function edit(field: QuickField, value: string) {
        draft.current = {
            ...draft.current,
            [field]: value,
        };

        setValues({ ...draft.current });
        setSaved(false);

        if (!blocked.current) {
            setError("");
        }
    }

    function hasUnsavedValues() {
        const record = currentData.current;
        if (!record) return false;

        const stored = valuesFrom(record);

        return fieldsFor(record).some((field) => {
            try {
                return normalize(field, draft.current[field])
                    !== stored[field];
            } catch {
                return true;
            }
        });
    }

    async function load() {
        if (loadingRef.current || running.current) return;

        loadingRef.current = true;
        setLoading(true);
        setError("");
        setSaved(false);

        try {
            const result = await invoiceQuickUsers(invoiceId);

            if (result.error || !result.data) {
                throw new Error(
                    result.error || "Unable to load details.",
                );
            }

            currentData.current = result.data;
            draft.current = valuesFrom(result.data);

            pending.current.clear();
            blocked.current = false;

            setData(result.data);
            setValues({ ...draft.current });
            setRecent([...recentNames]);
            setNeedsReload(false);

            const firstField = fieldsFor(result.data)[0];

            requestAnimationFrame(() => {
                if (dialog.current?.open) {
                    inputs.current[firstField]?.focus();
                }
            });
        } catch (cause) {
            blocked.current = true;
            setNeedsReload(true);

            setError(
                cause instanceof Error
                    ? cause.message
                    : "Connection interrupted. Reload details.",
            );
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }

    function open() {
        const box = trigger.current?.getBoundingClientRect();
        const panel = dialog.current;

        if (!box || !panel || closingRef.current) return;

        panel.style.left = `${Math.max(
            8,
            Math.min(box.left, window.innerWidth - 328),
        )}px`;

        panel.style.top = `${Math.max(
            8,
            Math.min(box.bottom + 6, window.innerHeight - 540),
        )}px`;

        panel.showModal();
        void load();
    }

    function drain(): Promise<boolean> {
        if (running.current) return running.current;

        if (blocked.current || !currentData.current) {
            return Promise.resolve(false);
        }

        setSaving(true);
        setSaved(false);

        let changed = false;

        const task = async () => {
            try {
                while (pending.current.size > 0) {
                    const entry = pending.current.entries().next().value;
                    if (!entry) break;

                    const [field, value] = entry;
                    const record = currentData.current;

                    if (!record || blocked.current) return false;

                    pending.current.delete(field);

                    if (valuesFrom(record)[field] === value) {
                        continue;
                    }

                    const result = await invoiceQuickUsers(invoiceId, {
                        field,
                        value,
                        version: record.version,
                    });

                    if (result.error || !result.data) {
                        throw new Error(
                            result.error ||
                            "Save confirmation was not received.",
                        );
                    }

                    // Keep the newest version for the next queued save.
                    // Do not overwrite text the user is still typing.
                    currentData.current = result.data;
                    setData(result.data);
                    changed = true;

                    if (field !== "ROLL" && value) {
                        rememberName(value);
                        setRecent([...recentNames]);
                    }
                }

                setSaved(!hasUnsavedValues());
                return true;
            } catch (cause) {
                blocked.current = true;
                setNeedsReload(true);

                setError(
                    (
                        cause instanceof Error
                            ? cause.message
                            : "Unable to save."
                    ) +
                    " Your typed values are still shown. " +
                    "Reload saved values before trying again.",
                );

                return false;
            } finally {
                setSaving(false);

                // Refresh after the queued changes, not after every field.
                if (changed) router.refresh();
            }
        };

        // Defer work so running.current is set before processing starts.
        const promise = Promise.resolve()
            .then(task)
            .finally(() => {
                running.current = null;
            });

        running.current = promise;
        return promise;
    }

    function commit(field: QuickField) {
        if (
            !currentData.current ||
            loadingRef.current ||
            closingRef.current ||
            blocked.current
        ) {
            return;
        }

        try {
            const value = normalize(field, draft.current[field]);

            setError("");
            pending.current.set(field, value);
            void drain();
        } catch (cause) {
            // Prevent an older queued value for this field from saving.
            pending.current.delete(field);

            setError(
                cause instanceof Error
                    ? cause.message
                    : "Check this value.",
            );
        }
    }

    async function closeAfterSave() {
        if (closingRef.current || loadingRef.current) return;

        const record = currentData.current;

        if (!record) {
            dialog.current?.close();
            return;
        }

        if (blocked.current) {
            setError(
                "Your changes are still shown. " +
                "Reload saved values to resolve the save error first.",
            );
            return;
        }

        const changes: [QuickField, string][] = [];

        for (const field of fieldsFor(record)) {
            try {
                changes.push([
                    field,
                    normalize(field, draft.current[field]),
                ]);
            } catch (cause) {
                pending.current.delete(field);

                setError(
                    cause instanceof Error
                        ? cause.message
                        : "Check this value.",
                );

                inputs.current[field]?.focus();
                return;
            }
        }

        closingRef.current = true;
        setClosing(true);
        setError("");

        try {
            for (const [field, value] of changes) {
                pending.current.set(field, value);
            }

            const success = await drain();

            if (success && !hasUnsavedValues()) {
                dialog.current?.close();
            }
        } finally {
            closingRef.current = false;
            setClosing(false);
        }
    }

    async function reloadSavedValues() {
        if (loadingRef.current || running.current) return;

        if (
            hasUnsavedValues() &&
            !window.confirm(
                "Reload saved values? Unsaved text currently shown " +
                "in this panel will be replaced.",
            )
        ) {
            return;
        }

        await load();
    }

    function selectRecent(field: QuickField, name: string) {
        edit(field, name);
        commit(field);
        inputs.current[field]?.focus();
    }

    function copyToAsn(system: "AX" | "D365") {
        const name = draft.current[system].trim();
        if (!name) return;

        // Save the source name too if it was just typed.
        commit(system);
        edit("ASN", name);
        commit("ASN");
        inputs.current.ASN?.focus();
    }

    function moveNext(field: QuickField) {
        const record = currentData.current;
        if (!record) return;

        try {
            normalize(field, draft.current[field]);
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : "Check this value.",
            );
            return;
        }

        const fields = fieldsFor(record);
        const index = fields.indexOf(field);

        if (index === fields.length - 1) {
            void closeAfterSave();
            return;
        }

        commit(field);
        inputs.current[fields[index + 1]]?.focus();
    }

    const fields = data ? fieldsFor(data) : [];

    const suggestedNames = Array.from(
        new Set([...recent, ...(data?.user_names ?? [])]),
    );

    return (
        <>
            <button
                ref={trigger}
                type="button"
                onClick={open}
                title="Edit users and roll quantity"
                aria-label={`Quick edit ${invoiceNumber}`}
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
                onCancel={(event) => {
                    event.preventDefault();
                    void closeAfterSave();
                }}
                onClick={(event) => {
                    if (event.target === event.currentTarget) {
                        void closeAfterSave();
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
                            aria-label="Save and close quick edit"
                            disabled={loading || closing}
                            onClick={() => void closeAfterSave()}
                            className="rounded p-1 hover:bg-muted
                                disabled:opacity-50"
                        >
                            <X className="size-4" aria-hidden="true" />
                        </button>
                    </div>

                    {loading ? (
                        <p role="status" className="text-sm text-muted-foreground">
                            Loading details…
                        </p>
                    ) : data && (
                        <>
                            <datalist id={namesId}>
                                {suggestedNames.map((name) => (
                                    <option key={name} value={name} />
                                ))}
                            </datalist>

                            {fields.map((field) => (
                                <div
                                    key={field}
                                    className={
                                        field === "ROLL"
                                            ? "border-t border-border pt-3"
                                            : ""
                                    }
                                >
                                    <label className="block text-xs font-medium">
                                        {field === "ROLL"
                                            ? "Roll quantity"
                                            : `${field} User`}

                                        <input
                                            ref={(element) => {
                                                inputs.current[field] = element;
                                            }}
                                            type="text"
                                            list={
                                                field === "ROLL"
                                                    ? undefined
                                                    : namesId
                                            }
                                            inputMode={
                                                field === "ROLL"
                                                    ? "numeric"
                                                    : "text"
                                            }
                                            value={values[field]}
                                            maxLength={
                                                field === "ROLL" ? 10 : 150
                                            }
                                            autoComplete="off"
                                            placeholder={
                                                field === "ROLL"
                                                    ? "Optional"
                                                    : "Select or type a name"
                                            }
                                            readOnly={closing}
                                            onChange={(event) =>
                                                edit(
                                                    field,
                                                    event.target.value,
                                                )
                                            }
                                            onBlur={() => commit(field)}
                                            onKeyDown={(event) => {
                                                if (
                                                    event.key === "Enter" &&
                                                    !event.nativeEvent.isComposing
                                                ) {
                                                    event.preventDefault();
                                                    moveNext(field);
                                                }
                                            }}
                                            className={inputClass}
                                        />
                                    </label>

                                    {field !== "ROLL" && recent.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                            <span className="text-[10px] font-normal text-muted-foreground">
                                                Recent:
                                            </span>

                                            {recent.slice(0, 3).map((name) => (
                                                <button
                                                    key={name}
                                                    type="button"
                                                    tabIndex={-1}
                                                    disabled={closing}
                                                    title={name}
                                                    onMouseDown={(event) =>
                                                        event.preventDefault()
                                                    }
                                                    onClick={() =>
                                                        selectRecent(field, name)
                                                    }
                                                    className="max-w-28 truncate
                                                        rounded bg-muted px-1.5 py-1
                                                        text-[11px] font-normal
                                                        hover:bg-blue-100
                                                        dark:hover:bg-blue-950"
                                                >
                                                    {name}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {field === "ASN" && (
                                        <div className="mt-1.5 flex flex-wrap gap-2">
                                            {data.stages.map((stage) => {
                                                const system = stage.system_name;

                                                if (!values[system].trim()) {
                                                    return null;
                                                }

                                                return (
                                                    <button
                                                        key={system}
                                                        type="button"
                                                        disabled={closing}
                                                        onMouseDown={(event) =>
                                                            event.preventDefault()
                                                        }
                                                        onClick={() =>
                                                            copyToAsn(system)
                                                        }
                                                        className="rounded py-1
                                                            text-[11px] font-medium
                                                            text-blue-700
                                                            hover:underline
                                                            dark:text-blue-400"
                                                    >
                                                        Same as {system} user
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}

                    <p
                        role="status"
                        aria-live="polite"
                        className="text-xs font-normal text-muted-foreground"
                    >
                        {closing
                            ? "Saving and closing…"
                            : saving
                                ? "Saving… You can keep typing."
                                : saved
                                    ? "Saved ✓"
                                    : "Tab / Enter: next field. Enter on quantity: save & close."}
                    </p>

                    {error && (
                        <div
                            role="alert"
                            className="space-y-2 text-xs font-normal
                                text-red-700 dark:text-red-300"
                        >
                            <p>{error}</p>

                            {needsReload && (
                                <button
                                    type="button"
                                    disabled={saving || loading}
                                    onClick={() => void reloadSavedValues()}
                                    className="rounded border border-current
                                        px-2 py-1.5 disabled:opacity-50"
                                >
                                    Reload saved values
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </dialog>
        </>
    );
}