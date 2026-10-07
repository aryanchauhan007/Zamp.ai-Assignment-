export type StageName = 
  | "ingest" 
  | "extract" 
  | "validate" 
  | "match_po" 
  | "apply_rules" 
  | "decide";

export interface TestCase {
  id: string;
  title: string;
  category: "happy" | "edge";
  subtitle: string;
  filename: string;
  description: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface Invoice {
  id: string;
  vendor_name: string;
  invoice_number: string;
  invoice_date: string;
  po_reference?: string | null;
  line_items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  source_file: string;
  extraction_confidence: Record<string, number>;
  extraction_method: "text" | "vision";
}

export interface PurchaseOrder {
  po_id: string;
  vendor_name: string;
  po_amount: number;
  po_date: string;
  status: string;
  cumulative_invoiced: number;
}

export interface RuleResult {
  rule_name: string;
  passed: boolean;
  detail: string;
}

export interface Decision {
  invoice_id: string;
  status: "AUTO_APPROVED" | "FLAGGED_FOR_REVIEW" | "REJECTED";
  reason_code: string;
  reason_detail: string;
  rules_evaluated: RuleResult[];
  timestamp: string;
}

export interface RunLog {
  id?: number;
  run_id?: string;
  invoice_id: string;
  stage: StageName;
  stage_status: "pending" | "running" | "complete" | "failed";
  duration_ms?: number | null;
  detail?: string | null;
  timestamp: string;
}

export interface InvoiceDetailResponse {
  invoice: Invoice | null;
  matched_po: PurchaseOrder | null;
  decision: Decision | null;
  run_logs: RunLog[];
}

export interface InvoiceListItem {
  invoice_id: string;
  vendor_name: string;
  invoice_number: string;
  total: number;
  status: string;
  timestamp: string;
  source_file: string;
}

export interface StatusResponse {
  invoice_id: string;
  current_stage: StageName;
  stage_statuses: Record<StageName, "pending" | "running" | "complete" | "failed">;
  stage_details: Record<StageName, string | null>;
  is_complete: boolean;
}
