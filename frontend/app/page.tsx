"use client";

import React, { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { RunLauncher } from "@/components/RunLauncher";
import { LivePipelinePanel } from "@/components/LivePipelinePanel";
import { DecisionInspector } from "@/components/DecisionInspector";
import { InvoicesDashboard } from "@/components/InvoicesDashboard";
import {
  InvoiceListItem,
  TestCase,
  StatusResponse,
  InvoiceDetailResponse,
} from "@/types";

export default function Home() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // UI Flow States
  const [showLauncher, setShowLauncher] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Live Run State
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<StatusResponse | null>(null);
  const [activeDetail, setActiveDetail] = useState<InvoiceDetailResponse | null>(null);

  // Selected past invoice for inspection
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load Invoices & Test Cases
  const refreshInvoices = async () => {
    try {
      const res = await fetch("/api/invoices");
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } catch (err) {
      console.error("Failed to load invoices:", err);
    }
  };

  const loadTestCases = async () => {
    try {
      const res = await fetch("/api/test-cases");
      if (res.ok) {
        const data = await res.json();
        setTestCases(data);
      }
    } catch (err) {
      console.error("Failed to load test cases:", err);
    }
  };

  useEffect(() => {
    Promise.all([refreshInvoices(), loadTestCases()]).finally(() => {
      setLoadingInitial(false);
    });
  }, []);

  // Poll status when activeInvoiceId is set
  useEffect(() => {
    if (!activeInvoiceId) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/invoices/${activeInvoiceId}/status`);
        if (res.ok) {
          const statusData: StatusResponse = await res.json();
          setLiveStatus(statusData);

          // If extract is done, fetch partial or complete details
          if (statusData.stage_statuses.extract === "complete") {
            const detailRes = await fetch(`/api/invoices/${activeInvoiceId}`);
            if (detailRes.ok) {
              const detailData: InvoiceDetailResponse = await detailRes.json();
              setActiveDetail(detailData);
            }
          }

          if (statusData.is_complete) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            // Refresh invoice list to include new run
            refreshInvoices();
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 1000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeInvoiceId]);

  // Start a run via file upload
  const handleUploadFile = async (file: File) => {
    setIsLaunching(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/invoices/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Upload failed");
        setIsLaunching(false);
        return;
      }

      const data = await res.json();
      const invoiceId = data.invoice_id;

      setActiveInvoiceId(invoiceId);
      setSelectedInvoiceId(invoiceId);
      setShowLauncher(false);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error starting file run.");
    } finally {
      setIsLaunching(false);
    }
  };

  // Start a run via pre-configured test case
  const handleRunTestCase = async (caseId: string) => {
    setIsLaunching(true);
    try {
      const res = await fetch(`/api/test-cases/run?case_id=${encodeURIComponent(caseId)}`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Test case execution failed");
        setIsLaunching(false);
        return;
      }

      const data = await res.json();
      const invoiceId = data.invoice_id;

      setActiveInvoiceId(invoiceId);
      setSelectedInvoiceId(invoiceId);
      setShowLauncher(false);
    } catch (err) {
      console.error("Test case run error:", err);
      alert("Error starting test case.");
    } finally {
      setIsLaunching(false);
    }
  };

  // Select an invoice from table to inspect
  const handleSelectInvoice = async (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (res.ok) {
        const data: InvoiceDetailResponse = await res.json();
        setActiveDetail(data);

        // Also fetch status logs for the stepper if wanted
        const sRes = await fetch(`/api/invoices/${invoiceId}/status`);
        if (sRes.ok) {
          const sData = await sRes.json();
          setLiveStatus(sData);
        }
      }
    } catch (err) {
      console.error("Failed to load invoice detail:", err);
    }
  };

  // Demo Reset (clears DB back to empty state)
  const handleResetDemo = async () => {
    if (!confirm("Reset demo data? This will clear all invoice runs to demonstrate the empty state.")) {
      return;
    }
    setIsResetting(true);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (res.ok) {
        setActiveInvoiceId(null);
        setLiveStatus(null);
        setActiveDetail(null);
        setSelectedInvoiceId(null);
        setShowLauncher(false);
        await refreshInvoices();
      }
    } catch (err) {
      console.error("Reset demo error:", err);
    } finally {
      setIsResetting(false);
    }
  };

  const hasRuns = invoices.length > 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Persistent Navigation Header */}
      <Header
        onNewRun={() => setShowLauncher((prev) => !prev)}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
        hasRuns={hasRuns}
      />

      <main style={{ flex: 1, padding: "32px 24px" }}>
        {/* State 1: First visit — empty state (no runs, no active launch) */}
        {!hasRuns && !activeInvoiceId && !showLauncher && (
          <EmptyState onStartRun={() => setShowLauncher(true)} />
        )}

        {/* State 2: Starting a run (Two entry points visible at once) */}
        {showLauncher && (
          <RunLauncher
            testCases={testCases}
            onUploadFile={handleUploadFile}
            onRunTestCase={handleRunTestCase}
            isLaunching={isLaunching || Boolean(activeInvoiceId && liveStatus && !liveStatus.is_complete)}
          />
        )}

        {/* State 3: Live run panel (Stepper with real-time status polling) */}
        {liveStatus && (
          <LivePipelinePanel
            status={liveStatus}
            detail={activeDetail}
            onClose={() => {
              setLiveStatus(null);
              setActiveInvoiceId(null);
            }}
          />
        )}

        {/* State 4: Decision & Explainability Inspector */}
        {activeDetail && activeDetail.decision && (
          <DecisionInspector
            detail={activeDetail}
            onClose={() => setActiveDetail(null)}
          />
        )}

        {/* State 5: Invoices Dashboard (Review screen when runs exist) */}
        {hasRuns && (
          <InvoicesDashboard
            invoices={invoices}
            selectedInvoiceId={selectedInvoiceId}
            onSelectInvoice={handleSelectInvoice}
            onNewRun={() => setShowLauncher(true)}
          />
        )}
      </main>
    </div>
  );
}
