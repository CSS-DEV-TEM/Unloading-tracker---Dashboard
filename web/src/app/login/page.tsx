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
    FileCheck2,
    Loader2,
    PackageCheck,
    Truck,
} from "lucide-react";

import ThemeToggle from "@/components/theme-toggle";
import { signIn } from "./actions";

const EMAIL_STORAGE_KEY = "efl-unloading-remembered-email";

const inputClass =
    "h-11 w-full rounded-md border border-input bg-card " +
    "px-3 text-base text-foreground outline-none shadow-xs " +
    "placeholder:text-muted-foreground " +
    "focus:border-ring focus:ring-3 focus:ring-ring/25 " +
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

    const facts = [
        { icon: Truck, text: "Vehicle arrivals and unloading status" },
        { icon: FileCheck2, text: "AX and D365 processing for every invoice" },
        { icon: PackageCheck, text: "ASN updates, from dock to GRN" },
    ];

    return (
        <main className="grid min-h-dvh bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <aside
                aria-hidden="true"
                className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex"
            >
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.07]"
                    style={{
                        backgroundImage:
                            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
                        backgroundSize: "44px 44px",
                    }}
                />

                <div className="relative flex items-center gap-3">
                    <Image
                        src="/efl-logo.png"
                        alt=""
                        width={44}
                        height={44}
                        priority
                        unoptimized
                        className="size-11 shrink-0 rounded-lg bg-white object-contain p-1.5"
                    />
                    <div>
                        <p className="font-heading text-lg font-semibold leading-tight text-white">
                            Unloading Tracker
                        </p>
                        <p className="text-xs text-sidebar-foreground/70">
                            EFL 3PL · CSS Division
                        </p>
                    </div>
                </div>

                <div className="relative max-w-md">
                    <h2 className="font-heading text-5xl font-semibold leading-[1.05] tracking-tight text-white">
                        Follow every invoice through unloading, all in one view.
                    </h2>

                    <ul className="mt-9 space-y-4">
                        {facts.map(({ icon: Icon, text }) => (
                            <li key={text} className="flex items-center gap-3 text-sm">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-primary">
                                    <Icon className="size-[18px]" />
                                </span>
                                {text}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="dock-stripe relative -mx-12 -mb-12 h-3" />
            </aside>

            <div className="flex min-h-dvh flex-col px-4 py-4 sm:px-8">
                <div className="flex items-center justify-between gap-3 lg:justify-end">
                    <div className="flex min-w-0 items-center gap-3 lg:hidden">
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
                            <p className="font-heading text-base font-semibold leading-tight">
                                Unloading Tracker
                            </p>
                            <p className="text-xs text-muted-foreground">
                                EFL 3PL · CSS Division
                            </p>
                        </div>
                    </div>

                    <ThemeToggle />
                </div>

                <section
                    aria-labelledby="login-heading"
                    className="dock-rise mx-auto my-auto w-full max-w-[400px] py-10"
                >
                    <h1
                        id="login-heading"
                        className="text-3xl font-semibold tracking-tight"
                    >
                        Sign in
                    </h1>

                    <p className="mt-1.5 text-sm text-muted-foreground">
                        Use your workspace account to continue.
                    </p>

                    <form
                        action={formAction}
                        onSubmit={handleSubmit}
                        aria-busy={pending}
                        className="mt-7 space-y-5"
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
                                    className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                                className="size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            Remember my email on this device
                        </label>

                        {state.error && (
                            <p
                                role="alert"
                                className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                            >
                                {state.error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={pending}
                            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-60"
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

                    <div className="mt-6 border-t border-border pt-3">
                        <Link
                            href="/"
                            className="flex min-h-11 items-center justify-center gap-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <ArrowLeft aria-hidden="true" className="size-4" />
                            Back to invoice overview
                        </Link>

                        <p className="mt-1 text-center text-xs leading-5 text-muted-foreground">
                            Need access? Ask your administrator.
                        </p>
                    </div>
                </section>
            </div>
        </main>
    );
}