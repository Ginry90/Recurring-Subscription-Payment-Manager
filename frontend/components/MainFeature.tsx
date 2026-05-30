"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plan, Subscription } from "../types";
import * as contract from "../lib/contract";

// Stellar native testnet asset contract ID (XLM)
const DEFAULT_NATIVE_TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJGWGCLU2PCUAJ74F7CH7SU44F573WOE2";

interface MainFeatureProps {
  publicKey: string;
  refreshTrigger: number;
  onRefresh: () => void;
}

export default function MainFeature({
  publicKey,
  refreshTrigger,
  onRefresh,
}: MainFeatureProps) {
  const [activeTab, setActiveTab] = useState<"plans" | "subs" | "escrow" | "admin">("plans");
  
  // Contract States
  const [owner, setOwner] = useState<string>("");
  const [tokenAddress, setTokenAddress] = useState<string>("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [userSubscriptions, setUserSubscriptions] = useState<Subscription[]>([]);
  const [systemSubscriptions, setSystemSubscriptions] = useState<Subscription[]>([]);
  const [escrowBalance, setEscrowBalance] = useState<string>("0");
  
  // Loading & Feedback States
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");

  // Input Form States
  const [initOwner, setInitOwner] = useState<string>("");
  const [initToken, setInitToken] = useState<string>(DEFAULT_NATIVE_TOKEN);

  const [newPlanId, setNewPlanId] = useState<string>("");
  const [newPlanName, setNewPlanName] = useState<string>("");
  const [newPlanFee, setNewPlanFee] = useState<string>("");
  const [newPlanInterval, setNewPlanInterval] = useState<string>("604800"); // Default weekly

  const [depositAmount, setDepositAmount] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");

  // Fetch all system and user data from the contract
  const loadContractData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Fetch Owner (will throw if not initialized)
      let currentOwner = "";
      try {
        currentOwner = await contract.getOwner();
        setOwner(currentOwner);
      } catch (err: any) {
        console.warn("Contract not initialized:", err.message);
      }

      // If initialized, load other details
      if (currentOwner) {
        const currentToken = await contract.getToken();
        setTokenAddress(currentToken);

        const allPlans = await contract.getAllPlans();
        setPlans(allPlans);

        const allSubs = await contract.getAllSubscriptions();
        setSystemSubscriptions(allSubs);

        if (publicKey) {
          // Filter subscriptions for active user
          const filtered = allSubs.filter(
            (sub) => sub.user.toLowerCase() === publicKey.toLowerCase()
          );
          setUserSubscriptions(filtered);

          const balance = await contract.getUserBalance(publicKey);
          setEscrowBalance(balance);
        } else {
          setUserSubscriptions([]);
          setEscrowBalance("0");
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to query smart contract state.");
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  // Load data on mount and whenever public key or refresh trigger changes
  useEffect(() => {
    loadContractData();
    if (publicKey && !initOwner) {
      setInitOwner(publicKey);
    }
  }, [loadContractData, publicKey, refreshTrigger, initOwner]);

  const handleAction = async (
    name: string,
    actionFn: () => Promise<any>
  ) => {
    setActionLoading(name);
    setError("");
    setSuccess("");
    setTxHash("");
    try {
      const res = await actionFn();
      setSuccess(`${name} transaction executed successfully!`);
      if (res && res.hash) {
        setTxHash(res.hash);
      }
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || `${name} failed. Please try again.`);
    } finally {
      setActionLoading(null);
    }
  };

  // --- CONTRACT STATE WRITE TRANSACTIONS ---

  const handleInitialize = () => {
    if (!publicKey) return;
    handleAction("Initialize Contract", () =>
      contract.initialize(publicKey, initOwner, initToken)
    );
  };

  const handleRegisterPlan = () => {
    if (!publicKey) return;
    const planId = parseInt(newPlanId);
    const intervalSec = parseInt(newPlanInterval);
    if (isNaN(planId) || !newPlanName || !newPlanFee || isNaN(intervalSec)) {
      setError("Please fill out all plan fields correctly.");
      return;
    }
    handleAction("Register Plan", () =>
      contract.registerPlan(publicKey, planId, newPlanFee, intervalSec, newPlanName)
    );
  };

  const handleSubscribe = (planId: number) => {
    if (!publicKey) {
      setError("Please connect your Freighter wallet to subscribe.");
      return;
    }
    handleAction(`Subscribe to Plan #${planId}`, () =>
      contract.subscribe(publicKey, planId)
    );
  };

  const handleDeposit = () => {
    if (!publicKey || !depositAmount) return;
    handleAction("Deposit Escrow Funds", () =>
      contract.depositFunds(publicKey, depositAmount)
    ).then(() => setDepositAmount(""));
  };

  const handleWithdraw = () => {
    if (!publicKey || !withdrawAmount) return;
    handleAction("Withdraw Escrow Funds", () =>
      contract.withdrawFunds(publicKey, withdrawAmount)
    ).then(() => setWithdrawAmount(""));
  };

  const handleRenew = (planId: number) => {
    if (!publicKey) return;
    handleAction("Manual Wallet Renewal", () =>
      contract.renew(publicKey, planId)
    );
  };

  const handleCancel = (planId: number) => {
    if (!publicKey) return;
    handleAction("Cancel Subscription", () =>
      contract.cancelSubscription(publicKey, planId)
    );
  };

  const handleCollect = (subscriber: string, planId: number) => {
    if (!publicKey) return;
    handleAction(`Collect Payment from ${subscriber.substring(0, 6)}...`, () =>
      contract.collectPayment(publicKey, subscriber, planId)
    );
  };

  // --- FORMATTING HELPERS ---

  const formatInterval = (seconds: number) => {
    if (seconds === 604800) return "Weekly";
    if (seconds === 2592000) return "Monthly";
    if (seconds === 86400) return "Daily";
    // General fallback
    const days = Math.round(seconds / 86400);
    return `${days} Days`;
  };

  const formatDate = (timestamp: number) => {
    if (timestamp === 0) return "Never";
    return new Date(timestamp * 1000).toLocaleString();
  };

  const isExpired = (nextDue: number) => {
    return Date.now() / 1000 > nextDue;
  };

  // Truncate address for displaying
  const trunc = (addr: string) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <div className="w-full flex flex-col gap-6 mt-2">
      {/* Transaction alerts */}
      {(success || error) && (
        <div className={`p-4 rounded-xl border backdrop-blur-md animate-fade-in ${
          error ? "bg-red-950/40 border-red-500/25 text-red-200" : "bg-emerald-950/40 border-emerald-500/25 text-emerald-200"
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{error ? "⚠️" : "🚀"}</span>
            <div className="flex-1">
              <p className="font-semibold text-sm">{error ? "Error Encountered" : "Action Successful"}</p>
              <p className="text-xs text-neutral-300 mt-0.5">{error || success}</p>
              {txHash && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs font-mono text-cyan-400 hover:text-cyan-300 underline mt-1"
                >
                  Tx Hash: {trunc(txHash)}
                </a>
              )}
            </div>
            <button
              onClick={() => {
                setError("");
                setSuccess("");
                setTxHash("");
              }}
              className="text-neutral-400 hover:text-neutral-200 text-sm ml-auto p-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Contract initialization banner (if uninitialized) */}
      {!owner && !loading && (
        <div className="w-full p-6 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                <span className="animate-pulse h-2 w-2 rounded-full bg-indigo-400"></span>
                On-Chain Contract Uninitialized
              </h3>
              <p className="text-sm text-neutral-300 mt-1">
                The smart contract is deployed but requires an owner and native token asset configuration to start.
              </p>
            </div>
            {publicKey ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 min-w-[320px]">
                <div className="flex-1 flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Owner Address"
                    value={initOwner}
                    onChange={(e) => setInitOwner(e.target.value)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-indigo-500 text-neutral-300"
                  />
                  <input
                    type="text"
                    placeholder="Native Token Address"
                    value={initToken}
                    onChange={(e) => setInitToken(e.target.value)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-indigo-500 text-neutral-300"
                  />
                </div>
                <button
                  onClick={handleInitialize}
                  disabled={actionLoading !== null}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors duration-200 flex items-center justify-center whitespace-nowrap shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                >
                  {actionLoading === "Initialize Contract" ? "Initializing..." : "Initialize"}
                </button>
              </div>
            ) : (
              <span className="text-xs text-neutral-400 italic">Connect Freighter wallet to initialize contract</span>
            )}
          </div>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="w-full flex border-b border-neutral-800">
        <button
          onClick={() => setActiveTab("plans")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors duration-200 flex items-center gap-2 ${
            activeTab === "plans"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          🌐 Subscription Plans
        </button>
        <button
          onClick={() => setActiveTab("subs")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors duration-200 flex items-center gap-2 ${
            activeTab === "subs"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          💳 My Subscriptions ({userSubscriptions.length})
        </button>
        <button
          onClick={() => setActiveTab("escrow")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors duration-200 flex items-center gap-2 ${
            activeTab === "escrow"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          🔐 Prepaid Escrow ({escrowBalance} XLM)
        </button>
        <button
          onClick={() => setActiveTab("admin")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors duration-200 flex items-center gap-2 ${
            activeTab === "admin"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          ⚙️ Admin Panel
        </button>
      </div>

      {/* Loading Spinner */}
      {loading ? (
        <div className="w-full py-20 flex flex-col items-center justify-center">
          <svg className="animate-spin h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium text-neutral-400 mt-4">Syncing with Soroban Ledger...</span>
        </div>
      ) : (
        <div className="w-full py-2">
          {/* TAB 1: PLANS MARKETPLACE */}
          {activeTab === "plans" && (
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="text-xl font-bold text-neutral-100">Subscription Marketplace</h3>
                <p className="text-sm text-neutral-400 mt-1">
                  Discover registered plans. Subscribing triggers an immediate payment directly from your wallet.
                </p>
              </div>

              {plans.length === 0 ? (
                <div className="w-full p-10 rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/20 text-center text-neutral-500">
                  No subscription plans are registered on-chain yet. Owner can create them under the Admin tab.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {plans.map((plan) => {
                    const isSubbed = userSubscriptions.some((s) => s.planId === plan.id && s.active);
                    return (
                      <div
                        key={plan.id}
                        className="flex flex-col p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/60 hover:translate-y-[-2px] transition-all duration-300"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className="px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-550/10 rounded-md">
                            Plan ID #{plan.id}
                          </span>
                          <span className="text-xs text-neutral-500 font-mono">
                            {formatInterval(plan.interval)}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-neutral-100">{plan.name}</h4>
                        <div className="flex items-baseline gap-1.5 my-5">
                          <span className="text-3xl font-extrabold text-neutral-150 tracking-tight">
                            {plan.fee}
                          </span>
                          <span className="text-sm font-semibold text-neutral-400">XLM</span>
                          <span className="text-xs text-neutral-500 ml-1">
                            / {formatInterval(plan.interval).toLowerCase()}
                          </span>
                        </div>
                        <div className="mt-auto pt-4 border-t border-neutral-800/60">
                          {isSubbed ? (
                            <button
                              disabled
                              className="w-full py-2.5 rounded-xl font-medium text-xs text-emerald-300 bg-emerald-950/20 border border-emerald-500/25 flex items-center justify-center gap-1.5"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Active Subscription
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSubscribe(plan.id)}
                              disabled={actionLoading !== null}
                              className="w-full py-2.5 rounded-xl font-semibold text-xs text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors duration-200"
                            >
                              {actionLoading === `Subscribe to Plan #${plan.id}` ? "Subscribing..." : "Subscribe Now"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY SUBSCRIPTIONS */}
          {activeTab === "subs" && (
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="text-xl font-bold text-neutral-100">My Subscriptions</h3>
                <p className="text-sm text-neutral-400 mt-1">
                  Manage active on-chain subscription billing contracts and trigger manual renewals.
                </p>
              </div>

              {userSubscriptions.length === 0 ? (
                <div className="w-full p-10 rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/20 text-center text-neutral-500">
                  You do not have any active subscriptions. Subscribe to a plan under the Marketplace tab.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {userSubscriptions.map((sub) => {
                    const plan = plans.find((p) => p.id === sub.planId);
                    const expired = isExpired(sub.nextPaymentDue);
                    const statusText = !sub.active ? "Cancelled" : expired ? "Due / Lapsed" : "Active";
                    const statusClass = !sub.active
                      ? "text-neutral-400 bg-neutral-800/40 border-neutral-800"
                      : expired
                      ? "text-amber-400 bg-amber-950/20 border-amber-500/20"
                      : "text-emerald-400 bg-emerald-950/20 border-emerald-500/20";

                    return (
                      <div
                        key={sub.planId}
                        className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:bg-neutral-900/50 transition-colors duration-200"
                      >
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-3">
                            <h4 className="text-base font-bold text-neutral-100">
                              {plan ? plan.name : `Plan #${sub.planId}`}
                            </h4>
                            <span className={`px-2.5 py-0.5 rounded-full text-3xs font-semibold uppercase tracking-wider border ${statusClass}`}>
                              {statusText}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:flex sm:items-center gap-x-6 gap-y-1 text-xs text-neutral-400 mt-1">
                            <div>
                              <span className="text-neutral-500">Rate: </span>
                              <span className="font-semibold text-neutral-300 font-mono">
                                {plan ? `${plan.fee} XLM` : "Unknown"}
                              </span>
                            </div>
                            <div>
                              <span className="text-neutral-500">Frequency: </span>
                              <span className="font-semibold text-neutral-300">
                                {plan ? formatInterval(plan.interval) : "Unknown"}
                              </span>
                            </div>
                            <div>
                              <span className="text-neutral-500">Started: </span>
                              <span className="font-mono text-neutral-300">
                                {formatDate(sub.startTime)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                          <div className="flex flex-col text-left sm:text-right">
                            <span className="text-2xs text-neutral-500 uppercase tracking-wider font-semibold">
                              {expired ? "Lapsed On" : "Next Payment Due"}
                            </span>
                            <span className="text-sm font-mono text-neutral-200 font-semibold mt-0.5">
                              {formatDate(sub.nextPaymentDue)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {sub.active && (
                              <>
                                <button
                                  onClick={() => handleRenew(sub.planId)}
                                  disabled={actionLoading !== null}
                                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors duration-150"
                                  title="Renew instantly from Freighter wallet"
                                >
                                  {actionLoading === "Manual Wallet Renewal" ? "Renewing..." : "Renew (Wallet)"}
                                </button>
                                <button
                                  onClick={() => handleCancel(sub.planId)}
                                  disabled={actionLoading !== null}
                                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-red-400 bg-red-950/20 border border-red-500/25 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50 transition-all duration-150"
                                >
                                  Cancel Sub
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PREPAID ESCROW BALANCES */}
          {activeTab === "escrow" && (
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="text-xl font-bold text-neutral-100">Smart Contract Prepaid Escrow</h3>
                <p className="text-sm text-neutral-400 mt-1">
                  Fund your prepaid escrow balance in the contract to authorize automatic billing collections.
                </p>
              </div>

              {/* Balance Box */}
              <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-br from-indigo-550/10 to-blue-500/10 rounded-full blur-3xl -z-10"></div>
                <div className="flex flex-col">
                  <span className="text-xs text-neutral-400 uppercase tracking-wide font-semibold">
                    My Escrowed Funds (Prepaid Balance)
                  </span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-4xl font-extrabold text-neutral-100 tracking-tight font-mono">
                      {escrowBalance}
                    </span>
                    <span className="text-lg font-bold text-neutral-400">XLM</span>
                  </div>
                </div>
                <div className="text-xs text-neutral-400 max-w-sm border-l border-neutral-800 pl-4 py-1 italic leading-relaxed">
                  Funding this balance enables automated, decentralized subscription collections. The contract owner will be able to draw due fees directly from here.
                </div>
              </div>

              {/* Deposit/Withdraw Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Deposit Box */}
                <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/80">
                  <h4 className="text-sm font-bold text-neutral-300 mb-3 flex items-center gap-1.5">
                    📥 Deposit to Escrow
                  </h4>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        placeholder="Amount in XLM"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm font-mono text-neutral-200 focus:outline-none focus:border-blue-500 pr-12"
                      />
                      <span className="absolute right-4 top-3 text-xs text-neutral-500 font-bold uppercase">
                        XLM
                      </span>
                    </div>
                    <button
                      onClick={handleDeposit}
                      disabled={actionLoading !== null || !depositAmount}
                      className="px-5 py-2.5 rounded-xl text-xs font-semibold text-black bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 disabled:opacity-50 transition-all duration-200 h-10 flex items-center justify-center shrink-0 min-w-[100px]"
                    >
                      {actionLoading === "Deposit Escrow Funds" ? "Depositing..." : "Deposit"}
                    </button>
                  </div>
                </div>

                {/* Withdraw Box */}
                <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/80">
                  <h4 className="text-sm font-bold text-neutral-300 mb-3 flex items-center gap-1.5">
                    📤 Withdraw from Escrow
                  </h4>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        placeholder="Amount in XLM"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm font-mono text-neutral-200 focus:outline-none focus:border-blue-500 pr-12"
                      />
                      <span className="absolute right-4 top-3 text-xs text-neutral-500 font-bold uppercase">
                        XLM
                      </span>
                    </div>
                    <button
                      onClick={handleWithdraw}
                      disabled={actionLoading !== null || !withdrawAmount}
                      className="px-5 py-2.5 rounded-xl text-xs font-semibold text-neutral-300 bg-neutral-800 hover:bg-neutral-750 disabled:opacity-50 transition-colors duration-150 h-10 flex items-center justify-center shrink-0 min-w-[100px]"
                    >
                      {actionLoading === "Withdraw Escrow Funds" ? "Withdrawing..." : "Withdraw"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ADMIN PANEL */}
          {activeTab === "admin" && (
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="text-xl font-bold text-neutral-100">Contract Administrator Portal</h3>
                <p className="text-sm text-neutral-400 mt-1">
                  Manage registered subscription packages and execute recurring payments on-chain.
                </p>
              </div>

              {/* Status Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 text-xs text-neutral-400 flex flex-col gap-2">
                  <div>
                    <span className="text-neutral-500 block font-semibold uppercase tracking-wider text-3xs">Owner Address</span>
                    <span className="font-mono text-neutral-200 font-medium break-all select-all">{owner || "Uninitialized"}</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-neutral-500 block font-semibold uppercase tracking-wider text-3xs">Token Contract ID</span>
                    <span className="font-mono text-neutral-200 font-medium break-all select-all">{tokenAddress || "Uninitialized"}</span>
                  </div>
                </div>

                {/* Plan Creation Widget */}
                <div className="p-5 rounded-xl bg-neutral-900/40 border border-neutral-800 flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-neutral-200">Register New Subscription Plan</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Plan ID (e.g. 1)"
                      value={newPlanId}
                      onChange={(e) => setNewPlanId(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono focus:outline-none focus:border-blue-500 text-neutral-300"
                    />
                    <input
                      type="text"
                      placeholder="Plan Name (e.g. Premium)"
                      value={newPlanName}
                      onChange={(e) => setNewPlanName(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:outline-none focus:border-blue-500 text-neutral-300"
                    />
                    <input
                      type="number"
                      placeholder="Price in XLM"
                      value={newPlanFee}
                      onChange={(e) => setNewPlanFee(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:outline-none focus:border-blue-500 text-neutral-300"
                    />
                    <select
                      value={newPlanInterval}
                      onChange={(e) => setNewPlanInterval(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:outline-none focus:border-blue-500 text-neutral-400"
                    >
                      <option value="604800">Weekly (7 Days)</option>
                      <option value="2592000">Monthly (30 Days)</option>
                      <option value="86400">Daily (1 Day - Demo)</option>
                      <option value="300">5 Mins (Demo)</option>
                    </select>
                  </div>
                  <button
                    onClick={handleRegisterPlan}
                    disabled={actionLoading !== null}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors duration-150 shadow-[0_0_15px_rgba(37,99,235,0.2)]"
                  >
                    {actionLoading === "Register Plan" ? "Registering Plan..." : "Register Plan"}
                  </button>
                </div>
              </div>

              {/* Global Subscribers List Table */}
              <div className="flex flex-col gap-3">
                <h4 className="text-base font-bold text-neutral-200">System-Wide Subscribers</h4>
                {systemSubscriptions.length === 0 ? (
                  <div className="w-full p-8 rounded-xl border border-neutral-800 bg-neutral-900/10 text-center text-xs text-neutral-500">
                    No active subscribers found in this contract instance.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950/40">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400 uppercase font-semibold tracking-wider text-3xs">
                          <th className="p-4">Subscriber</th>
                          <th className="p-4">Plan Name</th>
                          <th className="p-4">Next Payment Due</th>
                          <th className="p-4 text-center">Status</th>
                          <th className="p-4 text-right">Escrow Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/50 text-neutral-300">
                        {systemSubscriptions.map((sub) => {
                          const plan = plans.find((p) => p.id === sub.planId);
                          const expired = isExpired(sub.nextPaymentDue);
                          const isCollector =
                            owner.toLowerCase() === publicKey.toLowerCase() && expired && sub.active;

                          return (
                            <tr key={sub.user + sub.planId} className="hover:bg-neutral-900/20 transition-colors">
                              <td className="p-4 font-mono font-medium">{trunc(sub.user)}</td>
                              <td className="p-4 font-medium">
                                {plan ? `${plan.name} (Plan #${plan.id})` : `Plan #${sub.planId}`}
                              </td>
                              <td className="p-4 font-mono font-medium">{formatDate(sub.nextPaymentDue)}</td>
                              <td className="p-4 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-3xs font-semibold border ${
                                    !sub.active
                                      ? "text-neutral-400 border-neutral-800 bg-neutral-800/10"
                                      : expired
                                      ? "text-amber-400 border-amber-500/20 bg-amber-950/20"
                                      : "text-emerald-400 border-emerald-500/20 bg-emerald-950/20"
                                  }`}
                                >
                                  {!sub.active ? "Cancelled" : expired ? "Due" : "Paid"}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                {isCollector ? (
                                  <button
                                    onClick={() => handleCollect(sub.user, sub.planId)}
                                    disabled={actionLoading !== null}
                                    className="px-3 py-1.5 rounded-lg text-3xs font-semibold text-black bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 disabled:opacity-50 transition-all duration-150"
                                  >
                                    {actionLoading === `Collect Payment from ${sub.user.substring(0, 6)}...`
                                      ? "Collecting..."
                                      : "Collect Payment"}
                                  </button>
                                ) : (
                                  <span className="text-3xs text-neutral-500 italic">
                                    {!sub.active
                                      ? "Inactive"
                                      : !expired
                                      ? "Not Due"
                                      : "Owner Only Collection"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
