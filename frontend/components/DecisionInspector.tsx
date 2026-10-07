"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck,
  Scale,
  ListOrdered,
  Clock,
  X,
  Building2,
  DollarSign,
  FileText,
  ExternalLink,
  Columns,
  Maximize2,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Send,
  Check,
} from "lucide-react";
import { InvoiceDetailResponse, RuleResult } from "@/types";

interface DecisionInspectorProps {
  detail: InvoiceDetailResponse;
  onClose?: () => void;
  onUpdated?: (updated: InvoiceDetailResponse) => void;
}

export function DecisionInspector({ detail, onClose, onUpdated }: DecisionInspectorProps) {
  const [activeTab, setActiveTab] = useState<"rules" | "reconciliation" | "fields" | "logs">("rules");
  const [isSplitView, setIsSplitView] = useState<boolean>(true);

  // HITL Override state
  const [overrideAction, setOverrideAction] = useState<"AUTO_APPROVED" | "REJECTED">("AUTO_APPROVED");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [isOverriding, setIsOverriding] = useState<boolean>(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);
  const [showOverrideBox, setShowOverrideBox] = useState<boolean>(detail.decision?.status === "FLAGGED_FOR_REVIEW");

  // Synchronize internal state with parent props
  const [currentDetail, setCurrentDetail] = useState<InvoiceDetailResponse>(detail);

  React.useEffect(() => {
    setCurrentDetail(detail);
    setOverrideSuccess(null);
    setOverrideError(null);
    setShowOverrideBox(detail.decision?.status === "FLAGGED_FOR_REVIEW");
  }, [detail]);

  const { invoice, matched_po, decision, run_logs } = currentDetail;
  if (!decision) return null;

  const handleExecuteOverride = async () => {
    if (!overrideReason.trim()) {
      setOverrideError("A mandatory audit justification is required to log a manual decision override.");
      return;
    }
    const invId = invoice?.id || decision.invoice_id;
    if (!invId) return;

    setIsOverriding(true);
    setOverrideError(null);
    setOverrideSuccess(null);

    try {
      const res = await fetch(`/api/invoices/${invId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: overrideAction,
          reason: overrideReason.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to record manual override.");
      }

      const updated: InvoiceDetailResponse = await res.json();
      setCurrentDetail(updated);
      setOverrideSuccess(
        `Successfully logged AP Manager override: ${overrideAction === "AUTO_APPROVED" ? "AUTO-APPROVED" : "REJECTED"}. Immutable audit trail updated.`
      );
      setOverrideReason("");
      onUpdated?.(updated);
    } catch (err: any) {
      setOverrideError(err.message || "Failed to submit override request.");
    } finally {
      setIsOverriding(false);
    }
  };

  const status = decision.status;
  const isApproved = status === "AUTO_APPROVED";
  const isFlagged = status === "FLAGGED_FOR_REVIEW";
  const isRejected = status === "REJECTED";

  const getStatusConfig = () => {
    if (isApproved) {
      return {
        bg: "var(--approved-dim)",
        border: "var(--approved-border)",
        color: "var(--approved-text)",
        title: "AUTO-APPROVED",
        icon: <CheckCircle2 size={26} color="var(--approved)" />,
        desc: "All business policies and tolerance thresholds satisfied. Approved for payment release.",
      };
    }
    if (isFlagged) {
      return {
        bg: "var(--flagged-dim)",
        border: "var(--flagged-border)",
        color: "var(--flagged-text)",
        title: "FLAGGED FOR REVIEW",
        icon: <AlertTriangle size={26} color="var(--flagged)" />,
        desc: "Reconciliation exception detected. Requires AP Manager verification prior to processing.",
      };
    }
    return {
      bg: "var(--rejected-dim)",
      border: "var(--rejected-border)",
      color: "var(--rejected-text)",
      title: "REJECTED",
      icon: <XCircle size={26} color="var(--rejected)" />,
      desc: "Critical validation failure or duplicate submission detected. Payment halted.",
    };
  };

  const statusCfg = getStatusConfig();

  const getRuleHumanName = (name: string) => {
    switch (name) {
      case "critical_field_check":
        return "1. Critical Field Confidence";
      case "arithmetic_check":
        return "2. Arithmetic Integrity Check";
      case "duplicate_check":
        return "3. Duplicate Detection";
      case "approved_vendor_check":
        return "4. Approved Vendor Policy";
      case "po_match":
        return "5. Purchase Order Matching";
      case "po_status_check":
        return "6. PO Open/Closed Status";
      case "tolerance_check":
        return "7. Amount Tolerance Band";
      case "split_po_cumulative":
        return "8. Split-PO Cumulative Limit";
      default:
        return name.replace(/_/g, " ");
    }
  };

  // Identify low confidence fields (< 0.75 threshold)
  const lowConfidenceFields: { field: string; score: number }[] = [];
  if (invoice?.extraction_confidence) {
    for (const [fKey, val] of Object.entries(invoice.extraction_confidence)) {
      if (val != null && val < 0.75) {
        lowConfidenceFields.push({ field: fKey, score: val });
      }
    }
  }

  const pdfUrl = invoice?.id ? `/api/invoices/${invoice.id}/pdf` : null;

  return (
    <div
      className="dash-card"
      style={{
        maxWidth: 1380,
        margin: "0 auto 32px auto",
        padding: "20px 24px",
      }}
    >
      {/* Top Controls Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: "0.98rem", color: "var(--text-main)" }}>
            Audit & Decision Inspector
          </span>
          <span
            style={{
              fontSize: "0.72rem",
              fontFamily: "var(--font-mono)",
              background: "var(--bg-subtle)",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              color: "var(--text-dim)",
            }}
          >
            Run ID: {invoice?.id || decision.invoice_id}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Side-by-side split toggle */}
          {pdfUrl && (
            <button
              onClick={() => setIsSplitView((prev) => !prev)}
              className={`btn btn-sm ${isSplitView ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: "0.76rem", padding: "5px 10px" }}
              title="Toggle side-by-side original PDF document viewer"
            >
              <Columns size={13} />
              <span>{isSplitView ? "Side-by-Side (Active)" : "Split View (PDF + Decision)"}</span>
            </button>
          )}

          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.76rem", padding: "5px 10px" }}
              title="Open full PDF document in a new browser tab"
            >
              <ExternalLink size={13} />
              <span>Full PDF</span>
            </a>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{ padding: "5px 8px" }}
              title="Close Inspector"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout: Split-Pane or Single-Column */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isSplitView && pdfUrl ? "minmax(380px, 46%) 1fr" : "1fr",
          gap: 22,
          alignItems: "start",
        }}
      >
        {/* LEFT PANE: Side-by-Side PDF Document Viewer */}
        {isSplitView && pdfUrl && (
          <div
            style={{
              background: "var(--bg-canvas)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* PDF Viewer Header */}
            <div
              style={{
                padding: "10px 14px",
                background: "var(--bg-subtle)",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={15} color="var(--primary)" />
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    color: "var(--text-main)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 220,
                  }}
                  title={invoice?.source_file || "Invoice PDF"}
                >
                  {invoice?.source_file || "Uploaded Invoice"}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  className="badge badge-blue"
                  style={{ fontSize: "0.66rem", padding: "2px 6px" }}
                >
                  {invoice?.extraction_method === "vision" ? "VISION OCR" : "TEXT NATIVE"}
                </span>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--text-dim)", display: "flex", alignItems: "center" }}
                  title="Open PDF in new window"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>

            {/* Embedded PDF iframe */}
            <div style={{ position: "relative", width: "100%", height: "700px", background: "#f1f5f9" }}>
              <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0`}
                title="Original Vendor Invoice PDF"
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
              />
            </div>
          </div>
        )}

        {/* RIGHT PANE: Explainable Decision & Audit Inspector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Top Verdict Banner */}
          <div
            style={{
              background: statusCfg.bg,
              border: `1px solid ${statusCfg.border}`,
              borderRadius: "var(--radius-md)",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius-sm)",
                  background: "#ffffff",
                  border: `1px solid ${statusCfg.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                {statusCfg.icon}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: statusCfg.color, letterSpacing: "-0.01em" }}>
                    {statusCfg.title}
                  </h2>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      padding: "2px 7px",
                      borderRadius: "var(--radius-xs)",
                      background: "#ffffff",
                      color: "var(--text-main)",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      border: `1px solid ${statusCfg.border}`,
                    }}
                  >
                    {decision.reason_code}
                  </span>
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {statusCfg.desc}
                </p>
              </div>
            </div>

            {invoice && (
              <div
                style={{
                  textAlign: "right",
                  background: "#ffffff",
                  padding: "6px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${statusCfg.border}`,
                }}
              >
                <p style={{ fontSize: "0.65rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
                  Invoice Total
                </p>
                <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-main)" }}>
                  ${invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  Vendor: <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{invoice.vendor_name}</span>
                </p>
              </div>
            )}
          </div>

          {/* Visual Confidence Alert Cue (If any critical field < 75%) */}
          {lowConfidenceFields.length > 0 && (
            <div
              style={{
                background: "var(--flagged-dim)",
                border: "1px solid var(--flagged-border)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <AlertTriangle size={18} color="var(--flagged)" />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--flagged-text)" }}>
                  Low Extraction Confidence Detected:
                </span>{" "}
                <span style={{ fontSize: "0.78rem", color: "var(--text-main)" }}>
                  {lowConfidenceFields.map((f) => `${f.field.replace("_", " ")} (${Math.round(f.score * 100)}%)`).join(", ")}
                </span>
                <span style={{ fontSize: "0.74rem", color: "var(--text-dim)", marginLeft: 6 }}>
                  (Threshold: 75% required for automated release)
                </span>
              </div>
            </div>
          )}

          {/* Decision Explanation Callout */}
          <div
            style={{
              background: "var(--bg-canvas)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <div style={{ color: statusCfg.color, marginTop: 2 }}>
              <Scale size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700, letterSpacing: "0.02em" }}>
                Explainable Decision Rationale
              </p>
              <p style={{ fontSize: "0.86rem", color: "var(--text-main)", fontWeight: 500, marginTop: 2, lineHeight: 1.45 }}>
                {decision.reason_detail}
              </p>
            </div>
          </div>

          {/* Human-in-the-Loop (HITL) AP Decision Override Card */}
          <div
            style={{
              background: "var(--bg-canvas)",
              border: isFlagged ? "1.5px solid var(--flagged-border)" : "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "14px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              position: "relative",
              boxShadow: isFlagged ? "0 2px 8px rgba(245, 158, 11, 0.08)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "var(--radius-sm)",
                    background: isFlagged ? "var(--flagged-dim)" : "var(--primary-dim)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isFlagged ? "var(--flagged-text)" : "var(--primary)",
                  }}
                >
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--text-main)" }}>
                    Human-in-the-Loop (HITL) AP Manager Override
                  </h3>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                    Enforce SOX-compliant human judgment with mandatory immutable audit justification.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {decision.reason_code === "MANUAL_OVERRIDE" && (
                  <span className="badge badge-approved" style={{ fontSize: "0.68rem" }}>
                    OVERRIDE RECORDED
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowOverrideBox((prev) => !prev)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                >
                  {showOverrideBox ? "Collapse" : "Open Override Panel"}
                </button>
              </div>
            </div>

            {showOverrideBox && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4, borderTop: "1px dashed var(--border)" }}>
                {/* Target Decision Selector */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--text-muted)" }}>
                    Action Target:
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setOverrideAction("AUTO_APPROVED")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "0.76rem",
                        fontWeight: 600,
                        padding: "5px 12px",
                        borderRadius: "var(--radius-sm)",
                        border: `1.5px solid ${overrideAction === "AUTO_APPROVED" ? "var(--approved)" : "var(--border)"}`,
                        background: overrideAction === "AUTO_APPROVED" ? "var(--approved-dim)" : "var(--bg-card)",
                        color: overrideAction === "AUTO_APPROVED" ? "var(--approved-text)" : "var(--text-muted)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <CheckCircle2 size={13} color="var(--approved)" />
                      <span>Force Approve</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOverrideAction("REJECTED")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "0.76rem",
                        fontWeight: 600,
                        padding: "5px 12px",
                        borderRadius: "var(--radius-sm)",
                        border: `1.5px solid ${overrideAction === "REJECTED" ? "var(--rejected)" : "var(--border)"}`,
                        background: overrideAction === "REJECTED" ? "var(--rejected-dim)" : "var(--bg-card)",
                        color: overrideAction === "REJECTED" ? "var(--rejected-text)" : "var(--text-muted)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <XCircle size={13} color="var(--rejected)" />
                      <span>Force Reject</span>
                    </button>
                  </div>
                </div>

                {/* Mandatory Justification Text Area */}
                <div>
                  <label
                    htmlFor="override-reason"
                    style={{
                      display: "block",
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      color: "var(--text-main)",
                      marginBottom: 4,
                    }}
                  >
                    Audit Justification Rationale <span style={{ color: "var(--rejected)" }}>*</span>
                  </label>
                  <textarea
                    id="override-reason"
                    rows={2}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder={
                      overrideAction === "AUTO_APPROVED"
                        ? "e.g., 'Procurement Director approved 1.8% variance via Slack exception #AP-9941 due to rush freight.'"
                        : "e.g., 'Vendor confirmed invoice was sent in error. Resubmission requested under revised PO.'"
                    }
                    style={{
                      width: "100%",
                      fontSize: "0.8rem",
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      background: "var(--bg-card)",
                      color: "var(--text-main)",
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                </div>

                {/* Error or Success notification */}
                {overrideError && (
                  <div style={{ fontSize: "0.74rem", color: "var(--rejected-text)", background: "var(--rejected-dim)", padding: "6px 10px", borderRadius: "var(--radius-xs)", border: "1px solid var(--rejected-border)" }}>
                    {overrideError}
                  </div>
                )}
                {overrideSuccess && (
                  <div style={{ fontSize: "0.74rem", color: "var(--approved-text)", background: "var(--approved-dim)", padding: "6px 10px", borderRadius: "var(--radius-xs)", border: "1px solid var(--approved-border)" }}>
                    {overrideSuccess}
                  </div>
                )}

                {/* Action CTA */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={handleExecuteOverride}
                    disabled={isOverriding || !overrideReason.trim()}
                    className="btn btn-primary btn-sm"
                    style={{
                      fontSize: "0.78rem",
                      padding: "6px 14px",
                      opacity: isOverriding || !overrideReason.trim() ? 0.6 : 1,
                      cursor: isOverriding || !overrideReason.trim() ? "not-allowed" : "pointer",
                    }}
                  >
                    {isOverriding ? (
                      <span>Logging to Audit Trail...</span>
                    ) : (
                      <>
                        <Send size={13} />
                        <span>Apply Override & Append Audit Trail</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderBottom: "1px solid var(--border)",
              paddingBottom: 8,
              marginTop: 4,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => setActiveTab("rules")}
              className={`btn btn-sm ${activeTab === "rules" ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: "0.78rem", padding: "5px 10px" }}
            >
              <ListOrdered size={13} />
              <span>8 Rules Trail ({decision.rules_evaluated.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("reconciliation")}
              className={`btn btn-sm ${activeTab === "reconciliation" ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: "0.78rem", padding: "5px 10px" }}
            >
              <Scale size={13} />
              <span>PO Reconciliation {matched_po ? `(${matched_po.po_id})` : "(Unmatched)"}</span>
            </button>

            <button
              onClick={() => setActiveTab("fields")}
              className={`btn btn-sm ${activeTab === "fields" ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: "0.78rem", padding: "5px 10px" }}
            >
              <FileCheck size={13} />
              <span>Extracted Data & Confidence</span>
            </button>

            <button
              onClick={() => setActiveTab("logs")}
              className={`btn btn-sm ${activeTab === "logs" ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: "0.78rem", padding: "5px 10px" }}
            >
              <Clock size={13} />
              <span>Stage Logs ({run_logs.length})</span>
            </button>
          </div>

          {/* Tab 1: 8 Rules Evaluation Trail */}
          {activeTab === "rules" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: "480px", overflowY: "auto", paddingRight: 2 }}>
              {decision.rules_evaluated.map((rule, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "10px 14px",
                    background: rule.passed ? "var(--approved-dim)" : "var(--flagged-dim)",
                    border: `1px solid ${rule.passed ? "var(--approved-border)" : "var(--flagged-border)"}`,
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1 }}>
                    <div style={{ marginTop: 2 }}>
                      {rule.passed ? (
                        <CheckCircle2 size={15} color="var(--approved)" />
                      ) : (
                        <AlertTriangle size={15} color="var(--flagged)" />
                      )}
                    </div>
                    <div>
                      <h4 style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--text-main)" }}>
                        {getRuleHumanName(rule.rule_name)}
                      </h4>
                      <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: 2, lineHeight: 1.35 }}>
                        {rule.detail}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className={rule.passed ? "badge badge-approved" : "badge badge-flagged"} style={{ fontSize: "0.68rem" }}>
                      {rule.passed ? "PASSED" : "FAILED / FLAGGED"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 2: PO Reconciliation */}
          {activeTab === "reconciliation" && (
            <div>
              {matched_po ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 14,
                  }}
                >
                  {/* Matched PO Card */}
                  <div
                    style={{
                      background: "var(--bg-canvas)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      padding: 14,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <h4 style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-main)" }}>
                        Procurement PO Details
                      </h4>
                      <span className="badge badge-approved" style={{ fontSize: "0.66rem" }}>{matched_po.status.toUpperCase()}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: "0.78rem" }}>
                      <div>
                        <span style={{ color: "var(--text-dim)" }}>PO Identifier:</span>{" "}
                        <span className="font-mono" style={{ fontWeight: 600, color: "var(--text-main)" }}>{matched_po.po_id}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-dim)" }}>Authorized Vendor:</span>{" "}
                        <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{matched_po.vendor_name}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-dim)" }}>Total PO Amount:</span>{" "}
                        <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                          ${matched_po.po_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-dim)" }}>PO Date:</span>{" "}
                        <span style={{ color: "var(--text-main)" }}>{matched_po.po_date}</span>
                      </div>
                    </div>
                  </div>

                  {/* Balance & Tolerance Card */}
                  <div
                    style={{
                      background: "var(--bg-canvas)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      padding: 14,
                    }}
                  >
                    <h4 style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-main)", marginBottom: 10 }}>
                      Tolerance & Cumulative Analysis
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: "0.78rem" }}>
                      <div>
                        <span style={{ color: "var(--text-dim)" }}>Current Cumulative Invoiced:</span>{" "}
                        <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                          ${matched_po.cumulative_invoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-dim)" }}>Invoice Amount Evaluated:</span>{" "}
                        <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                          ${(invoice?.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-dim)" }}>Tolerance Window:</span>{" "}
                        <span style={{ fontWeight: 600, color: "var(--approved-text)" }}>
                          2.0% ($25.00 floor) = $
                          {Math.max(matched_po.po_amount * 0.02, 25.0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-dim)" }}>Max Allowed Cumulative:</span>{" "}
                        <span style={{ fontWeight: 700, color: "var(--text-main)" }}>
                          $
                          {(matched_po.po_amount + Math.max(matched_po.po_amount * 0.02, 25.0)).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "24px 16px",
                    background: "var(--flagged-dim)",
                    border: "1px solid var(--flagged-border)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <AlertTriangle size={24} color="var(--flagged)" style={{ marginBottom: 4 }} />
                  <h4 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--flagged-text)" }}>
                    No Matching Purchase Order Found
                  </h4>
                  <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: 2 }}>
                    Neither exact PO reference lookup nor fuzzy vendor+amount matching matched an open procurement record.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Extracted Data & Confidence (With visual cues for < 75%) */}
          {activeTab === "fields" && invoice && (
            <div>
              {/* Confidence Meter Grid with Visual Threshold Indicators */}
              <div
                style={{
                  background: "var(--bg-canvas)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h4 style={{ fontWeight: 700, fontSize: "0.84rem", color: "var(--text-main)" }}>
                    Extraction Confidence Cues (Threshold: 75%)
                  </h4>
                  <span className="badge badge-blue" style={{ fontSize: "0.66rem" }}>
                    HUMAN REVIEW GATE: 75%
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 8,
                  }}
                >
                  {Object.entries(invoice.extraction_confidence || {}).map(([key, val]) => {
                    const pct = Math.round((val || 0) * 100);
                    const isLow = pct < 75;
                    return (
                      <div
                        key={key}
                        style={{
                          background: isLow ? "var(--flagged-dim)" : "var(--approved-dim)",
                          border: `1px solid ${isLow ? "var(--flagged-border)" : "var(--approved-border)"}`,
                          borderRadius: "var(--radius-xs)",
                          padding: "7px 10px",
                          position: "relative",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <p style={{ fontSize: "0.68rem", color: "var(--text-dim)", textTransform: "capitalize", fontWeight: 600 }}>
                            {key.replace("_", " ")}
                          </p>
                          {isLow && <span title="Low confidence (< 75%)">⚠️</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                          <p
                            style={{
                              fontWeight: 700,
                              fontSize: "0.92rem",
                              color: isLow ? "var(--flagged-text)" : "var(--approved-text)",
                            }}
                          >
                            {pct}%
                          </p>
                          <span style={{ fontSize: "0.64rem", color: isLow ? "var(--flagged)" : "var(--text-dim)" }}>
                            {isLow ? "Review req." : "Verified"}
                          </span>
                        </div>
                        {/* Visual progress bar */}
                        <div style={{ height: 3, width: "100%", background: "rgba(0,0,0,0.06)", borderRadius: 2, marginTop: 4 }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: isLow ? "var(--flagged)" : "var(--approved)",
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Line Items Table */}
              <div
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: "0.82rem", color: "var(--text-main)" }}>
                  Extracted Line Items ({invoice.line_items?.length || 0})
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-subtle)", textAlign: "left", color: "var(--text-dim)" }}>
                      <th style={{ padding: "7px 12px", fontWeight: 600 }}>Description</th>
                      <th style={{ padding: "7px 12px", textAlign: "right", fontWeight: 600 }}>Quantity</th>
                      <th style={{ padding: "7px 12px", textAlign: "right", fontWeight: 600 }}>Unit Price</th>
                      <th style={{ padding: "7px 12px", textAlign: "right", fontWeight: 600 }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice.line_items || []).map((li, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px 12px", color: "var(--text-main)" }}>{li.description}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)" }}>{li.quantity}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)" }}>${li.unit_price.toFixed(2)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "var(--text-main)" }}>
                          ${(li.quantity * li.unit_price).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div
                  style={{
                    padding: "10px 14px",
                    borderTop: "1px solid var(--border)",
                    background: "var(--bg-canvas)",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 16,
                    fontSize: "0.78rem",
                  }}
                >
                  <div>Subtotal: <strong>${invoice.subtotal.toFixed(2)}</strong></div>
                  <div>Tax: <strong>${invoice.tax.toFixed(2)}</strong></div>
                  <div style={{ color: "var(--approved-text)", fontSize: "0.86rem" }}>
                    Total: <strong>${invoice.total.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Stage Run Logs */}
          {activeTab === "logs" && (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                overflow: "hidden",
                fontFamily: "var(--font-mono)",
                fontSize: "0.74rem",
              }}
            >
              <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontWeight: 700, color: "var(--text-dim)", background: "var(--bg-subtle)" }}>
                Execution Stage Logs
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-subtle)", textAlign: "left", color: "var(--text-dim)" }}>
                    <th style={{ padding: "6px 12px", fontWeight: 600 }}>Stage</th>
                    <th style={{ padding: "6px 12px", fontWeight: 600 }}>Status</th>
                    <th style={{ padding: "6px 12px", fontWeight: 600 }}>Duration</th>
                    <th style={{ padding: "6px 12px", fontWeight: 600 }}>Timestamp</th>
                    <th style={{ padding: "6px 12px", fontWeight: 600 }}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {run_logs.map((log, idx) => (
                    <tr key={idx} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "7px 12px", color: "var(--primary)", fontWeight: 600 }}>
                        {log.stage}
                      </td>
                      <td style={{ padding: "7px 12px" }}>
                        <span
                          style={{
                            color: log.stage_status === "complete" ? "var(--approved-text)" : "var(--text-dim)",
                            fontWeight: 500,
                          }}
                        >
                          {log.stage_status}
                        </span>
                      </td>
                      <td style={{ padding: "7px 12px", color: "var(--text-dim)" }}>
                        {log.duration_ms != null ? `${log.duration_ms}ms` : "-"}
                      </td>
                      <td style={{ padding: "7px 12px", color: "var(--text-dim)" }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: "7px 12px", color: "var(--text-muted)" }}>
                        {log.detail || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
