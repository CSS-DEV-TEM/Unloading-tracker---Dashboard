"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { invoiceQuickProgress } from "@/app/dashboard/quick-progress-actions";
import type { Progress } from "@/app/dashboard/quick-progress-actions";

export default function QuickProgressCell({ invoiceId, invoiceNumber, initial }: {
    invoiceId: string; invoiceNumber: string; initial: Progress;
}) {
    const router = useRouter();
    const lock = useRef(false);
    const [busy, setBusy] = useState(false);
    const [data, setData] = useState<Progress | null>(initial);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    async function load() {
        if (lock.current) return;
        lock.current = true; setBusy(true); setError(''); setSaved(false);
        setData(null);
        try {
            const result = await invoiceQuickProgress(invoiceId);
            if (!result.data || result.error) setError(result.error || 'Unable to load progress.');
            else setData(result.data);
        } catch { setError('Connection interrupted. Reload ticks to get the current values.'); }
        finally { lock.current = false; setBusy(false); }
    }

    async function update(field: 'AX' | 'D365' | 'ASN', checked: boolean) {
        if (lock.current || !data || error) return;
        lock.current = true; setBusy(true); setSaved(false);
        const previous = data;
        setData(field === 'ASN' ? { ...data, asn_shared: checked } : {
            ...data, stages: data.stages.map(stage => stage.system_name === field ? { ...stage, is_done: checked } : stage),
        });
        try {
            const result = await invoiceQuickProgress(invoiceId, { field, checked, version: previous.version });
            if (result.error || !result.data) {
                setData(previous); setError(result.error || 'Reload ticks to confirm the saved state.');
            } else {
                setData(result.data); setSaved(true); router.refresh();
            }
        } catch {
            setData(previous);
            setError('Save confirmation was not received. Reload ticks before changing anything else.');
        } finally { lock.current = false; setBusy(false); }
    }

    return <div role="group" aria-label={`Progress for ${invoiceNumber}`} aria-busy={busy}
        className="flex min-w-36 flex-col items-start gap-0.5">
        {data && <>
            {data.stages.map(stage => <label key={stage.system_name} className="inline-flex min-h-8 cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={stage.is_done} disabled={busy || !!error}
                    onChange={event => void update(stage.system_name, event.target.checked)}
                    className="size-4 accent-blue-700 disabled:cursor-wait" />
                {stage.system_name} Done
            </label>)}
            <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={data.asn_shared} disabled={busy || !!error}
                    onChange={event => void update('ASN', event.target.checked)} className="size-4 accent-blue-700 disabled:cursor-wait" />
                ASN Share
            </label>
        </>}
        <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {busy ? <><Loader2 aria-hidden="true" className="size-3.5 animate-spin" />{data ? 'Saving…' : 'Loading…'}</> : saved ? 'Saved ✓' : ''}
        </span>
        {error && <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-red-700 dark:text-red-300">
            {error}<button type="button" disabled={busy} onClick={() => void load()} className="min-h-8 rounded border border-current px-2 font-medium">Reload ticks</button>
        </div>}
    </div>;
}
