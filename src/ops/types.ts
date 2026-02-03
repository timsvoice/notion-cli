export type OperationReceipt = {
  op_id: string;
  type: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  resource_id?: string | null;
  resource_type?: string | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
  poll?: {
    method: string;
    path: string;
  } | null;
  error?: {
    code: string;
    message: string;
  } | null;
};
