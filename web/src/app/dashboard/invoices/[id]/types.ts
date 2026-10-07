export type ProcessStage = {
    system_name: "AX" | "D365";
    started_at: string;
    ended_at: string;
    is_done: boolean;
    assigned_user_name: string;
};

export type ProcessFormData = {
    invoice_id: string;
    version: number;
    stages: ProcessStage[];
    pending_reason: string;
    asn_share_date: string;
    asn_shared: boolean;
    asn_user_name: string;
    remark: string;
    status: "Pending" | "Complete" | "Reject";
};