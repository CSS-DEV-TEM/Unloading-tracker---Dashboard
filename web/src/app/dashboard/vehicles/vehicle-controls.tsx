"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
    Plus,
    Pencil,
    X,
    Search,
    Unlink,
    Archive,
    RotateCcw,
    Trash2,

} from "lucide-react";
import {
    changeVehicleState,
    assignInvoices,
    saveVehicle,
    updateVehicleDetails,
    saveVehicleArrival,
    searchAssignable,
    type InvoiceChoice,
    type VehicleRow,

} from "./actions";

const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-input bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const primary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50";
const input = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/25";

function announce(message: string) {
    window.dispatchEvent(new CustomEvent("vehicle-success", { detail: message }));
}

export function VehicleNotice() {
    const [message, setMessage] = useState("");
    useEffect(() => {
        const receive = (event: Event) => setMessage((event as CustomEvent<string>).detail);
        window.addEventListener("vehicle-success", receive);
        return () => window.removeEventListener("vehicle-success", receive);
    }, []);
    return <div role="status" aria-live="polite" aria-atomic="true">
        {message && <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <span>{message}</span><button type="button" className={button} aria-label="Dismiss notification" onClick={() => setMessage("")}><X className="size-4" /></button>
        </div>}
    </div>;
}

function Modal({ title, trigger, children, pending = false, onOpen, emphasis = false }: { title: string; trigger: ReactNode; children: (close: () => void) => ReactNode; pending?: boolean; onOpen?: () => void; emphasis?: boolean }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const opener = useRef<HTMLButtonElement>(null);
    const id = useId();
    return <>
        <button type="button" ref={opener} className={emphasis ? primary : button} onClick={() => { onOpen?.(); dialog.current?.showModal(); }}>{trigger}</button>
        <dialog ref={dialog} aria-labelledby={id} onCancel={e => { if (pending) e.preventDefault(); }} onClose={() => opener.current?.focus()}
            style={{ position: "fixed", inset: 0, margin: "auto", width: "calc(100vw - 2rem)", maxWidth: "44rem", maxHeight: "calc(100dvh - 2rem)", overflowY: "auto", backgroundColor: "var(--card)", color: "var(--foreground)" }}
            className="rounded-xl border border-border p-0 shadow-raised backdrop:bg-black/60 backdrop:backdrop-blur-[2px]">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-card p-5">
                <h2 id={id} className="min-w-0 break-words text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
                <button type="button" aria-label="Close dialog" disabled={pending} className={button} onClick={() => dialog.current?.close()}><X className="size-4" /></button>
            </div>
            <div className="p-5">{children(() => dialog.current?.close())}</div>
        </dialog>
    </>;
}

