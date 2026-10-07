import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";



type Stage = {
    system_name: "AX" | "D365";
    started_at: string | null;
    ended_at: string | null;
    is_done: boolean;
    assigned_user_name: string | null;
};

type ExportRecord = {
    invoice: {
        invoice_number: string;
        supplier: string;
        roll_quantity: number | null;
        system_type: "AX" | "D365" | "AX/D365";
        document_share_date: string;
        shipment_type: string;
        pending_reason: string | null;
        remark: string | null;
        status: string;
    };
    stages: Stage[];
    asn: {
        share_date: string | null;
        is_shared: boolean;
        assigned_user_name: string | null;
    } | null;
};

function failure(message: string, status: number) {
    return Response.json(
        { error: message },
        {
            status,
            headers: {
                "Cache-Control": "private, no-store",
            },
        },
    );
}

function excelDate(value: string | null) {
    if (!value) return null;

    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
        throw new Error("Invalid date in export data.");
    }

    return date;
}

function excelDateTime(value: string | null) {
    if (!value) return null;

    const timestamp = new Date(value).getTime();

    if (!Number.isFinite(timestamp)) {
        throw new Error("Invalid timestamp in export data.");
    }

    // Excel dates have no timezone.
    // Store Sri Lanka wall-clock time in the exported cell.
    return new Date(timestamp + 330 * 60 * 1000);
}

