"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type VehicleRow = {
    id: string;
    vehicle_number: string;
    version: number;
    is_archived: boolean;
    received_date: string | null;
};
export type InvoiceChoice = { id: string; invoice_number: string; supplier: string; vehicle_number: string | null; vehicle_id: string | null; version: number; status: string };
export type Result = { error: string; success?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function access(admin = false) {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) throw new Error("Sign in again to continue.");
    const { data, error } = await db.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
    if (error || !data?.is_active || !(admin ? ["ADMIN"] : ["ADMIN", "USER"]).includes(data.role)) {
        throw new Error("Active dashboard access is required.");
    }
    return db;
}

function message(error: { code?: string }) {
    if (error.code === "PVC01") return "A selected invoice is completed or ASN shared. Reopen it as Pending and reload before changing its vehicle.";
    if (error.code === "40001" || error.code === "40P01") return "A record changed while saving. Reload, review your selection and try again.";
    if (error.code === "PVA01") return "This vehicle is archived. Ask an administrator to restore it before assigning invoices.";
    if (error.code === "23503") {
        return "This vehicle has invoices or arrival history. Archive it to preserve those records.";
    }
    if (error.code === "23505") return "That vehicle already exists. Assign invoices to the existing vehicle instead.";
    if (error.code === "42501") return "Your account does not have permission for this action.";
    if (error.code === "P0002") return "A selected record no longer exists. Reload and try again.";
    if (error.code === "22023" || error.code === "23514") return "Check the vehicle number and selected invoices.";
    return "Unable to save. Please try again.";
}
function refresh() {
    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/vehicles");
    revalidatePath("/dashboard/activity");
    revalidatePath("/dashboard/invoices/[id]", "page");
    revalidatePath("/dashboard/invoices/[id]/details", "page");
}
function pattern(value: string) {
    return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

export async function vehicleSuggestions(search: string): Promise<{ items: VehicleRow[]; error: string }> {
    try {
        const db = await access();
        const key = search.slice(0, 100).replace(/[\s-]+/g, "").toUpperCase();
        let query = db.from("vehicles").select("id,vehicle_number,version,is_archived,received_date").eq("is_archived", false).order("vehicle_number").limit(20);
        if (key) query = query.ilike("number_key", pattern(key));
        const { data, error } = await query;
        if (error) return { items: [], error: "Unable to load vehicle suggestions." };
        return { items: data ?? [], error: "" };
    } catch { return { items: [], error: "Sign in to load vehicle suggestions." }; }
}

export async function searchAssignable(search: string, page: number): Promise<{ items: InvoiceChoice[]; more: boolean; error: string }> {
    try {
        const db = await access();
        if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return { items: [], more: false, error: "Invalid page." };
        const q = search.trim().slice(0, 100);
        let query = db.from("invoices").select("id,invoice_number,supplier,vehicle_number,vehicle_id,version,status")
            .order("created_at", { ascending: false }).order("id");
        if (q) {
            const filter = JSON.stringify(pattern(q));
            query = query.or(`invoice_number.ilike.${filter},supplier.ilike.${filter},vehicle_number.ilike.${filter}`);
        }
        const { data, error } = await query.range((page - 1) * 20, page * 20);
        if (error) return { items: [], more: false, error: "Unable to load invoices." };
        return { items: (data ?? []).slice(0, 20), more: (data?.length ?? 0) > 20, error: "" };
    } catch { return { items: [], more: false, error: "Sign in to load invoices." }; }
}

export async function saveVehicle(id: string | null, version: number | null, number: string): Promise<Result & { id?: string }> {
    const value = number.trim();
    if (!value || value.length > 30 || !value.replace(/[\s-]/g, "")) return { error: "Enter a vehicle number of up to 30 characters." };
    if (id && (!uuid.test(id) || !Number.isSafeInteger(version) || (version ?? 0) < 1)) return { error: "Invalid vehicle. Reload first." };
    try {
        const db = await access(Boolean(id));
        const result = id
            ? await db.rpc("rename_vehicle", { p_vehicle_id: id, p_expected_version: version, p_number: value })
            : await db.rpc("add_vehicle", { p_number: value });
        if (result.error) return { error: message(result.error) };
        refresh();
        return { error: "", success: id ? "Vehicle updated." : "Vehicle ready. Existing numbers are reused.", id: id ?? result.data };
    } catch { return { error: "Unable to save. Check your session and try again." }; }
}

export async function assignInvoices(vehicleId: string | null, items: { id: string; version: number }[]): Promise<Result> {
    if ((vehicleId !== null && !uuid.test(vehicleId)) || !Array.isArray(items) || !items.length || items.length > 50 ||
        items.some(item => !uuid.test(item.id) || !Number.isSafeInteger(item.version) || item.version < 1)) return { error: "Select 1 to 50 valid invoices." };
    try {
        const db = await access();
        const { error, data } = await db.rpc("assign_vehicle_invoices", { p_vehicle_id: vehicleId, p_items: items });
        if (error) return { error: message(error) };
        refresh();
        return { error: "", success: `${data ?? 0} invoice assignment(s) updated.` };
    } catch { return { error: "Unable to save. Check your session and try again." }; }
}

export async function changeVehicleState(
    id: string, version: number, action: "archive" | "restore" | "delete", confirmation = "",
): Promise<Result> {
    if (!uuid.test(id) || !Number.isSafeInteger(version) || version < 1 ||
        !["archive", "restore", "delete"].includes(action)) return { error: "Invalid vehicle action. Reload first." };
    try {
        const db = await access(true);
        const { error } = action === "delete"
            ? await db.rpc("delete_vehicle", { p_vehicle_id: id, p_expected_version: version, p_confirmation: confirmation })
            : await db.rpc("set_vehicle_archived", { p_vehicle_id: id, p_expected_version: version, p_archived: action === "archive" });
        if (error) return { error: message(error) };
        refresh();
        return { error: "", success: `Vehicle ${action === "delete" ? "deleted" : action === "archive" ? "archived" : "restored"}.` };
    } catch { return { error: "Unable to save. Check your session and try again." }; }
}

export async function saveVehicleArrival(
    number: string,
    receivedDate: string,
): Promise<Result> {
    const value = number.trim();

    if (
        !value ||
        value.length > 30 ||
        !value.replace(/[\s-]/g, "")
    ) {
        return {
            error: "Enter a vehicle number of up to 30 characters.",
        };
    }

    const parsedDate = new Date(`${receivedDate}T00:00:00Z`);

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(receivedDate) ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== receivedDate
    ) {
        return {
            error: "Select a valid vehicle received date.",
        };
    }

    try {
        const db = await access();

        const { error } = await db.rpc("add_vehicle_with_received_date", {
            p_number: value,
            p_received_date: receivedDate,
        });
        if (error?.code === "PVC01") {
            return {
                error:
                    "This vehicle has completed or ASN shared invoices. Leave the received date blank to keep its current date, or reopen the linked invoices before changing it.",
            };
        }

        if (error) {
            return { error: message(error) };
        }

        refresh();

        return {
            error: "",
            success: "Vehicle received date saved.",
        };
    } catch {
        return {
            error: "Unable to save. Check your session and try again.",
        };
    }
}

