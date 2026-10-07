"use client";

import React from "react";
import { ShieldCheck, RefreshCw, PlusCircle, CheckCircle2 } from "lucide-react";

interface HeaderProps {
  onNewRun: () => void;
  onResetDemo: () => void;
  isResetting: boolean;
  hasRuns: boolean;
}

export function Header({ onNewRun, onResetDemo, isResetting, hasRuns }: HeaderProps) {
  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        background: "#ffffff",
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "12px 24px",
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        {/* Brand Identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              background: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 1px 3px rgba(37, 99, 235, 0.25)",
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "1.02rem",
                  letterSpacing: "-0.01em",
                  color: "var(--text-main)",
                }}
              >
                Invoice Decision Engine
              </span>
              <span
                className="badge badge-blue"
                style={{
                  fontSize: "0.68rem",
                  padding: "2px 6px",
                  fontWeight: 600,
                }}
              >
                ZAPP.AI
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.72rem",
                  color: "var(--approved-text)",
                  fontWeight: 500,
                  marginLeft: 4,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--approved)",
                  }}
                />
                Live Engine
              </span>
            </div>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--text-dim)",
                marginTop: -1,
              }}
            >
              Deterministic 8-Rule AP Pipeline &middot; Vision & Text Extraction
            </p>
          </div>
        </div>

        {/* Global Header Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {hasRuns && (
            <button
              onClick={onResetDemo}
              disabled={isResetting}
              className="btn btn-secondary btn-sm"
              title="Reset database to clean state to demonstrate empty state"
              style={{ opacity: isResetting ? 0.6 : 1 }}
            >
              <RefreshCw size={13} className={isResetting ? "spin" : ""} />
              <span>{isResetting ? "Resetting..." : "Reset Demo Data"}</span>
            </button>
          )}

          <button
            onClick={onNewRun}
            className="btn btn-primary btn-sm"
            style={{ fontWeight: 600 }}
          >
            <PlusCircle size={14} />
            <span>Start New Run</span>
          </button>
        </div>
      </div>
    </header>
  );
}
