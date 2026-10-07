"use client";

import React, { useState } from "react";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  ArrowRight,
  Layers,
} from "lucide-react";
import { InvoiceListItem } from "@/types";

interface InvoicesDashboardProps {
  invoices: InvoiceListItem[];
  selectedInvoiceId: string | null;
  onSelectInvoice: (invoiceId: string) => void;
  onNewRun: () => void;
}

export function InvoicesDashboard({
  invoices,
  selectedInvoiceId,
  onSelectInvoice,
  onNewRun,
}: InvoicesDashboardProps) {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const totalCount = invoices.length;
  const approvedCount = invoices.filter((i) => i.status === "AUTO_APPROVED").length;
  const flaggedCount = invoices.filter((i) => i.status === "FLAGGED_FOR_REVIEW").length;
  const rejectedCount = invoices.filter((i) => i.status === "REJECTED").length;

  const filteredInvoices = invoices.filter((inv) => {
    const matchesFilter =
      filterStatus === "ALL" ||
      (filterStatus === "APPROVED" && inv.status === "AUTO_APPROVED") ||
      (filterStatus === "FLAGGED" && inv.status === "FLAGGED_FOR_REVIEW") ||
      (filterStatus === "REJECTED" && inv.status === "REJECTED");

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      inv.vendor_name.toLowerCase().includes(q) ||
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.invoice_id.toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "AUTO_APPROVED":
        return <span className="badge badge-approved"><CheckCircle2 size={11} /> Auto-Approved</span>;
      case "FLAGGED_FOR_REVIEW":
        return <span className="badge badge-flagged"><AlertTriangle size={11} /> Flagged</span>;
      case "REJECTED":
        return <span className="badge badge-rejected"><XCircle size={11} /> Rejected</span>;
      default:
        return <span className="badge badge-pending">{st}</span>;
    }
  };

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto 36px auto" }}>
      {/* 4 KPI Cards Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Total Processed */}
        <div
          className="dash-card"
          style={{
            padding: "18px 20px",
            borderTop: "3px solid var(--primary)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase" }}>
              Total Processed
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "var(--radius-sm)",
                background: "var(--primary-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
              }}
            >
              <Layers size={15} />
            </div>
          </div>
          <p style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 4, letterSpacing: "-0.02em", color: "var(--text-main)" }}>
            {totalCount}
          </p>
          <p style={{ fontSize: "0.74rem", color: "var(--text-dim)", marginTop: 2 }}>
            Routed through business rule engine
          </p>
        </div>

        {/* Auto-Approved */}
        <div
          className="dash-card"
          style={{
            padding: "18px 20px",
            borderTop: "3px solid var(--approved)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase" }}>
              Auto-Approved
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "var(--radius-sm)",
                background: "var(--approved-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--approved)",
              }}
            >
              <CheckCircle2 size={15} />
            </div>
          </div>
          <p style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 4, color: "var(--approved-text)", letterSpacing: "-0.02em" }}>
            {approvedCount}
          </p>
          <p style={{ fontSize: "0.74rem", color: "var(--text-dim)", marginTop: 2 }}>
            {totalCount > 0 ? `${Math.round((approvedCount / totalCount) * 100)}% auto-approval rate` : "Clean matching within policy"}
          </p>
        </div>

        {/* Flagged */}
        <div
          className="dash-card"
          style={{
            padding: "18px 20px",
            borderTop: "3px solid var(--flagged)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase" }}>
              Flagged for Review
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "var(--radius-sm)",
                background: "var(--flagged-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--flagged)",
              }}
            >
              <AlertTriangle size={15} />
            </div>
          </div>
          <p style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 4, color: "var(--flagged-text)", letterSpacing: "-0.02em" }}>
            {flaggedCount}
          </p>
          <p style={{ fontSize: "0.74rem", color: "var(--text-dim)", marginTop: 2 }}>
            Tolerance or extraction variances
          </p>
        </div>

        {/* Rejected */}
        <div
          className="dash-card"
          style={{
            padding: "18px 20px",
            borderTop: "3px solid var(--rejected)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase" }}>
              Rejected
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "var(--radius-sm)",
                background: "var(--rejected-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--rejected)",
              }}
            >
              <XCircle size={15} />
            </div>
          </div>
          <p style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 4, color: "var(--rejected-text)", letterSpacing: "-0.02em" }}>
            {rejectedCount}
          </p>
          <p style={{ fontSize: "0.74rem", color: "var(--text-dim)", marginTop: 2 }}>
            Duplicate submission detected
          </p>
        </div>
      </div>

      {/* Table Card Section */}
      <div className="dash-card" style={{ padding: "20px 24px" }}>
        {/* Controls Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
            marginBottom: 18,
          }}
        >
          {/* Status Filter Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => setFilterStatus("ALL")}
              className={`btn btn-sm ${filterStatus === "ALL" ? "btn-primary" : "btn-secondary"}`}
            >
              All Runs ({totalCount})
            </button>
            <button
              onClick={() => setFilterStatus("APPROVED")}
              className={`btn btn-sm ${filterStatus === "APPROVED" ? "btn-primary" : "btn-secondary"}`}
            >
              Approved ({approvedCount})
            </button>
            <button
              onClick={() => setFilterStatus("FLAGGED")}
              className={`btn btn-sm ${filterStatus === "FLAGGED" ? "btn-primary" : "btn-secondary"}`}
            >
              Flagged ({flaggedCount})
            </button>
            <button
              onClick={() => setFilterStatus("REJECTED")}
              className={`btn btn-sm ${filterStatus === "REJECTED" ? "btn-primary" : "btn-secondary"}`}
            >
              Rejected ({rejectedCount})
            </button>
          </div>

          {/* Search Box */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--bg-canvas)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "6px 12px",
              minWidth: 260,
            }}
          >
            <Search size={14} color="var(--text-dim)" />
            <input
              type="text"
              placeholder="Search vendor, invoice #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-main)",
                fontSize: "0.84rem",
                width: "100%",
                fontFamily: "var(--font-sans)",
              }}
            />
          </div>
        </div>

        {/* Invoices List Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle)", textAlign: "left", color: "var(--text-dim)" }}>
                <th style={{ padding: "10px 16px", borderRadius: "var(--radius-sm) 0 0 var(--radius-sm)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Vendor</th>
                <th style={{ padding: "10px 16px", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Invoice #</th>
                <th style={{ padding: "10px 16px", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Source File</th>
                <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Total Amount</th>
                <th style={{ padding: "10px 16px", textAlign: "center", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Verdict</th>
                <th style={{ padding: "10px 16px", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Time</th>
                <th style={{ padding: "10px 16px", textAlign: "right", borderRadius: "0 var(--radius-sm) var(--radius-sm) 0", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => {
                const isSelected = inv.invoice_id === selectedInvoiceId;
                return (
                  <tr
                    key={inv.invoice_id}
                    onClick={() => onSelectInvoice(inv.invoice_id)}
                    style={{
                      borderTop: "1px solid var(--border)",
                      background: isSelected ? "var(--primary-dim)" : "transparent",
                      cursor: "pointer",
                      transition: "background 0.12s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "var(--bg-canvas)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-main)" }}>
                      {inv.vendor_name || "Unknown Vendor"}
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      {inv.invoice_number || "-"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-dim)", fontSize: "0.78rem" }}>
                      {inv.source_file || "-"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "var(--text-main)" }}>
                      ${inv.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {getStatusBadge(inv.status)}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-dim)", fontSize: "0.76rem" }}>
                      {new Date(inv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectInvoice(inv.invoice_id);
                        }}
                        className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-secondary"}`}
                        style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                      >
                        <span>{isSelected ? "Inspecting" : "Inspect"}</span>
                        <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredInvoices.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--text-dim)" }}>
              No invoices match the filter criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
