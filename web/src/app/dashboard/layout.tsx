import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import AdminSidebar from "./admin-sidebar";

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
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (error) {
        throw new Error("Unable to load dashboard permissions.");
    }

    if (!profile || profile.is_active !== true) {
        return <>{children}</>;
    }

    return (
        <AdminSidebar isAdmin={profile.role === "ADMIN"}>
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
            <DashboardShell>{children}</DashboardShell>
        </Suspense>
    );
}