export type ArrivalRow = {
    id: string;
    received_date: string;
    version: number;
};

export async function getVehicleArrivals(
    vehicleId: string,
    page = 1,
): Promise<{
    items: ArrivalRow[];
    more: boolean;
    error: string;
}> {
    if (
        !uuid.test(vehicleId) ||
        !Number.isSafeInteger(page) ||
        page < 1 ||
        page > 100000
    ) {
        return { items: [], more: false, error: "Invalid selection." };
    }

    try {
        const db = await access();

        const { data, error } = await db
            .from("vehicle_arrivals")
            .select("id,received_date,version")
            .eq("vehicle_id", vehicleId)
            .order("received_date", { ascending: false })
            .order("id")
            .range((page - 1) * 20, page * 20);

        if (error) {
            return {
                items: [],
                more: false,
                error: "Unable to load arrivals.",
            };
        }

        return {
            items: (data ?? []).slice(0, 20),
            more: (data?.length ?? 0) > 20,
            error: "",
        };
    } catch {
        return {
            items: [],
            more: false,
            error: "Unable to load arrivals. Check your session.",
        };
    }
}

export async function saveArrivalDate(
    arrivalId: string,
    version: number,
    date: string,
): Promise<Result & { version?: number }> {
    if (
        !uuid.test(arrivalId) ||
        !Number.isSafeInteger(version) ||
        version < 1
    ) {
        return { error: "Reload the arrival before saving." };
    }

    const parsed = new Date(`${date}T00:00:00Z`);

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date
    ) {
        return { error: "Select a valid received date." };
    }

    try {
        const db = await access(true);
        const { data: nextVersion, error } = await db.rpc(
            "update_vehicle_arrival_date",
            {
                p_arrival_id: arrivalId,
                p_expected_version: version,
                p_received_date: date,
            },
        );

        if (error?.code === "PVC01") {
            return {
                error: "This arrival has completed or ASN shared invoices. Reopen them as Pending before changing its date.",
            };
        }

        if (error) return { error: message(error) };

        refresh();

        return {
            error: "",
            success: "Received date updated.",
            version: nextVersion,
        };
    } catch {
        return { error: "Unable to save. Check your session." };
    }
}

export async function updateVehicleDetails(
    vehicleId: string,
    version: number,
    number: string,
    receivedDate: string,
): Promise<Result> {
    const value = number.trim();
    const date = receivedDate.trim();

    if (
        !uuid.test(vehicleId) ||
        !Number.isSafeInteger(version) ||
        version < 1
    ) {
        return {
            error: "Close and reopen the vehicle before saving.",
        };
    }

    if (
        !value ||
        value.length > 30 ||
        !value.replace(/[\s-]/g, "")
    ) {
        return {
            error: "Enter a vehicle number of up to 30 characters.",
        };
    }

    if (date) {
        const parsed = new Date(`${date}T00:00:00Z`);

        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            Number.isNaN(parsed.getTime()) ||
            parsed.toISOString().slice(0, 10) !== date
        ) {
            return {
                error: "Select a valid received date.",
            };
        }
    }

    try {
        const db = await access(true);

        const { error } = await db.rpc(
            "update_vehicle_details",
            {
                p_vehicle_id: vehicleId,
                p_expected_version: version,
                p_number: value,
                p_received_date: date || null,
            },
        );

        if (error?.code === "PVC01") {
            return {
                error:
                    "This vehicle has completed or ASN shared invoices. Reopen them as Pending before changing its received date.",
            };
        }

        if (error) {
            return { error: message(error) };
        }

        refresh();

        return {
            error: "",
            success: "Vehicle details updated.",
        };
    } catch {
        return {
            error: "Unable to save. Check your session and try again.",
        };
    }
}