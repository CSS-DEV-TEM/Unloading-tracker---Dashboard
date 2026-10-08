import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import AdminSidebar from "./admin-sidebar";
import InvoiceSuccessNotice from "@/components/invoice-success-notice";

async function DashboardShell({
    children,
}: {
    children: ReactNode;
}) {
    await connection();

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return <>{children}</>;
    }

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, is_active, full_name")
        .eq("id", user.id)
        .maybeSingle();

    if (error) {
        throw new Error("Unable to load dashboard permissions.");
    }

    if (!profile || profile.is_active !== true) {
        return <>{children}</>;
    }

    return (
        <AdminSidebar
            isAdmin={profile.role === "ADMIN"}
            fullName={profile.full_name ?? ""}
        >
            {children}
        </AdminSidebar>
    );
}

export default function DashboardLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <Suspense
            fallback={
                <div
                    role="status"
                    className="flex min-h-screen items-center justify-center
            bg-background px-6 text-sm text-muted-foreground"
                >
                    Loading workspace…
                </div>
            }
        >
            <DashboardShell>
                <Suspense fallback={null}>
                    <InvoiceSuccessNotice />
                </Suspense>

                {children}
            </DashboardShell>
        </Suspense>
    );
}