export function VehicleEditor({
    vehicle,
}: {
    vehicle?: VehicleRow;
}) {
    const router = useRouter();


    const [number, setNumber] = useState(
        vehicle?.vehicle_number ?? "",
    );
    const [receivedDate, setReceivedDate] = useState(
        vehicle?.received_date ?? "",
    );
    const [error, setError] = useState("");
    const [pending, start] = useTransition();

    const id = useId();
    const dateId = `${id}-received-date`;
    const editing = Boolean(vehicle);


    return (
        <Modal
            title={editing ? "Edit vehicle" : "Add vehicle"}
            emphasis={!editing}
            pending={pending}
            onOpen={() => {
                setNumber(vehicle?.vehicle_number ?? "");
                setReceivedDate(vehicle?.received_date ?? "");
                setError("");
            }}
            trigger={
                editing ? (
                    <>
                        <Pencil
                            className="size-4"
                            aria-hidden="true"
                        />
                        Edit vehicle
                    </>
                ) : (
                    <>
                        <Plus
                            className="size-4"
                            aria-hidden="true"
                        />
                        Add vehicle
                    </>
                )
            }
        >
            {(close) => (
                <>
                    <form
                        className="space-y-5"
                        onSubmit={(event) => {
                            event.preventDefault();
                            setError("");

                            start(async () => {
                                try {
                                    if (vehicle) {
                                        const result = await updateVehicleDetails(
                                            vehicle.id,
                                            vehicle.version,
                                            number,
                                            receivedDate,
                                        );

                                        if (result.error) {
                                            setError(result.error);
                                            return;
                                        }

                                        close();
                                        announce("Vehicle details saved successfully.");
                                        router.refresh();
                                        return;
                                    }

                                    if (!editing && receivedDate) {
                                        const result =
                                            await saveVehicleArrival(
                                                number,
                                                receivedDate,
                                            );

                                        if (result.error) {
                                            setError(result.error);
                                            return;
                                        }

                                        close();

                                        router.push("/dashboard/vehicles?notice=saved", { scroll: false });
                                        router.refresh();
                                        return;
                                    }

                                    const result = await saveVehicle(
                                        null,
                                        null,
                                        number,
                                    );

                                    if (result.error) {
                                        setError(result.error);
                                        return;
                                    }

                                    close();
                                    router.push("/dashboard/vehicles?notice=saved", { scroll: false });
                                    router.refresh();
                                } catch {
                                    setError(
                                        "Unable to save. Please try again.",
                                    );
                                }
                            });
                        }}
                    >
                        <div>
                            <label
                                htmlFor={id}
                                className="mb-2 block text-sm font-medium"
                            >
                                Vehicle number
                            </label>

                            <div className="relative">
                                <input
                                    autoFocus
                                    id={id}
                                    value={number}
                                    onChange={(event) =>
                                        setNumber(event.target.value)
                                    }
                                    required
                                    maxLength={30}
                                    disabled={pending}
                                    className={input}
                                    placeholder="WP ABC-1234"
                                    autoComplete="off"
                                    spellCheck={false}
                                />


                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor={dateId}
                                className="mb-2 block text-sm font-medium"
                            >
                                Received date
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    Optional
                                </span>
                            </label>

                            <input
                                id={dateId}
                                type="date"
                                value={receivedDate}
                                onChange={(event) =>
                                    setReceivedDate(event.target.value)
                                }
                                min="0001-01-01"
                                max="9999-12-31"
                                disabled={pending}
                                className={input}
                            />
                        </div>

                        <p className="text-sm leading-6 text-muted-foreground">
                            {editing
                                ? "Update the vehicle number and received date, then save your changes."
                                : "Enter the vehicle number and received date."}
                        </p>

                        {error && (
                            <p
                                role="alert"
                                className="rounded-lg border border-destructive/30
                            bg-destructive/5 px-3 py-2 text-sm text-destructive"
                            >
                                {error}
                            </p>
                        )}

                        <div className="flex justify-end gap-3 border-t border-border pt-4">
                            <button
                                type="button"
                                disabled={pending}
                                onClick={close}
                                className={button}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={pending}
                                className={primary}
                            >
                                {pending
                                    ? "Saving…"
                                    : editing
                                        ? "Save changes"
                                        : receivedDate
                                            ? "Save arrival"
                                            : "Save vehicle"}
                            </button>
                        </div>
                    </form>


                </>
            )}
        </Modal>
    );
}

