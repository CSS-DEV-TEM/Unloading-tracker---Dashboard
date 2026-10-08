"use client";

import Image from "next/image";
import Link from "next/link";
import {
    useActionState,
    useEffect,
    useState,
    type FormEvent,
} from "react";
import {
    ArrowLeft,
    ArrowRight,
    Eye,
    EyeOff,
    Loader2,
} from "lucide-react";

import ThemeToggle from "@/components/theme-toggle";
import { signIn } from "./actions";

const EMAIL_STORAGE_KEY = "efl-unloading-remembered-email";

const inputClass =
    "h-11 w-full rounded-lg border border-input bg-background " +
    "px-3 text-base text-foreground outline-none " +
    "placeholder:text-muted-foreground " +
    "focus:border-blue-500 focus:ring-2 focus:ring-ring/25 " +
    "read-only:opacity-70";

export default function LoginPage() {
    const [state, formAction, pending] = useActionState(signIn, {
        error: "",
    });

    const [email, setEmail] = useState("");
    const [rememberEmail, setRememberEmail] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            try {
                const savedEmail =
                    window.localStorage.getItem(EMAIL_STORAGE_KEY);

                if (savedEmail && savedEmail.length <= 254) {
                    setEmail((current) => current || savedEmail);
                    setRememberEmail(true);
                }
            } catch {
                // Browser storage is optional.
            }
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        const data = new FormData(event.currentTarget);
        const enteredEmail = String(data.get("email") ?? "").trim();

        try {
            if (rememberEmail) {
                window.localStorage.setItem(
                    EMAIL_STORAGE_KEY,
                    enteredEmail,
                );
            } else {
                window.localStorage.removeItem(EMAIL_STORAGE_KEY);
            }
        } catch {
            // Storage failure must not block sign-in.
        }
    }

    function handleRememberChange(checked: boolean) {
        setRememberEmail(checked);

        if (!checked) {
            try {
                window.localStorage.removeItem(EMAIL_STORAGE_KEY);
            } catch {
                // Browser storage may be unavailable.
            }
        }
    }

    return (
        <main className="flex min-h-dvh flex-col bg-background px-4 py-4 text-foreground">
            <section
                aria-labelledby="login-heading"
                className="mx-auto my-auto w-full max-w-[400px] shrink-0 rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/5 sm:p-6"
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <Image
                            src="/efl-logo.png"
                            alt="EFL"
                            width={40}
                            height={40}
                            priority
                            unoptimized
                            className="size-10 shrink-0 object-contain"
                        />

                        <div className="min-w-0">
                            <p className="text-sm font-semibold tracking-tight">
                                Unloading Tracker
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                EFL 3PL · CSS Division
                            </p>
                        </div>
                    </div>

                    <div className="shrink-0">
                        <ThemeToggle />
                    </div>
                </div>

                <div className="mt-5">
                    <h1
                        id="login-heading"
                        className="text-2xl font-semibold tracking-tight"
                    >
                        Welcome back
                    </h1>

                    <p className="mt-1 text-sm text-muted-foreground">
                        Sign in with your workspace account.
                    </p>
                </div>

                <form
                    action={formAction}
                    onSubmit={handleSubmit}
                    aria-busy={pending}
                    className="mt-5 space-y-4"
                >
                    <div>
                        <label
                            htmlFor="email"
                            className="mb-1.5 block text-sm font-medium"
                        >
                            Email address
                        </label>

                        <input
                            id="email"
                            name="email"
                            type="email"
                            inputMode="email"
                            autoComplete="username"
                            autoCapitalize="none"
                            spellCheck={false}
                            required
                            maxLength={254}
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            readOnly={pending}
                            placeholder="you@company.com"
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="mb-1.5 block text-sm font-medium"
                        >
                            Password
                        </label>

                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                required
                                maxLength={1024}
                                readOnly={pending}
                                placeholder="Enter your password"
                                className={`${inputClass} pr-12`}
                            />

                            <button
                                type="button"
                                onClick={() =>
                                    setShowPassword((current) => !current)
                                }
                                aria-label={
                                    showPassword
                                        ? "Hide password"
                                        : "Show password"
                                }
                                aria-controls="password"
                                className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {showPassword ? (
                                    <EyeOff
                                        aria-hidden="true"
                                        className="size-[18px]"
                                    />
                                ) : (
                                    <Eye
                                        aria-hidden="true"
                                        className="size-[18px]"
                                    />
                                )}
                            </button>
                        </div>
                    </div>

                    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
                        <input
                            type="checkbox"
                            checked={rememberEmail}
                            disabled={pending}
                            onChange={(event) =>
                                handleRememberChange(event.target.checked)
                            }
                            className="size-4 shrink-0 accent-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        Remember email on this device
                    </label>

                    {state.error && (
                        <p
                            role="alert"
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                        >
                            {state.error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={pending}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-wait disabled:opacity-60"
                    >
                        {pending ? (
                            <>
                                <Loader2
                                    aria-hidden="true"
                                    className="size-4 animate-spin motion-reduce:animate-none"
                                />
                                Signing in…
                            </>
                        ) : (
                            <>
                                Sign in
                                <ArrowRight
                                    aria-hidden="true"
                                    className="size-4"
                                />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-4 border-t border-border pt-3">
                    <Link
                        href="/"
                        className="flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <ArrowLeft
                            aria-hidden="true"
                            className="size-4"
                        />
                        Back to invoice overview
                    </Link>

                    <p className="mt-1 text-center text-xs leading-5 text-muted-foreground">
                        Need help? Contact your administrator.
                    </p>
                </div>
            </section>
        </main>
    );
}