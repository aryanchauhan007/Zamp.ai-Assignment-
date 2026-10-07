"use client";

import React from "react";
import { Check, Loader2, AlertCircle, FileText, Building2, Calendar, DollarSign, X } from "lucide-react";
import { StatusResponse, InvoiceDetailResponse, StageName } from "@/types";

interface LivePipelinePanelProps {
  status: StatusResponse | null;
  detail: InvoiceDetailResponse | null;
  onClose?: () => void;
}

const STAGES: { key: StageName; label: string; desc: string }[] = [
  { key: "ingest", label: "Ingest", desc: "PDF byte parsing" },
  { key: "extract", label: "Extract", desc: "Text / Vision LLM" },
  { key: "validate", label: "Validate", desc: "Arithmetic check" },
  { key: "match_po", label: "Match PO", desc: "PO registry lookup" },
  { key: "apply_rules", label: "Apply Rules", desc: "8 Policy rules" },
  { key: "decide", label: "Decision", desc: "Explainable verdict" },
];

export function LivePipelinePanel({ status, detail, onClose }: LivePipelinePanelProps) {
  if (!status) return null;

  const currentStage = status.current_stage;
  const stageStatuses = status.stage_statuses || {};
  const stageDetails = status.stage_details || {};
  const isComplete = status.is_complete;

  const invoice = detail?.invoice;
  const isExtractDone = stageStatuses["extract"] === "complete";

  return (
    <div
      className="dash-card"
      style={{
        maxWidth: 1320,
        margin: "0 auto 28px auto",
        padding: "22px 26px",
        borderColor: isComplete ? "var(--approved-border)" : "var(--primary-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 22,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: isComplete ? "var(--approved)" : "var(--primary)",
            }}
            className={isComplete ? "" : "pulsing-node"}
          />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ fontSize: "1.02rem", fontWeight: 700, color: "var(--text-main)" }}>
                {isComplete ? "Pipeline Execution Complete" : "Live Processing Pipeline"}
              </h3>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontFamily: "var(--font-mono)",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-xs)",
                  background: "var(--bg-subtle)",
                  color: "var(--text-dim)",
                  border: "1px solid var(--border)",
                }}
              >
                ID: {status.invoice_id}
              </span>
            </div>
            <p style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
              {isComplete
                ? "All 6 automated processing stages finished successfully."
                : `Currently executing: ${currentStage.toUpperCase()} stage`}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            className={isComplete ? "badge badge-approved" : "badge badge-blue"}
            style={{ padding: "4px 10px", fontSize: "0.72rem" }}
          >
            {isComplete ? (
              <>
                <Check size={12} /> COMPLETE
              </>
            ) : (
              <>
                <Loader2 size={12} className="spin" /> RUNNING: {currentStage.toUpperCase()}
              </>
            )}
          </span>

          {onClose && isComplete && (
            <button
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{ padding: "4px 8px" }}
              title="Close live panel"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 6,
          marginBottom: isExtractDone && invoice ? 20 : 6,
          position: "relative",
        }}
      >
        {STAGES.map((s, index) => {
          const st = stageStatuses[s.key] || "pending";
          const isDone = st === "complete";
          const isRunning = st === "running";
          const isFailed = st === "failed";
          const stageDetail = stageDetails[s.key];

          let nodeBg = "var(--bg-subtle)";
          let nodeBorder = "var(--border)";
          let iconColor = "var(--text-dim)";

          if (isDone) {
            nodeBg = "var(--approved)";
            nodeBorder = "var(--approved)";
            iconColor = "#ffffff";
          } else if (isRunning) {
            nodeBg = "var(--primary)";
            nodeBorder = "var(--primary)";
            iconColor = "#ffffff";
          } else if (isFailed) {
            nodeBg = "var(--rejected)";
            nodeBorder = "var(--rejected)";
            iconColor = "#ffffff";
          }

          return (
            <div
              key={s.key}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                position: "relative",
              }}
            >
              {/* Connector line */}
              {index < STAGES.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    top: 15,
                    left: "50%",
                    width: "100%",
                    height: 2,
                    background: isDone
                      ? "var(--approved)"
                      : isRunning
                      ? "linear-gradient(90deg, var(--primary), var(--border))"
                      : "var(--border)",
                    zIndex: 0,
                    transition: "all 0.25s ease",
                  }}
                />
              )}

              {/* Node Circle */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: nodeBg,
                  border: `2px solid ${nodeBorder}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 2,
                  transition: "all 0.2s ease",
                  boxShadow: isRunning ? "0 0 0 4px var(--primary-dim)" : "none",
                }}
              >
                {isDone ? (
                  <Check size={16} color={iconColor} strokeWidth={2.8} />
                ) : isRunning ? (
                  <Loader2 size={16} color={iconColor} className="spin" />
                ) : isFailed ? (
                  <AlertCircle size={16} color={iconColor} />
                ) : (
                  <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-dim)" }}>
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Stage label */}
              <div style={{ marginTop: 8 }}>
                <p
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: isRunning || isDone ? 700 : 500,
                    color: isDone ? "var(--text-main)" : isRunning ? "var(--primary)" : "var(--text-muted)",
                  }}
                >
                  {s.label}
                </p>
                <p
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-dim)",
                    marginTop: 1,
                    maxWidth: 120,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={stageDetail || s.desc}
                >
                  {stageDetail ? stageDetail : s.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time Extracted Data Preview (appears as soon as extraction stage finishes) */}
      {isExtractDone && invoice && (
        <div
          style={{
            background: "var(--bg-canvas)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "14px 18px",
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-sm)",
                background: "var(--primary-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
              }}
            >
              <Building2 size={16} />
            </div>
            <div>
              <p style={{ fontSize: "0.68rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
                Vendor
              </p>
              <p style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-main)" }}>
                {invoice.vendor_name || "Unknown"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
              }}
            >
              <FileText size={16} />
            </div>
            <div>
              <p style={{ fontSize: "0.68rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
                Invoice No.
              </p>
              <p style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-main)", fontFamily: "var(--font-mono)" }}>
                {invoice.invoice_number || "N/A"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-sm)",
                background: "var(--approved-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--approved)",
              }}
            >
              <DollarSign size={16} />
            </div>
            <div>
              <p style={{ fontSize: "0.68rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
                Total Amount
              </p>
              <p style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--approved-text)" }}>
                ${invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
              }}
            >
              <Calendar size={16} />
            </div>
            <div>
              <p style={{ fontSize: "0.68rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
                PO Ref & Method
              </p>
              <p style={{ fontWeight: 600, fontSize: "0.84rem", color: "var(--text-main)" }}>
                {invoice.po_reference || "No PO Ref"}{" "}
                <span
                  style={{
                    fontSize: "0.66rem",
                    padding: "2px 5px",
                    borderRadius: "var(--radius-xs)",
                    background: "var(--bg-subtle)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border)",
                    marginLeft: 4,
                  }}
                >
                  {invoice.extraction_method.toUpperCase()}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
