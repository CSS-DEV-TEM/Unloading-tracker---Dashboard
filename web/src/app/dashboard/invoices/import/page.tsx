import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ImportForm from "./import-form";

async function ImportContent() {
    await connection();

    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect("/login");
    }

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (
        error ||
        !profile?.is_active ||
        !["ADMIN", "USER"].includes(profile.role)
    ) {
        redirect("/dashboard");
    }

    return (
        <main className="bg-background px-4 py-4 text-foreground sm:px-6">
            <div className="mx-auto max-w-[1600px]">
                <ImportForm />
            </div>
        </main>
    );
}

export default function ImportPage() {
    return (
        <Suspense fallback={<p className="p-10">Loading import form…</p>}>
            <ImportContent />
        </Suspense>
    );
}