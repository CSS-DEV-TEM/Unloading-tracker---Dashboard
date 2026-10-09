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
        <main className="min-w-0 bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl space-y-5">
                <header className="border-b border-border pb-5">
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                        {title}
                    </h1>

                    <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {description}
                    </p>
                </header>

                {children}
            </div>
        </main>
    );
}