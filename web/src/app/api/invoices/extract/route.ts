import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "invoice-imports";
const MAX_BYTES = 10 * 1024 * 1024;

function reply(body: unknown, status = 200) {
    return NextResponse.json(body, {
        status,
        headers: { "Cache-Control": "no-store" },
    });
}

export async function POST(request: Request) {
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return reply(
            { error: "Your session has expired. Sign in again." },
            401,
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
        return reply(
            { error: "Your account does not have invoice import access." },
            403,
        );
    }

    let body: Record<string, unknown>;

    try {
        const parsed: unknown = await request.json();

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return reply({ error: "Invalid request." }, 400);
        }

        body = parsed as Record<string, unknown>;
    } catch {
        return reply({ error: "Unable to read the request." }, 400);
    }

    const action = body.action;

    if (!["upload", "extract", "cleanup"].includes(String(action))) {
        return reply({ error: "Invalid import action." }, 400);
    }

    const apiUrl = process.env.INVOICE_IMPORT_API_URL;
    const apiKey = process.env.INVOICE_IMPORT_API_KEY;

    if (action !== "cleanup" && (!apiUrl || !apiKey)) {
        return reply(
            { error: "Invoice import service is not configured." },
            503,
        );
    }

    try {
        const admin = createAdminClient();
        const storage = admin.storage.from(BUCKET);

        if (action === "upload") {
            const filename = body.filename;
            const size = body.size;

            if (
                typeof filename !== "string" ||
                filename.length > 255 ||
                !filename.toLowerCase().endsWith(".pdf") ||
                typeof size !== "number" ||
                !Number.isSafeInteger(size) ||
                size <= 0
            ) {
                return reply(
                    { error: "Select a non-empty PDF file." },
                    400,
                );
            }

            if (size > MAX_BYTES) {
                return reply(
                    { error: "PDF must be 10 MB or smaller." },
                    413,
                );
            }

            // User-scoped, unpredictable path; never use the supplied filename.
            const path = `${user.id}/${crypto.randomUUID()}.pdf`;

            const { data, error } =
                await storage.createSignedUploadUrl(path);

            if (error || !data) {
                return reply(
                    { error: "Unable to prepare PDF storage." },
                    502,
                );
            }

            return reply({
                path,
                token: data.token,
            });
        }

        const path = body.path;

        if (typeof path !== "string") {
            return reply({ error: "Invalid PDF path." }, 400);
        }

        const segments = path.split("/");

        if (
            segments.length !== 2 ||
            segments[0] !== user.id ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i.test(
                segments[1],
            )
        ) {
            return reply({ error: "Invalid PDF path." }, 400);
        }

        if (action === "cleanup") {
            const { error } = await storage.remove([path]);

            return error
                ? reply({ error: "Temporary PDF cleanup failed." }, 502)
                : reply({ ok: true });
        }

        const filename = body.filename;
        const dateFormat = body.date_format;

        if (
            typeof filename !== "string" ||
            filename.length > 255 ||
            !filename.toLowerCase().endsWith(".pdf") ||
            (dateFormat !== "mdy" && dateFormat !== "dmy")
        ) {
            return reply({ error: "Invalid extraction details." }, 400);
        }

        try {
            const { data, error } =
                await storage.createSignedUrl(path, 120);

            if (error || !data) {
                return reply(
                    { error: "Uploaded PDF is unavailable. Retry extraction." },
                    422,
                );
            }

            const response = await fetch(
                `${apiUrl!.replace(/\/+$/, "")}/extract-stored`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-API-Key": apiKey!,
                    },
                    body: JSON.stringify({
                        download_url: data.signedUrl,
                        filename,
                        date_format: dateFormat,
                    }),
                    cache: "no-store",
                    signal: AbortSignal.timeout(60_000),
                },
            );

            const result = await response.json();

            if (!response.ok) {
                return reply(
                    {
                        error:
                            typeof result.detail === "string"
                                ? result.detail
                                : "The PDF could not be extracted.",
                    },
                    response.status >= 500 ? 502 : response.status,
                );
            }

            if (!Array.isArray(result.invoices)) {
                return reply(
                    { error: "Invalid extraction service response." },
                    502,
                );
            }

            return reply(result);
        } finally {
            try {
                const { error } = await storage.remove([path]);

                if (error) {
                    console.error("Temporary invoice PDF cleanup failed.");
                }
            } catch {
                console.error("Temporary invoice PDF cleanup failed.");
            }
        }
    } catch {
        return reply(
            {
                error:
                    "Unable to complete PDF extraction. " +
                    "Check the import service configuration and retry.",
            },
            502,
        );
    }
}