"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Play, FileText, CheckCircle2, AlertTriangle, XCircle, ArrowUpRight } from "lucide-react";
import { TestCase } from "@/types";

interface RunLauncherProps {
  testCases: TestCase[];
  onUploadFile: (file: File) => void;
  onRunTestCase: (caseId: string) => void;
  isLaunching: boolean;
}

export function RunLauncher({
  testCases,
  onUploadFile,
  onRunTestCase,
  isLaunching,
}: RunLauncherProps) {
  const [activeTab, setActiveTab] = useState<"both" | "test_cases" | "upload">("both");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      </div>
    </div>
  );
}
