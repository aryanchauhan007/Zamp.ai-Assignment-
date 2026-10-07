"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  Play,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowUpRight,
  Mail,
  Zap,
  Paperclip,
  Code,
} from "lucide-react";
import { TestCase } from "@/types";

interface RunLauncherProps {
  testCases: TestCase[];
  onUploadFile: (file: File) => void;
  onRunTestCase: (caseId: string) => void;
  onSimulateEmail?: (sender: string, subject: string, samplePdf: string, customFile?: File | null) => void;
  isLaunching: boolean;
}

export function RunLauncher({
  testCases,
  onUploadFile,
  onRunTestCase,
  onSimulateEmail,
  isLaunching,
}: RunLauncherProps) {
  const [activeTab, setActiveTab] = useState<"both" | "test_cases" | "upload" | "email">("both");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email Ingestion Webhook simulator state
  const [emailSender, setEmailSender] = useState("billing@acmeindustrial.com");
  const [emailSubject, setEmailSubject] = useState("Invoice #INV-2026-9912 - Acme Industrial Supplies");
  const [emailSamplePdf, setEmailSamplePdf] = useState("happy_01_acme.pdf");
  const [emailCustomFile, setEmailCustomFile] = useState<File | null>(null);
  const emailFileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        setSelectedFile(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const triggerUpload = () => {
    if (selectedFile) {
      onUploadFile(selectedFile);
    }
  };

  const getBadgeForCase = (id: string) => {
    switch (id) {
      case "happy_path":
        return <span className="badge badge-approved"><CheckCircle2 size={11} /> Auto-Approve</span>;
      case "edge_1":
        return <span className="badge badge-flagged"><AlertTriangle size={11} /> Low Conf / Vision</span>;
      case "edge_2a":
        return <span className="badge badge-approved"><CheckCircle2 size={11} /> Split Delivery 1</span>;
      case "edge_2b":
        return <span className="badge badge-flagged"><AlertTriangle size={11} /> Split Exceeded</span>;
      case "edge_3":
        return <span className="badge badge-flagged"><AlertTriangle size={11} /> Tolerance Overage</span>;
      case "edge_4":
        return <span className="badge badge-rejected"><XCircle size={11} /> Duplicate Reject</span>;
      default:
        return <span className="badge badge-blue">Test Case</span>;
    }
  };

  return (
    <div
      style={{
        maxWidth: 1320,
        margin: "0 auto 32px auto",
      }}
    >
      {/* Segmented Tab Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 16,
          background: "var(--bg-subtle)",
          padding: 4,
          borderRadius: "var(--radius-md)",
          width: "fit-content",
          border: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => setActiveTab("both")}
          className={`btn btn-sm ${activeTab === "both" ? "btn-primary" : "btn-secondary"}`}
          style={{ border: "none", boxShadow: activeTab === "both" ? "var(--shadow-xs)" : "none" }}
        >
          Side-by-Side (Both)
        </button>
        <button
          onClick={() => setActiveTab("test_cases")}
          className={`btn btn-sm ${activeTab === "test_cases" ? "btn-primary" : "btn-secondary"}`}
          style={{ border: "none", boxShadow: activeTab === "test_cases" ? "var(--shadow-xs)" : "none" }}
        >
          <Play size={12} />
          <span>Test Cases ({testCases.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("upload")}
          className={`btn btn-sm ${activeTab === "upload" ? "btn-primary" : "btn-secondary"}`}
          style={{ border: "none", boxShadow: activeTab === "upload" ? "var(--shadow-xs)" : "none" }}
        >
          <UploadCloud size={12} />
          <span>Upload PDF</span>
        </button>
        <button
          onClick={() => setActiveTab("email")}
          className={`btn btn-sm ${activeTab === "email" ? "btn-primary" : "btn-secondary"}`}
          style={{ border: "none", boxShadow: activeTab === "email" ? "var(--shadow-xs)" : "none" }}
        >
          <Mail size={12} />
          <span>Email Webhook Simulator</span>
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: activeTab === "both" ? "repeat(auto-fit, minmax(420px, 1fr))" : "1fr",
          gap: 20,
        }}
      >
        {/* Entry Point 1: Upload a file */}
        {(activeTab === "both" || activeTab === "upload") && (
          <div className="dash-card" style={{ padding: "22px 24px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "var(--radius-md)",
                  background: "var(--primary-dim)",
                  border: "1px solid var(--primary-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary)",
                }}
              >
                <UploadCloud size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--text-main)" }}>
                  Upload Vendor Invoice
                </h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                  Drag & drop any vendor PDF to run through the extraction pipeline
                </p>
              </div>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                flex: 1,
                minHeight: 180,
                border: `2px dashed ${dragOver ? "var(--primary)" : "var(--border-strong)"}`,
                borderRadius: "var(--radius-md)",
                background: dragOver ? "var(--primary-dim)" : "var(--bg-canvas)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 24,
                textAlign: "center",
                transition: "all 0.15s ease",
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="application/pdf,.pdf"
                style={{ display: "none" }}
              />

              {selectedFile ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--radius-md)",
                      background: "var(--primary-dim)",
                      border: "1px solid var(--primary-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--primary)",
                    }}
                  >
                    <FileText size={22} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-main)", wordBreak: "break-all" }}>
                      {selectedFile.name}
                    </p>
                    <p style={{ fontSize: "0.76rem", color: "var(--text-dim)" }}>
                      {(selectedFile.size / 1024).toFixed(1)} KB &middot; Ready to process
                    </p>
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "var(--primary)", fontWeight: 500, marginTop: 4 }}>
                    Click to select different file
                  </span>
                </div>
              ) : (
                <>
                  <UploadCloud size={32} color="var(--text-dim)" style={{ marginBottom: 8 }} />
                  <p style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-main)", marginBottom: 2 }}>
                    Drop vendor PDF here
                  </p>
                  <p style={{ fontSize: "0.76rem", color: "var(--text-dim)" }}>
                    or click to browse local files
                  </p>
                </>
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <button
                onClick={triggerUpload}
                disabled={!selectedFile || isLaunching}
                className="btn btn-primary"
                style={{
                  width: "100%",
                  padding: "9px 16px",
                  opacity: !selectedFile || isLaunching ? 0.6 : 1,
                  fontWeight: 600,
                }}
              >
                <Play size={14} />
                <span>{isLaunching ? "Processing Pipeline..." : "Process Uploaded PDF"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Entry Point 2: Run a test case */}
        {(activeTab === "both" || activeTab === "test_cases") && (
          <div className="dash-card" style={{ padding: "22px 24px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-main)",
                  }}
                >
                  <Play size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--text-main)" }}>
                    Pre-Configured Test Suite
                  </h3>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                    Single-click evaluation cases &middot; Happy path + edge cases
                  </p>
                </div>
              </div>
              <span className="badge badge-blue" style={{ fontSize: "0.68rem" }}>
                6 DEMO CASES
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 330,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {testCases.map((tc) => (
                <button
                  key={tc.id}
                  onClick={() => onRunTestCase(tc.id)}
                  disabled={isLaunching}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    padding: "10px 14px",
                    textAlign: "left",
                    cursor: isLaunching ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    color: "var(--text-main)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-canvas)";
                    e.currentTarget.style.borderColor = "var(--primary-border)";
                    e.currentTarget.style.transform = "translateX(2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--bg-card)";
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-main)" }}>
                        {tc.title}
                      </span>
                      {getBadgeForCase(tc.id)}
                    </div>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {tc.subtitle}
                    </p>
                  </div>
                  <div
                    style={{
                      color: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      opacity: 0.8,
                    }}
                  >
                    <ArrowUpRight size={15} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Entry Point 3: Inbound Email Webhook Simulator */}
        {activeTab === "email" && (
          <div className="dash-card" style={{ padding: "24px 28px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "var(--radius-md)",
                    background: "var(--primary-dim)",
                    border: "1px solid var(--primary-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--primary)",
                  }}
                >
                  <Mail size={20} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)" }}>
                      Real-World Email Ingestion Webhook Simulator
                    </h3>
                    <span className="badge badge-approved" style={{ fontSize: "0.68rem" }}>
                      ● HTTP 202 ACCEPTED
                    </span>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: 2 }}>
                    Simulates SendGrid Inbound Parse or Parseur receiving an AP vendor invoice attachment via email.
                  </p>
                </div>
              </div>

              {/* Quick Presets */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", fontWeight: 600 }}>Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    setEmailSender("billing@acmeindustrial.com");
                    setEmailSubject("Invoice #INV-2026-001 - Acme Industrial Supplies");
                    setEmailSamplePdf("happy_01_acme.pdf");
                    setEmailCustomFile(null);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                >
                  Acme (Happy Path)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailSender("dispatch@betalogistics.com");
                    setEmailSubject("Freight Delivery Invoice #BL-8921");
                    setEmailSamplePdf("edge_case_3_near_tolerance.pdf");
                    setEmailCustomFile(null);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                >
                  Beta (Tolerance Overage)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailSender("accounting@apexoffice.com");
                    setEmailSubject("URGENT: Outstanding Bill #APX-4402");
                    setEmailSamplePdf("edge_case_4_duplicate.pdf");
                    setEmailCustomFile(null);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                >
                  Apex (Duplicate Fraud)
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                gap: 20,
              }}
            >
              {/* Form Side */}
              <div
                style={{
                  background: "var(--bg-canvas)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 600, color: "var(--text-main)", marginBottom: 4 }}>
                    From (Vendor Email):
                  </label>
                  <input
                    type="email"
                    value={emailSender}
                    onChange={(e) => setEmailSender(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      background: "var(--bg-card)",
                      fontSize: "0.82rem",
                      color: "var(--text-main)",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 600, color: "var(--text-main)", marginBottom: 4 }}>
                    Subject Line:
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      background: "var(--bg-card)",
                      fontSize: "0.82rem",
                      color: "var(--text-main)",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 600, color: "var(--text-main)", marginBottom: 4 }}>
                    Attached Invoice PDF:
                  </label>
                  <select
                    value={emailSamplePdf}
                    onChange={(e) => {
                      setEmailSamplePdf(e.target.value);
                      setEmailCustomFile(null);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      background: "var(--bg-card)",
                      fontSize: "0.82rem",
                      color: "var(--text-main)",
                    }}
                  >
                    <option value="happy_01_acme.pdf">Acme Industrial Supplies ($4,250.00 — PO-2026-001)</option>
                    <option value="happy_02_beta.pdf">Beta Logistics ($1,150.00 — PO-2026-002)</option>
                    <option value="happy_03_cloudhost.pdf">CloudHost Systems ($9,800.00 — PO-2026-003)</option>
                    <option value="edge_case_3_near_tolerance.pdf">Beta Freight ($8,280.00 — Exceeds Tolerance)</option>
                    <option value="edge_case_2_split_po_a.pdf">CloudHost Split Part 1 ($5,500.00)</option>
                    <option value="edge_case_2_split_po_b.pdf">CloudHost Split Part 2 ($5,500.00 — Split Exceeded)</option>
                    <option value="edge_case_1_scanned_lowquality.pdf">Scanned Invoice Receipt (Vision OCR Extraction)</option>
                    <option value="edge_case_4_duplicate.pdf">Duplicate Invoice Submission (Duplicate Check)</option>
                  </select>
                </div>

                <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => onSimulateEmail?.(emailSender, emailSubject, emailSamplePdf, emailCustomFile)}
                    disabled={isLaunching}
                    className="btn btn-primary"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "10px 18px",
                      fontWeight: 700,
                    }}
                  >
                    <Zap size={16} />
                    <span>Fire Inbound Email Webhook</span>
                  </button>
                </div>
              </div>

              {/* Developer Webhook & cURL Inspector */}
              <div
                style={{
                  background: "#0f172a",
                  color: "#e2e8f0",
                  borderRadius: "var(--radius-md)",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.74rem",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #334155", paddingBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#38bdf8" }}>
                    <Code size={14} />
                    <span style={{ fontWeight: 600 }}>WEBHOOK PAYLOAD SPEC</span>
                  </div>
                  <span style={{ color: "#94a3b8", fontSize: "0.68rem" }}>POST /api/webhooks/email-ingest</span>
                </div>

                <div>
                  <p style={{ color: "#64748b", marginBottom: 4 }}>// HTTP Request Body (JSON)</p>
                  <pre style={{ margin: 0, color: "#a5f3fc", background: "rgba(0,0,0,0.3)", padding: "10px 12px", borderRadius: 4, overflowX: "auto" }}>
{JSON.stringify(
  {
    sender: emailSender,
    subject: emailSubject,
    pdf_url: emailSamplePdf,
  },
  null,
  2
)}
                  </pre>
                </div>

                <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid #334155" }}>
                  <p style={{ color: "#94a3b8", fontSize: "0.7rem", lineHeight: 1.4 }}>
                    Incoming emails are parsed asynchronously via FastAPI BackgroundTasks with 100% immutable audit recording.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
