import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";



const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json(
            { error: "Your session has expired. Sign in again." },
            { status: 401 },
        );
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (
        profileError ||
        !profile?.is_active ||
        !["ADMIN", "USER"].includes(profile.role)
    ) {
        return NextResponse.json(
            { error: "Your account does not have invoice import access." },
            { status: 403 },
        );
    }

    const apiUrl = process.env.INVOICE_IMPORT_API_URL;
    const apiKey = process.env.INVOICE_IMPORT_API_KEY;

    if (!apiUrl || !apiKey) {
        return NextResponse.json(
            { error: "Invoice import service is not configured." },
            { status: 503 },
        );
    }

    let form: FormData;

    try {
        form = await request.formData();
    } catch {
        return NextResponse.json(
            { error: "Unable to read the upload. Select the PDF again." },
            { status: 400 },
        );
    }

    const file = form.get("file");
    const dateFormat = form.get("date_format");

    if (
        !(file instanceof File) ||
        !file.name.toLowerCase().endsWith(".pdf") ||
        file.size === 0
    ) {
        return NextResponse.json(
            { error: "Select a non-empty PDF file." },
            { status: 400 },
        );
    }

    if (file.size > MAX_BYTES) {
        return NextResponse.json(
            { error: "PDF must be 4 MB or smaller." },
            { status: 413 },
        );
    }

    if (dateFormat !== "mdy" && dateFormat !== "dmy") {
        return NextResponse.json(
            { error: "Select the date format used in the PDF." },
            { status: 400 },
        );
    }

    const upload = new FormData();
    upload.set("file", file);
    upload.set("date_format", dateFormat);

    try {
        const response = await fetch(
            `${apiUrl.replace(/\/+$/, "")}/extract`,
            {
                method: "POST",
                headers: {
                    "X-API-Key": apiKey,
                },
                body: upload,
                cache: "no-store",
                signal: AbortSignal.timeout(60_000),
            },
        );

        const result = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                {
                    error:
                        typeof result.detail === "string"
                            ? result.detail
                            : "The PDF could not be extracted.",
                },
                { status: response.status >= 500 ? 502 : response.status },
            );
        }

        if (!Array.isArray(result.invoices)) {
            return NextResponse.json(
                { error: "The extraction service returned an invalid response." },
                { status: 502 },
            );
        }

        return NextResponse.json(result, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch {
        return NextResponse.json(
            {
                error:
                    "Unable to reach the PDF service, or extraction timed out. " +
                    "Check that the Python service is running and try again.",
            },
            { status: 502 },
        );
    }
}