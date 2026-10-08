"use client";

import { useActionState } from "react";
import { changeUserAccess } from "./actions";

type Props = {
    userId: string;
    fullName: string;
    isActive: boolean;
    isCurrentUser: boolean;
};

export default function AccessControl({
    userId,
    fullName,
    isActive,
    isCurrentUser,
}: Props) {
    const [state, formAction, pending] = useActionState(
        changeUserAccess,
        {
            error: "",
            success: "",
        },
    );

    if (isCurrentUser) {
        return (
            <span className="text-xs text-slate-400">
                Your account
            </span>
        );
    }

    return (
        <form
            action={formAction}
            onSubmit={(event) => {
                const action = isActive ? "Deactivate" : "Activate";

                if (!window.confirm(`${action} account for ${fullName}?`)) {
                    event.preventDefault();
                }
            }}
            className="space-y-2"
        >
            <input type="hidden" name="userId" value={userId} />

            <input
                type="hidden"
                name="expectedActive"
                value={String(isActive)}
            />

            <input
                type="hidden"
                name="isActive"
                value={String(!isActive)}
            />

            <button
                type="submit"
                disabled={pending}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-50 ${isActive
                        ? "border-input text-muted-foreground hover:bg-muted"
                        : "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/40"
                    }`}
            >
                {pending
                    ? "Saving..."
                    : isActive
                        ? "Deactivate"
                        : "Activate"}
            </button>

            {state.error && (
                <p role="alert" className="max-w-xs text-xs text-red-600 dark:text-red-400">
                    {state.error}
                </p>
            )}

            {state.success && (
                <p role="status" className="text-xs text-blue-700 dark:text-blue-400">
                    {state.success}
                </p>
            )}
        </form>
    );
}