"use client";

import React from "react";
import { FileText, ArrowRight, CheckCircle2, AlertTriangle, XCircle, Zap, ShieldAlert, Cpu } from "lucide-react";

interface EmptyStateProps {
  onStartRun: () => void;
}

export function EmptyState({ onStartRun }: EmptyStateProps) {
  return (
    <div
      style={{
        maxWidth: 760,
        margin: "48px auto 32px auto",
        textAlign: "center",
        padding: "44px 36px",
      }}
      className="dash-card"
    >
      {/* Icon cluster */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 64,
          height: 64,
          borderRadius: "var(--radius-lg)",
          background: "var(--primary-dim)",
          border: "1px solid var(--primary-border)",
          color: "var(--primary)",
          marginBottom: 20,
        }}
      >
        <FileText size={30} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <span
          className="badge badge-blue"
          style={{
            textTransform: "none",
            fontSize: "0.78rem",
            padding: "4px 10px",
            fontWeight: 500,
          }}
        >
          <Zap size={12} />
          Procure-to-Pay Decision Intelligence
        </span>
      </div>

      <h1
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "var(--text-main)",
          marginBottom: 10,
          lineHeight: 1.25,
        }}
      >
        Invoice-to-Decision Engine
      </h1>

      <p
        style={{
          fontSize: "0.95rem",
          color: "var(--text-muted)",
          maxWidth: 580,
          margin: "0 auto 28px auto",
          lineHeight: 1.55,
        }}
      >
        Ingest raw vendor invoices, extract fields via hybrid text and vision models, cross-reference procurement records, and produce audit-ready, explainable business decisions.
      </p>

      {/* Decision Pill Indicators */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 32,
          textAlign: "left",
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            background: "var(--approved-dim)",
            border: "1px solid var(--approved-border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--approved-text)", marginBottom: 4 }}>
            <CheckCircle2 size={15} />
            <span style={{ fontWeight: 600, fontSize: "0.84rem" }}>Auto-Approve</span>
          </div>
          <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
            Exact PO match, verified math, approved vendor, and within tolerance limits.
          </p>
        </div>

        <div
          style={{
            padding: "12px 14px",
            background: "var(--flagged-dim)",
            border: "1px solid var(--flagged-border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--flagged-text)", marginBottom: 4 }}>
            <AlertTriangle size={15} />
            <span style={{ fontWeight: 600, fontSize: "0.84rem" }}>Flag for Review</span>
          </div>
          <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
            Scanned quality, math discrepancy, closed PO, or tolerance variance.
          </p>
        </div>

        <div
          style={{
            padding: "12px 14px",
            background: "var(--rejected-dim)",
            border: "1px solid var(--rejected-border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--rejected-text)", marginBottom: 4 }}>
            <XCircle size={15} />
            <span style={{ fontWeight: 600, fontSize: "0.84rem" }}>Reject</span>
          </div>
          <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
            Duplicate invoice number, repeated billing date, or fraud prevention trigger.
          </p>
        </div>
      </div>

      {/* Primary Action Button */}
      <button
        onClick={onStartRun}
        className="btn btn-primary"
        style={{
          padding: "10px 24px",
          fontSize: "0.94rem",
          fontWeight: 600,
        }}
      >
        <span>Run an Invoice</span>
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