export function AssignDialog({ vehicle }: { vehicle: VehicleRow }) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [rows, setRows] = useState<InvoiceChoice[]>([]);
    const [selected, setSelected] = useState<InvoiceChoice[]>([]);
    const [page, setPage] = useState(1);
    const [more, setMore] = useState(false);
    const [review, setReview] = useState(false);
    const requestId = useRef(0);
    const [appliedQuery, setAppliedQuery] = useState("");
    const [error, setError] = useState("");
    const [pending, start] = useTransition();
    const [loading, load] = useTransition();
    const busy = pending || loading;
    const id = useId();
    function search(text: string, next: number) {
        const currentRequest = ++requestId.current;
        load(async () => {
            try {
                const result = await searchAssignable(text, next);
                if (currentRequest !== requestId.current) return;
                setAppliedQuery(text);
                setRows(result.items); setMore(result.more); setPage(next); setError(result.error);
            } catch { if (currentRequest === requestId.current) { setRows([]); setError("Unable to load invoices. Try again."); } }
        });
    }
    return <Modal title={`Assign invoices · ${vehicle.vehicle_number}`} pending={pending} emphasis
        onOpen={() => { setQuery(""); setSelected([]); setReview(false); setError(""); search("", 1); }}
        trigger={<><Plus className="size-4" />Assign invoices</>}>
        {close => <div className="space-y-4">
            {!review ? <>
                <form onSubmit={e => { e.preventDefault(); search(query, 1); }} className="flex gap-2">
                    <label htmlFor={id} className="sr-only">Search invoices</label>
                    <input autoFocus id={id} value={query} onChange={e => setQuery(e.target.value)} maxLength={100} className={input} placeholder="Invoice, supplier or vehicle" disabled={busy} />
                    <button disabled={busy} className={button}><Search className="size-4" /><span className="sr-only">Search</span></button>
                </form>
                <p className="text-xs text-muted-foreground">Select up to 50 invoices. Your selection is kept when searching or changing pages.</p>
                <div className="max-h-[35dvh] divide-y divide-border overflow-y-auto rounded-lg border border-border" aria-busy={loading}>
                    {loading ? <p role="status" className="p-4 text-sm">Loading invoices…</p> : rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No matching invoices.</p> : rows.map(row => {
                        const checked = selected.some(item => item.id === row.id);
                        const assigned = row.vehicle_id === vehicle.id;
                        const locked = row.status === "Complete";
                        return <label key={row.id} className={`flex items-start gap-3 p-3 text-sm transition-colors ${checked ? "bg-primary/[0.06]" : locked || assigned ? "bg-muted/40 text-muted-foreground" : "cursor-pointer hover:bg-muted/50"}`}>
                            <input type="checkbox" className="mt-1 size-4 accent-primary" checked={checked} disabled={busy || locked || assigned || (!checked && selected.length >= 50)} onChange={() => setSelected(old => checked ? old.filter(item => item.id !== row.id) : [...old, row])} />
                            <span className="min-w-0"><span className="block break-words font-semibold">{row.invoice_number}</span><span className="block break-words text-muted-foreground">{row.supplier}</span><span className="mt-1 block text-xs text-muted-foreground">{locked ? "Complete · Reopen as Pending to change vehicle" : assigned ? "Already assigned to this vehicle" : `Current vehicle: ${row.vehicle_number || "Unassigned"}`}</span></span>
                        </label>;
                    })}
                </div>
                <div className="flex items-center justify-between gap-2"><button type="button" className={button} disabled={busy || page === 1} onClick={() => search(appliedQuery, page - 1)}>Previous</button><span className="text-xs">Page {page}</span><button type="button" className={button} disabled={busy || !more} onClick={() => search(appliedQuery, page + 1)}>Next</button></div>
            </> : <>
                <p className="text-sm">Review {selected.length} assignment(s). Invoices currently on another vehicle will move to <strong>{vehicle.vehicle_number}</strong>.</p>
                <ul className="max-h-[35dvh] overflow-y-auto divide-y divide-border rounded-lg border border-border">{selected.map(row => <li key={row.id} className="p-3 text-sm"><p className="break-words font-semibold">{row.invoice_number}</p><p className="mt-1 break-words text-muted-foreground">{row.vehicle_number || "Unassigned"} → {vehicle.vehicle_number}</p></li>)}</ul>
            </>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card py-4">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">{selected.length} selected</span>
                    {!review && selected.length > 0 && <button type="button" className={button} disabled={pending} onClick={() => { setReview(true); setError(""); }}>View selected</button>}
                    {selected.length > 0 && <button type="button" className={button} disabled={pending} onClick={() => { setSelected([]); setReview(false); }}>Clear selection</button>}
                </div>
                <div className="flex gap-2"><button type="button" disabled={pending} className={button} onClick={() => review ? setReview(false) : close()}>{review ? "Back" : "Cancel"}</button>
                    <button type="button" disabled={busy || !selected.length} className={primary} onClick={() => {
                        if (!review) { setReview(true); setError(""); return; }
                        start(async () => {
                            try {
                                const result = await assignInvoices(vehicle.id, selected.map(({ id, version }) => ({ id, version })));
                                setError(result.error);
                                if (!result.error) { close(); announce(`${selected.length} invoice(s) assigned successfully.`); setSelected([]); router.refresh(); }
                            } catch { setError("Unable to save. Try again."); }
                        });
                    }}>{pending ? "Assigning…" : review ? "Confirm assignment" : "Review selection"}</button>
                </div>
            </div>
        </div>}
    </Modal>;
}