export async function POST(request: Request) {
    const origin = request.headers.get("origin");

    if (!origin || origin !== new URL(request.url).origin) {
        return failure("Invalid export request origin.", 403);
    }

    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return failure("Please sign in before exporting.", 401);
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        return failure("Unable to verify export permissions.", 503);
    }

    if (!profile?.is_active || profile.role !== "ADMIN") {
        return failure("Only active administrators can export invoices.", 403);
    }

    const { data, error } = await supabase.rpc(
        "prepare_invoice_export",
    );

    if (error) {
        if (error.code === "42501") {
            return failure("Administrator access is required.", 403);
        }

        if (error.code === "54000") {
            return failure(
                "This export exceeds 10,000 invoices. A date-range export is required.",
                413,
            );
        }

        return failure("Unable to prepare invoice data.", 500);
    }

    if (!Array.isArray(data)) {
        return failure("The export data could not be read.", 500);
    }

    const records = data as ExportRecord[];

    try {
        const workbook = new ExcelJS.Workbook();

        workbook.creator = "EFL · 3PL — CSS Division";
        workbook.created = new Date();
        workbook.subject = "Unloading tracker — all invoices";
        workbook.description =
            "AX/D365 start and end times are displayed in Sri Lanka time (UTC+05:30).";

        const sheet = workbook.addWorksheet("Unloading Tracker");

        sheet.views = [
            {
                state: "frozen",
                xSplit: 2,
                ySplit: 1,
            },
        ];

        sheet.columns = [
            { header: "Invoice", key: "invoice", width: 24 },
            { header: "SUPPLIER", key: "supplier", width: 32 },
            { header: "ROLL QTY", key: "roll", width: 14 },
            { header: "System", key: "system", width: 16 },
            {
                header: "DOCUMENT SHARE DATE",
                key: "documentDate",
                width: 23,
            },
            { header: "LOCAL/IMPORT", key: "shipment", width: 18 },
            {
                header: "D365 Pre GRN Start Date",
                key: "d365Start",
                width: 25,
            },
            {
                header: "D365 Pre GRN End Date",
                key: "d365End",
                width: 25,
            },
            { header: "D365 Status", key: "d365Status", width: 18 },
            {
                header: "D365 Pre GRN User",
                key: "d365User",
                width: 25,
            },
            {
                header: "AX Pre GRN Start Date",
                key: "axStart",
                width: 25,
            },
            {
                header: "AX Pre GRN End Date",
                key: "axEnd",
                width: 25,
            },
            { header: "AX Pre GRN Status", key: "axStatus", width: 21 },
            { header: "AX Pre GRN User", key: "axUser", width: 25 },
            { header: "Pending Reason", key: "pendingReason", width: 40 },
            { header: "ASN Share Date", key: "asnDate", width: 21 },
            { header: "ASN Update", key: "asnUpdate", width: 18 },
            { header: "ASN USER", key: "asnUser", width: 25 },
            { header: "REMARK", key: "remark", width: 45 },
            { header: "status", key: "status", width: 18 },
        ];

        sheet.getColumn("invoice").numFmt = "@";
        sheet.getColumn("roll").numFmt = "0";

        for (const key of ["documentDate", "asnDate"]) {
            sheet.getColumn(key).numFmt = "dd/mm/yyyy";
        }

        for (const key of [
            "d365Start",
            "d365End",
            "axStart",
            "axEnd",
        ]) {
            sheet.getColumn(key).numFmt = "dd/mm/yyyy hh:mm:ss";
        }

        for (const record of records) {
            const invoice = record.invoice;
            const ax = record.stages.find(
                (stage) => stage.system_name === "AX",
            );
            const d365 = record.stages.find(
                (stage) => stage.system_name === "D365",
            );

            const needsAx = invoice.system_type !== "D365";
            const needsD365 = invoice.system_type !== "AX";
            const expectedStageCount = invoice.system_type === "AX/D365" ? 2 : 1;

            if (
                !record.asn ||
                record.stages.length !== expectedStageCount ||
                (needsAx && !ax) ||
                (needsD365 && !d365)
            ) {
                return failure(
                    "An invoice has incomplete process records. Repair it before exporting.",
                    409,
                );
            }

            // Strings stay strings, including invoice numbers with leading zeros.
            // User-entered values are never assigned as Excel formulas.
            sheet.addRow({
                invoice: invoice.invoice_number,
                supplier: invoice.supplier,
                roll: invoice.roll_quantity,
                system: invoice.system_type,
                documentDate: excelDate(invoice.document_share_date),
                shipment: invoice.shipment_type,

                d365Start: excelDateTime(d365?.started_at ?? null),
                d365End: excelDateTime(d365?.ended_at ?? null),
                d365Status: d365?.is_done ? "DONE" : "",
                d365User: d365?.assigned_user_name ?? "",

                axStart: excelDateTime(ax?.started_at ?? null),
                axEnd: excelDateTime(ax?.ended_at ?? null),
                axStatus: ax?.is_done ? "DONE" : "",
                axUser: ax?.assigned_user_name ?? "",

                pendingReason: invoice.pending_reason ?? "",
                asnDate: excelDate(record.asn.share_date),
                asnUpdate: record.asn.is_shared ? "ASN SHARE" : "",
                asnUser: record.asn.assigned_user_name ?? "",
                remark: invoice.remark ?? "",
                status: invoice.status,
            });
        }

        sheet.eachRow((row, rowNumber) => {
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.font = {
                    name: "Calibri",
                    size: 11,
                    color: { argb: "FF1E293B" },
                };

                cell.alignment = {
                    vertical: "top",
                    wrapText: true,
                };
            });

            if (rowNumber > 1) {
                const record = records[rowNumber - 2];

                if (record.invoice.remark?.trim()) {
                    row.getCell("remark").fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFEFF6FF" },
                    };
                }
            }
        });

        const header = sheet.getRow(1);
        header.height = 44;

        header.eachCell((cell) => {
            cell.font = {
                name: "Calibri",
                size: 11,
                bold: true,
                color: { argb: "FFFFFFFF" },
            };

            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF1D4ED8" },
            };

            cell.alignment = {
                vertical: "middle",
                wrapText: true,
            };
        });

        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: sheet.rowCount, column: 20 },
        };

        sheet.pageSetup = {
            orientation: "landscape",
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            printTitlesRow: "1:1",
        };

        // No worksheet protection: users can edit the downloaded workbook.
        const buffer = await workbook.xlsx.writeBuffer();

        return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition":
                    'attachment; filename="Unloading-Tracker.xlsx"',
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch {
        return failure("Unable to generate the Excel workbook.", 500);
    }
}