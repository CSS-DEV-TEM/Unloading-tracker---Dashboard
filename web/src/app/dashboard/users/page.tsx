
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccessControl from "./access-control";
import CreateUserForm from "./create-user-form";
import WorkspacePage from "@/components/workspace-page";

type Props = {
    searchParams: Promise<{
        page?: string | string[];
    }>;
};

const PAGE_SIZE = 25;

async function UsersContent({ searchParams }: Props) {
    await connection();

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        throw new Error("Unable to verify administrator access.");
    }

    if (!profile?.is_active || profile.role !== "ADMIN") {
        redirect("/dashboard");
    }

    const params = await searchParams;
    const rawPage = Array.isArray(params.page)
        ? params.page[0]
        : params.page;

    const requestedPage = Number(rawPage ?? "1");

    const page =
        Number.isSafeInteger(requestedPage) &&
            requestedPage >= 1 &&
            requestedPage <= 100000
            ? requestedPage
            : 1;

    const from = (page - 1) * PAGE_SIZE;

    const { data: users, error, count } = await supabase
        .from("profiles")
        .select("id, full_name, role, is_active, created_at", {
            count: "exact",
        })
        .order("full_name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

    if (error) {
        throw new Error("Unable to load user accounts.");
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (page > totalPages) {
        redirect(`/dashboard/users?page=${totalPages}`);
    }

    return (
        <WorkspacePage
            title="User management"
            description="Manage workspace accounts and access."
        >

            <CreateUserForm />

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-5 py-4">
                    <h2 className="font-semibold text-foreground">
                        Dashboard users
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                        {total} accounts
                    </p>
                </div>

                <div
                    role="region"
                    aria-label="Dashboard user accounts"
                    tabIndex={0}
                    className="max-h-[65vh] overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-muted text-xs font-medium text-muted-foreground">
                            <tr>
                                <th scope="col" className="px-5 py-4">
                                    User
                                </th>
                                <th scope="col" className="px-5 py-4">
                                    Role
                                </th>
                                <th scope="col" className="px-5 py-4">
                                    Access
                                </th>
                                <th scope="col" className="px-5 py-4">
                                    Created
                                </th>
                                <th scope="col" className="px-5 py-4">
                                    Action
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-border">
                            {(users ?? []).map((account) => (
                                <tr
                                    key={account.id}
                                    className="transition-colors hover:bg-muted/40 motion-reduce:transition-none"
                                >
                                    <td className="px-5 py-4 font-medium text-foreground">
                                        {account.full_name}
                                    </td>

                                    <td className="px-5 py-4 text-muted-foreground">
                                        {account.role === "ADMIN"
                                            ? "Administrator"
                                            : "User"}
                                    </td>

                                    <td className="px-5 py-4">
                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${account.is_active
                                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                                                    : "bg-muted text-muted-foreground"
                                                }`}
                                        >
                                            <span
                                                aria-hidden="true"
                                                className={`size-1.5 rounded-full ${account.is_active
                                                        ? "bg-emerald-600 dark:bg-emerald-400"
                                                        : "bg-muted-foreground"
                                                    }`}
                                            />
                                            {account.is_active ? "Active" : "Inactive"}
                                        </span>
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                                        {new Intl.DateTimeFormat("en-GB", {
                                            timeZone: "Asia/Colombo",
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                        }).format(new Date(account.created_at))}
                                    </td>

                                    <td className="px-5 py-4">
                                        <AccessControl
                                            userId={account.id}
                                            fullName={account.full_name}
                                            isActive={account.is_active}
                                            isCurrentUser={account.id === user.id}
                                        />
                                    </td>
                                </tr>
                            ))}

                            {users?.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-5 py-12 text-center text-muted-foreground"
                                    >
                                        No user profiles found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <footer className="mt-6 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                </p>

                <div className="flex gap-3">
                    {page > 1 && (
                        <Link
                            href={`/dashboard/users?page=${page - 1}`}
                            className="rounded-lg border border-input bg-card px-4 py-2 text-sm"
                        >
                            Previous
                        </Link>
                    )}

                    {page < totalPages && (
                        <Link
                            href={`/dashboard/users?page=${page + 1}`}
                            className="rounded-lg border border-input bg-card px-4 py-2 text-sm"
                        >
                            Next
                        </Link>
                    )}
                </div>
            </footer>
        </WorkspacePage>
    );
}

export default function UsersPage(props: Props) {
    return (
        <Suspense
            fallback={
                <div className="p-8 text-sm text-muted-foreground">
                    Loading user accounts...
                </div>
            }
        >
            <UsersContent {...props} />
        </Suspense>
    );
}