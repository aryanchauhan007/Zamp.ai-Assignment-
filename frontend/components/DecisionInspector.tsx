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
  ShieldCheck,
} from "lucide-react";
import { InvoiceDetailResponse, RuleResult } from "@/types";

interface DecisionInspectorProps {
  detail: InvoiceDetailResponse;
  onClose?: () => void;
}

export function DecisionInspector({ detail, onClose }: DecisionInspectorProps) {
  const [activeTab, setActiveTab] = useState<"rules" | "reconciliation" | "fields" | "logs">("rules");

  const { invoice, matched_po, decision, run_logs } = detail;
  if (!decision) return null;

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
        icon: <CheckCircle2 size={30} color="var(--approved)" />,
        desc: "All business policies and tolerance thresholds satisfied. Approved for payment release.",
      };
    }
    if (isFlagged) {
      return {
        bg: "var(--flagged-dim)",
        border: "var(--flagged-border)",
        color: "var(--flagged-text)",
        title: "FLAGGED FOR REVIEW",
        icon: <AlertTriangle size={30} color="var(--flagged)" />,
        desc: "Reconciliation exception detected. Requires AP Manager verification prior to processing.",
      };
    }
    return {
      bg: "var(--rejected-dim)",
      border: "var(--rejected-border)",
      color: "var(--rejected-text)",
      title: "REJECTED",
      icon: <XCircle size={30} color="var(--rejected)" />,
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

  return (
    <div
      className="dash-card"
      style={{
        maxWidth: 1320,
        margin: "0 auto 32px auto",
        padding: "24px 28px",
      }}
    >
      {/* Top Verdict Banner */}
      <div
        style={{
          background: statusCfg.bg,
          border: `1px solid ${statusCfg.border}`,
          borderRadius: "var(--radius-lg)",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: "var(--radius-md)",
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: statusCfg.color, letterSpacing: "-0.02em" }}>
                {statusCfg.title}
              </h2>
              <span
                style={{
                  fontSize: "0.74rem",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-sm)",
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
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 2 }}>
              {statusCfg.desc}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {invoice && (
            <div
              style={{
                textAlign: "right",
                background: "#ffffff",
                padding: "8px 16px",
                borderRadius: "var(--radius-md)",
                border: `1px solid ${statusCfg.border}`,
              }}
            >
              <p style={{ fontSize: "0.68rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
                Invoice Total
              </p>
              <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-main)" }}>
                ${invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                Vendor: <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{invoice.vendor_name}</span>
              </p>
            </div>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{ padding: "6px 8px", height: "fit-content" }}
              title="Close Inspector"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Decision Explanation Callout */}
      <div
        style={{
          background: "var(--bg-canvas)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "14px 18px",
          marginBottom: 22,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ color: statusCfg.color, marginTop: 2 }}>
          <Scale size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700, letterSpacing: "0.02em" }}>
            Explainable Decision Rationale
          </p>
          <p style={{ fontSize: "0.9rem", color: "var(--text-main)", fontWeight: 500, marginTop: 2, lineHeight: 1.45 }}>
            {decision.reason_detail}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 10,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setActiveTab("rules")}
          className={`btn btn-sm ${activeTab === "rules" ? "btn-primary" : "btn-secondary"}`}
        >
          <ListOrdered size={14} />
          <span>8 Rules Evaluation Trail ({decision.rules_evaluated.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`btn btn-sm ${activeTab === "reconciliation" ? "btn-primary" : "btn-secondary"}`}
        >
          <Scale size={14} />
          <span>PO Reconciliation {matched_po ? `(${matched_po.po_id})` : "(Unmatched)"}</span>
        </button>

        <button
          onClick={() => setActiveTab("fields")}
          className={`btn btn-sm ${activeTab === "fields" ? "btn-primary" : "btn-secondary"}`}
        >
          <FileCheck size={14} />
          <span>Extracted Data & Confidence</span>
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`btn btn-sm ${activeTab === "logs" ? "btn-primary" : "btn-secondary"}`}
        >
          <Clock size={14} />
          <span>Stage Run Logs ({run_logs.length})</span>
        </button>
      </div>

      {/* Tab 1: 8 Rules Trail */}
      {activeTab === "rules" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {decision.rules_evaluated.map((rule, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 14,
                padding: "12px 16px",
                background: rule.passed ? "var(--approved-dim)" : "var(--flagged-dim)",
                border: `1px solid ${rule.passed ? "var(--approved-border)" : "var(--flagged-border)"}`,
                borderRadius: "var(--radius-md)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1 }}>
                <div style={{ marginTop: 2 }}>
                  {rule.passed ? (
                    <CheckCircle2 size={16} color="var(--approved)" />
                  ) : (
                    <AlertTriangle size={16} color="var(--flagged)" />
                  )}
                </div>
                <div>
                  <h4 style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-main)" }}>
                    {getRuleHumanName(rule.rule_name)}
                  </h4>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2, lineHeight: 1.4 }}>
                    {rule.detail}
                  </p>
                </div>
              </div>

              <div>
                <span className={rule.passed ? "badge badge-approved" : "badge badge-flagged"}>
                  {rule.passed ? "PASSED" : "FLAGGED / FAILED"}
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
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {/* Matched PO Card */}
              <div
                style={{
                  background: "var(--bg-canvas)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: 18,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h4 style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-main)" }}>
                    Procurement PO Details
                  </h4>
                  <span className="badge badge-approved">{matched_po.status.toUpperCase()}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.82rem" }}>
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
                  borderRadius: "var(--radius-md)",
                  padding: 18,
                }}
              >
                <h4 style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-main)", marginBottom: 12 }}>
                  Split-PO & Tolerance Analysis
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.82rem" }}>
                  <div>
                    <span style={{ color: "var(--text-dim)" }}>Current Cumulative Invoiced:</span>{" "}
                    <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                      ${matched_po.cumulative_invoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)" }}>Invoice Amount Being Evaluated:</span>{" "}
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
                padding: "28px 20px",
                background: "var(--flagged-dim)",
                border: "1px solid var(--flagged-border)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <AlertTriangle size={28} color="var(--flagged)" style={{ marginBottom: 6 }} />
              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--flagged-text)" }}>
                No Matching Purchase Order Found
              </h4>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>
                Neither exact PO reference lookup nor fuzzy vendor+amount matching matched an open procurement record.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Extracted Data & Confidence */}
      {activeTab === "fields" && invoice && (
        <div>
          {/* Confidence Meter */}
          <div
            style={{
              background: "var(--bg-canvas)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h4 style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-main)" }}>
                Field Extraction Confidence Scores
              </h4>
              <span className="badge badge-blue" style={{ fontSize: "0.68rem" }}>
                THRESHOLD: 70%
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 10,
              }}
            >
              {Object.entries(invoice.extraction_confidence || {}).map(([key, val]) => {
                const pct = Math.round((val || 0) * 100);
                const isPass = pct >= 70;
                return (
                  <div
                    key={key}
                    style={{
                      background: isPass ? "var(--approved-dim)" : "var(--rejected-dim)",
                      border: `1px solid ${isPass ? "var(--approved-border)" : "var(--rejected-border)"}`,
                      borderRadius: "var(--radius-sm)",
                      padding: "8px 12px",
                    }}
                  >
                    <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "capitalize", fontWeight: 600 }}>
                      {key.replace("_", " ")}
                    </p>
                    <p
                      style={{
                        fontWeight: 700,
                        fontSize: "0.94rem",
                        color: isPass ? "var(--approved-text)" : "var(--rejected-text)",
                        marginTop: 2,
                      }}
                    >
                      {pct}%
                    </p>
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
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: "0.86rem", color: "var(--text-main)" }}>
              Extracted Line Items ({invoice.line_items?.length || 0})
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: "var(--bg-subtle)", textAlign: "left", color: "var(--text-dim)" }}>
                  <th style={{ padding: "8px 16px", fontWeight: 600 }}>Description</th>
                  <th style={{ padding: "8px 16px", textAlign: "right", fontWeight: 600 }}>Quantity</th>
                  <th style={{ padding: "8px 16px", textAlign: "right", fontWeight: 600 }}>Unit Price</th>
                  <th style={{ padding: "8px 16px", textAlign: "right", fontWeight: 600 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.line_items || []).map((li, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 16px", color: "var(--text-main)" }}>{li.description}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "var(--text-muted)" }}>{li.quantity}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "var(--text-muted)" }}>${li.unit_price.toFixed(2)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: "var(--text-main)" }}>
                      ${(li.quantity * li.unit_price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--border)",
                background: "var(--bg-canvas)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 20,
                fontSize: "0.82rem",
              }}
            >
              <div>Subtotal: <strong>${invoice.subtotal.toFixed(2)}</strong></div>
              <div>Tax: <strong>${invoice.tax.toFixed(2)}</strong></div>
              <div style={{ color: "var(--approved-text)", fontSize: "0.9rem" }}>
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
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            fontFamily: "var(--font-mono)",
            fontSize: "0.78rem",
          }}
        >
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, color: "var(--text-dim)", background: "var(--bg-subtle)" }}>
            Stage Execution Timestamp Logs
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle)", textAlign: "left", color: "var(--text-dim)" }}>
                <th style={{ padding: "8px 14px", fontWeight: 600 }}>Stage</th>
                <th style={{ padding: "8px 14px", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "8px 14px", fontWeight: 600 }}>Duration</th>
                <th style={{ padding: "8px 14px", fontWeight: 600 }}>Timestamp</th>
                <th style={{ padding: "8px 14px", fontWeight: 600 }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {run_logs.map((log, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 14px", color: "var(--primary)", fontWeight: 600 }}>
                    {log.stage}
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    <span
                      style={{
                        color: log.stage_status === "complete" ? "var(--approved-text)" : "var(--text-dim)",
                        fontWeight: 500,
                      }}
                    >
                      {log.stage_status}
                    </span>
                  </td>
                  <td style={{ padding: "8px 14px", color: "var(--text-dim)" }}>
                    {log.duration_ms != null ? `${log.duration_ms}ms` : "-"}
                  </td>
                  <td style={{ padding: "8px 14px", color: "var(--text-dim)" }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: "8px 14px", color: "var(--text-muted)" }}>
                    {log.detail || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
