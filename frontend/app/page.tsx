"use client";

import React, { useState } from "react";
import WalletConnect from "../components/WalletConnect";
import MainFeature from "../components/MainFeature";

export default function Home() {
  const [publicKey, setPublicKey] = useState<string>("");
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-neutral-950 overflow-hidden">
      {/* Background Decorative Mesh Gradients */}
      <div className="absolute top-0 left-0 right-0 h-[600px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(59,130,246,0.12),rgba(255,255,255,0))] pointer-events-none -z-10"></div>
      <div className="absolute top-[20%] right-[-10%] h-[350px] w-[350px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse"></div>
      <div className="absolute bottom-[10%] left-[-10%] h-[350px] w-[350px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none -z-10"></div>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
        
        {/* Sleek Premium Header */}
        <header className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-neutral-900">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)]">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength="1"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-neutral-100 via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
                Astralis Pay
              </h1>
              <p className="text-3xs font-semibold uppercase tracking-wider text-neutral-500 mt-0.5">
                Stellar Soroban Billing Escrow
              </p>
            </div>
          </div>

          <div className="text-xs text-neutral-400 max-w-xs text-left sm:text-right italic">
            &quot;Automated, decentralized billing agreements running natively on the Stellar Testnet.&quot;
          </div>
        </header>

        {/* 1. Wallet Status & Connect Widget */}
        <section className="w-full">
          <WalletConnect
            publicKey={publicKey}
            setPublicKey={setPublicKey}
            onRefresh={handleRefresh}
          />
        </section>

        {/* 2. Main Contract Lifecycles Dashboard */}
        <section className="w-full">
          <MainFeature
            publicKey={publicKey}
            refreshTrigger={refreshTrigger}
            onRefresh={handleRefresh}
          />
        </section>

        {/* 3. Interactive DApp Guide Section */}
        <section className="w-full p-8 rounded-2xl bg-neutral-900/20 border border-neutral-900 mt-6">
          <h3 className="text-lg font-bold text-neutral-200 mb-4 flex items-center gap-2">
            📖 How to Test the Subscription Manager
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-neutral-400">
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-neutral-900/30 border border-neutral-800/30">
              <div className="h-6 w-6 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                1
              </div>
              <h4 className="font-semibold text-neutral-300">Set Up Wallet</h4>
              <p className="text-xs leading-relaxed text-neutral-400">
                Install Freighter, switch to <strong>Testnet</strong> in Settings, connect your wallet, and click <strong>Get Testnet XLM</strong> to fund it with Friendbot.
              </p>
            </div>
            
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-neutral-900/30 border border-neutral-800/30">
              <div className="h-6 w-6 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                2
              </div>
              <h4 className="font-semibold text-neutral-300">Subscribe & Escrow</h4>
              <p className="text-xs leading-relaxed text-neutral-400">
                Subscribe to a Plan (weekly/monthly) which triggers the first payment directly from your wallet. Then, deposit extra funds into your <strong>Prepaid Escrow</strong> balance.
              </p>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded-xl bg-neutral-900/30 border border-neutral-800/30">
              <div className="h-6 w-6 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                3
              </div>
              <h4 className="font-semibold text-neutral-300">Automated Collection</h4>
              <p className="text-xs leading-relaxed text-neutral-400">
                In the Admin Panel, wait for the subscription to become due (or create a custom plan with a 5-min demo interval), then click <strong>Collect Payment</strong> as the owner to pull funds automatically.
              </p>
            </div>
          </div>
        </section>

      </div>

      {/* Modern Compact Footer */}
      <footer className="w-full py-6 border-t border-neutral-900 bg-neutral-950 mt-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div>
            &copy; {new Date().getFullYear()} Astralis Pay. Built on Stellar Soroban Smart Contracts.
          </div>
          <div className="flex gap-4">
            <a
              href="https://stellar.expert/explorer/testnet"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-300 transition-colors"
            >
              Testnet Explorer
            </a>
            <span>&bull;</span>
            <a
              href="https://lab.stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-300 transition-colors"
            >
              Stellar Lab
            </a>
            <span>&bull;</span>
            <a
              href="https://soroban-testnet.stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-300 transition-colors"
            >
              RPC Endpoint
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
