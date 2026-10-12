"use client";

import { useEffect, useId, useState, type InputHTMLAttributes } from "react";
import { vehicleSuggestions, type VehicleRow } from "@/app/dashboard/vehicles/actions";

export default function VehicleInput(props: InputHTMLAttributes<HTMLInputElement>) {
    const listId = useId();
    const [query, setQuery] = useState(String(props.value ?? props.defaultValue ?? ""));
    const [items, setItems] = useState<VehicleRow[]>([]);
    const [focused, setFocused] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        if (!focused) return;
        let current = true;
        const timer = setTimeout(() => {
            vehicleSuggestions(query).then(result => {
                if (current) { setItems(result.items); setError(result.error); }
            }).catch(() => { if (current) setError("Suggestions unavailable. You can still enter a number."); });
        }, 250);
        return () => { current = false; clearTimeout(timer); };
    }, [query, focused]);
    return <>
        <input {...props} list={listId} aria-describedby={`${listId}-help`}
            onFocus={event => { setFocused(true); props.onFocus?.(event); }}
            onBlur={event => { setFocused(false); props.onBlur?.(event); }}
            onChange={event => { setQuery(event.target.value); props.onChange?.(event); }} />
        <datalist id={listId}>{items.map(item => <option key={item.id} value={item.vehicle_number} />)}</datalist>
        <p id={`${listId}-help`} className="mt-1.5 text-xs text-muted-foreground">
            {error || "Choose an existing vehicle or enter a new number. Created when you save."}
        </p>
    </>;
}