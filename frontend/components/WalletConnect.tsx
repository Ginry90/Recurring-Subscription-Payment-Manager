"use client";

import React, { useState, useEffect } from "react";
import { getFreighterPublicKey, fundWithFriendbot } from "../lib/stellar";

interface WalletConnectProps {
  publicKey: string;
  setPublicKey: (key: string) => void;
  onRefresh: () => void;
}

export default function WalletConnect({
  publicKey,
  setPublicKey,
  onRefresh,
}: WalletConnectProps) {
  const [connecting, setConnecting] = useState(false);
  const [funding, setFunding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Attempt to auto-connect to Freighter on load if already approved
  useEffect(() => {
    async function checkConnection() {
      try {
        const key = await getFreighterPublicKey();
        if (key) {
          setPublicKey(key);
        }
      } catch (err) {
        // Do not display auto-connect errors to keep UI clean
      }
    }
    checkConnection();
  }, [setPublicKey]);

  const handleConnect = async () => {
    setConnecting(true);
    setError("");
    setSuccess("");
    try {
      const key = await getFreighterPublicKey();
      setPublicKey(key);
      setSuccess("Wallet connected successfully!");
      onRefresh();
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setPublicKey("");
    setError("");
    setSuccess("Wallet disconnected");
  };

  const handleFund = async () => {
    if (!publicKey) return;
    setFunding(true);
    setError("");
    setSuccess("");
    try {
      await fundWithFriendbot(publicKey);
      setSuccess("Successfully funded G-address with 10,000 Testnet XLM!");
      onRefresh();
    } catch (err: any) {
      setError(err.message || "Friendbot funding failed");
    } finally {
      setFunding(false);
    }
  };

  // Helper to format public key
  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.substring(0, 4)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-xl transition-all duration-300">
      <div className="flex flex-col mb-4 md:mb-0">
        <h2 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">
          Stellar Network Status
        </h2>
        <div className="flex items-center mt-1">
          <span className="flex h-2.5 w-2.5 relative mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-lg font-medium text-neutral-200">Stellar Testnet</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {publicKey ? (
          <>
            {/* Wallet Address Display */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800/50">
              <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
              <span
                className="text-sm font-mono text-neutral-300 select-all cursor-pointer"
                title="Click to copy full G-address"
                onClick={() => {
                  navigator.clipboard.writeText(publicKey);
                  setSuccess("Address copied to clipboard!");
                }}
              >
                {formatAddress(publicKey)}
              </span>
            </div>

            {/* Friendbot funder */}
            <button
              onClick={handleFund}
              disabled={funding}
              className="px-4 py-2.5 rounded-xl font-medium text-sm text-black bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 shadow-[0_0_15px_rgba(45,212,191,0.2)] hover:shadow-[0_0_20px_rgba(45,212,191,0.4)] disabled:opacity-50 transition-all duration-300 flex items-center justify-center min-w-[140px]"
            >
              {funding ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-black"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Funding...
                </>
              ) : (
                "Get Testnet XLM"
              )}
            </button>

            {/* Disconnect wallet */}
            <button
              onClick={handleDisconnect}
              className="px-4 py-2.5 rounded-xl font-medium text-sm text-neutral-300 bg-neutral-800 hover:bg-neutral-750 transition-colors duration-200"
            >
              Disconnect
            </button>
          </>
        ) : (
          /* Connect Wallet Trigger */
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.25)] hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] disabled:opacity-50 transition-all duration-300 flex items-center justify-center"
          >
            {connecting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Connecting Wallet...
              </>
            ) : (
              "Connect Freighter Wallet"
            )}
          </button>
        )}
      </div>

      {/* Action Toasts */}
      {(error || success) && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm flex flex-col gap-2">
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/20 bg-red-950/80 text-red-200 text-sm backdrop-blur-xl shadow-2xl animate-fade-in">
              <svg className="h-5 w-5 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
              <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-200">
                &times;
              </button>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/80 text-emerald-200 text-sm backdrop-blur-xl shadow-2xl animate-fade-in">
              <svg className="h-5 w-5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{success}</span>
              <button onClick={() => setSuccess("")} className="ml-auto text-emerald-400 hover:text-emerald-200">
                &times;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
