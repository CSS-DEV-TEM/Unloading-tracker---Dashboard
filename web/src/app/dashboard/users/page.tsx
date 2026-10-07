import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccessControl from "./access-control";
import CreateUserForm from "./create-user-form";

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
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
            <div className="mx-auto max-w-6xl">
                <header className="mb-7">
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                        Administrator
                    </p>

                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                        User Management
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        Manage dashboard access while preserving invoice and
                        activity history.
                    </p>
                </header>

                <CreateUserForm />

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <h2 className="font-semibold text-slate-800">
                            Dashboard users
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            {total} accounts
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
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

                            <tbody className="divide-y divide-slate-100">
                                {(users ?? []).map((account) => (
                                    <tr key={account.id}>
                                        <td className="px-5 py-4 font-medium text-slate-900">
                                            {account.full_name}
                                        </td>

                                        <td className="px-5 py-4 text-slate-600">
                                            {account.role === "ADMIN"
                                                ? "Administrator"
                                                : "User"}
                                        </td>

                                        <td className="px-5 py-4">
                                            <span
                                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${account.is_active
                                                    ? "bg-blue-50 text-blue-700"
                                                    : "bg-slate-100 text-slate-500"
                                                    }`}
                                            >
                                                {account.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4 text-slate-500">
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
                                            className="px-5 py-12 text-center text-slate-500"
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
                    <p className="text-sm text-slate-500">
                        Page {page} of {totalPages}
                    </p>

                    <div className="flex gap-3">
                        {page > 1 && (
                            <Link
                                href={`/dashboard/users?page=${page - 1}`}
                                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
                            >
                                Previous
                            </Link>
                        )}

                        {page < totalPages && (
                            <Link
                                href={`/dashboard/users?page=${page + 1}`}
                                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
                            >
                                Next
                            </Link>
                        )}
                    </div>
                </footer>
            </div>
        </main>
    );
}

export default function UsersPage(props: Props) {
    return (
        <Suspense
            fallback={
                <div className="p-8 text-sm text-slate-500">
                    Loading user accounts...
                </div>
            }
        >
            <UsersContent {...props} />
        </Suspense>
    );
}