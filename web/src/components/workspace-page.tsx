import type { ReactNode } from "react";

type Props = {
    title: string;
    description: string;
    children: ReactNode;
};

export default function WorkspacePage({
    title,
    description,
    children,
}: Props) {
    return (
        <main className="min-w-0 bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl space-y-6">
                <header className="dock-rise flex items-start gap-3.5 border-b border-border pb-6">
                    <span
                        aria-hidden="true"
                        className="mt-1 h-8 w-1 shrink-0 rounded-full bg-signal"
                    />

                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                            {title}
                        </h1>

                        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                            {description}
                        </p>
                    </div>
                </header>

                {children}
            </div>
        </main>
    );
}