export function RemoveAssignment({ invoice }: { invoice: InvoiceChoice }) {
    const router = useRouter();
    const [error, setError] = useState("");
    const [pending, start] = useTransition();
    return <Modal title="Remove vehicle assignment" pending={pending} onOpen={() => setError("")}
        trigger={<><Unlink className="size-4" />Unassign</>}>
        {close => <div className="space-y-4"><p className="text-sm">Remove invoice <strong>{invoice.invoice_number}</strong> from <strong>{invoice.vehicle_number}</strong>? The invoice will remain in the dashboard.</p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-3"><button autoFocus type="button" disabled={pending} className={button} onClick={close}>Cancel</button><button type="button" disabled={pending} className={primary} onClick={() => start(async () => {
                try { const result = await assignInvoices(null, [{ id: invoice.id, version: invoice.version }]); setError(result.error); if (!result.error) { close(); announce("Invoice unassigned successfully."); router.refresh(); } }
                catch { setError("Unable to save. Try again."); }
            })}>{pending ? "Removing…" : "Remove assignment"}</button></div>
        </div>}
    </Modal>;
}

export function VehicleLifecycle({ vehicle, invoiceCount }: { vehicle: VehicleRow; invoiceCount: number }) {
    return <>
        <VehicleStateDialog vehicle={vehicle} action={vehicle.is_archived ? "restore" : "archive"} invoiceCount={invoiceCount} />
        {invoiceCount === 0 && <VehicleStateDialog vehicle={vehicle} action="delete" invoiceCount={invoiceCount} />}
    </>;
}

function VehicleStateDialog({ vehicle, action, invoiceCount }: {
    vehicle: VehicleRow; action: "archive" | "restore" | "delete"; invoiceCount: number;
}) {
    const router = useRouter();
    const [error, setError] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [pending, start] = useTransition();
    const id = useId();
    const deleting = action === "delete";
    const title = deleting ? "Delete vehicle" : action === "archive" ? "Archive vehicle" : "Restore vehicle";
    const Icon = deleting ? Trash2 : action === "archive" ? Archive : RotateCcw;
    return <Modal title={title} pending={pending} onOpen={() => { setError(""); setConfirmation(""); }}
        trigger={<><Icon aria-hidden="true" className="size-4" />{title}</>}>
        {close => <form className="space-y-5" onSubmit={e => {
            e.preventDefault();
            start(async () => {
                try {
                    const result = await changeVehicleState(vehicle.id, vehicle.version, action, confirmation);
                    setError(result.error);
                    if (!result.error) {
                        close();
                        const params = new URLSearchParams({ state: action === "archive" ? "archived" : "active", notice: action });
                        if (!deleting) params.set("vehicle", vehicle.id);
                        router.push(`/dashboard/vehicles?${params}`, { scroll: false });
                        router.refresh();
                    }
                } catch { setError("Unable to save. Please try again."); }
            });
        }}>
            <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">Vehicle number</p>
                <p className="mt-1 break-words text-lg font-semibold">{vehicle.vehicle_number}</p>
                <p className="mt-2 text-sm text-muted-foreground">{invoiceCount} assigned invoices</p>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{deleting
                ? "Permanently delete this unassigned vehicle? Invoice records and existing activity history will remain. This action cannot be undone."
                : action === "archive"
                    ? "Hide this vehicle from the active list and new assignment suggestions. Existing invoices and their vehicle labels will remain unchanged. You can restore it later."
                    : "Make this vehicle available for new invoice assignments again. Existing invoices will remain unchanged."}</p>
            {deleting && <div><label htmlFor={id} className="mb-2 block text-sm font-medium">Type {vehicle.vehicle_number} to confirm</label>
                <input id={id} className={input} value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" spellCheck={false} maxLength={30} disabled={pending} required /></div>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
                <button autoFocus type="button" className={button} disabled={pending} onClick={close}>Cancel</button>
                <button className={deleting ? "inline-flex min-h-10 items-center justify-center rounded-md bg-red-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-red-800 disabled:opacity-50" : primary}
                    disabled={pending || (deleting && confirmation !== vehicle.vehicle_number)}>{pending ? "Saving…" : title}</button>
            </div>
        </form>}
    </Modal>;
}