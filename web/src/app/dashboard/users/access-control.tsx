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
                        ? "border-slate-300 text-slate-600 hover:bg-slate-100"
                        : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    }`}
            >
                {pending
                    ? "Saving..."
                    : isActive
                        ? "Deactivate"
                        : "Activate"}
            </button>

            {state.error && (
                <p role="alert" className="max-w-xs text-xs text-red-600">
                    {state.error}
                </p>
            )}

            {state.success && (
                <p role="status" className="text-xs text-blue-700">
                    {state.success}
                </p>
            )}
        </form>
    );
}