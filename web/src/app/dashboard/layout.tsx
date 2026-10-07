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

    const isAdmin =
        profile?.is_active === true && profile.role === "ADMIN";

    if (!isAdmin) {
        return <>{children}</>;
    }

    return <AdminSidebar>{children}</AdminSidebar>;
}

export default function DashboardLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-slate-50 p-8 text-sm text-slate-500">
                    Loading workspace...
                </div>
            }
        >
            <DashboardShell>{children}</DashboardShell>
        </Suspense>
    );
}