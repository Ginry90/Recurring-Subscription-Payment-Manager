import {
  Contract,
  TransactionBuilder,
  Account,
  rpc as SorobanRpc,
  scValToNative,
  nativeToScVal,
  Address,
  xdr,
  Horizon
} from "@stellar/stellar-sdk";
import { getNetworkConfig, signAndSubmitTransaction } from "./stellar";
import { Plan, Subscription } from "../types";

// Read contract ID from environment variable
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";

// Initialize Soroban RPC Server
const config = getNetworkConfig();
const rpcServer = new SorobanRpc.Server(config.rpcUrl);

/**
 * Helper to check if the contract ID is configured.
 */
function checkContractId() {
  if (!CONTRACT_ID) {
    throw new Error(
      "Smart contract ID (NEXT_PUBLIC_CONTRACT_ID) is not set in environment variables. Please deploy the contract first."
    );
  }
}

/**
 * Helper to convert decimal XLM string into BigInt stroops.
 * 1 XLM = 10,000,000 stroops (7 decimal places).
 */
function xlmToStroops(xlmAmount: string): bigint {
  const parsed = parseFloat(xlmAmount);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error("Invalid XLM amount provided");
  }
  return BigInt(Math.round(parsed * 10_000_000));
}

/**
 * Helper to convert BigInt stroops back into formatted decimal XLM string.
 */
function stroopsToXlm(stroops: bigint | number | string): string {
  const bigStroops = BigInt(stroops);
  const xlm = Number(bigStroops) / 10_000_000;
  return xlm.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 7,
    useGrouping: false,
  });
}

/**
 * Helper to run a read-only Soroban simulation.
 * It uses a dummy source account to bypass Horizon loadAccount calls.
 */
async function simulateCall(method: string, args: xdr.ScVal[] = []): Promise<any> {
  checkContractId();

  // Standard dummy public key for simulations (G-address syntax)
  const dummyPublicKey = "GAAZIUNRLGX7X6L6P36AY6G6P36AY6G6P36AY6G6P36AY6G6P36A";
  const source = new Account(dummyPublicKey, "0");
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(source, {
    fee: "100",
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const response = await rpcServer.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationSuccess(response)) {
    let scVal: xdr.ScVal | undefined;
    if (response.result) {
      scVal = response.result.retval;
    }

    if (!scVal) {
      return null;
    }
    return scValToNative(scVal);
  } else {
    throw new Error(
      `Simulation failed for ${method}: ${response.error || "unknown simulation error"}`
    );
  }
}

/**
 * Helper to build, simulate, estimate resources, sign, and submit a state-mutating contract transaction.
 */
async function invokeContract(
  userPublicKey: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<any> {
  checkContractId();

  // 1. Fetch current user account details from Horizon for sequence number
  const horizon = new Horizon.Server(config.horizonUrl);
  let sourceAccount: Account;
  try {
    sourceAccount = await horizon.loadAccount(userPublicKey);
  } catch (err) {
    throw new Error(
      "Your Stellar account was not found on Testnet. Please fund your account using the Friendbot button first."
    );
  }

  // 2. Build the initial transaction
  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(sourceAccount, {
    fee: "100", // Place holder fee
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  // 3. Simulate to calculate foot print and fees
  const simulated = await rpcServer.simulateTransaction(tx);
  if (!SorobanRpc.Api.isSimulationSuccess(simulated)) {
    throw new Error(
      `Transaction simulation failed: ${simulated.error || "contract execution error"}`
    );
  }

  // 4. Inject footprint, gas fees and resource limits into the transaction
  const preparedTx = await rpcServer.prepareTransaction(tx);

  // 5. Convert to XDR, sign with Freighter, and submit to Horizon
  const xdrString = preparedTx.toXDR();
  const response = await signAndSubmitTransaction(xdrString);
  return response;
}

// ==========================================
// PUBLIC MUTATING (WRITE) SMART CONTRACT METHODS
// ==========================================

export async function initialize(
  userPublicKey: string,
  owner: string,
  token: string
): Promise<any> {
  return invokeContract(userPublicKey, "initialize", [
    nativeToScVal(Address.fromString(owner)),
    nativeToScVal(Address.fromString(token)),
  ]);
}

export async function registerPlan(
  userPublicKey: string,
  planId: number,
  feeXlm: string,
  intervalSec: number,
  name: string
): Promise<any> {
  const stroops = xlmToStroops(feeXlm);
  return invokeContract(userPublicKey, "register_plan", [
    nativeToScVal(planId, { type: "u32" }),
    nativeToScVal(stroops, { type: "i128" }),
    nativeToScVal(intervalSec, { type: "u64" }),
    nativeToScVal(name, { type: "symbol" }),
  ]);
}

export async function subscribe(userPublicKey: string, planId: number): Promise<any> {
  return invokeContract(userPublicKey, "subscribe", [
    nativeToScVal(Address.fromString(userPublicKey)),
    nativeToScVal(planId, { type: "u32" }),
  ]);
}

export async function depositFunds(userPublicKey: string, amountXlm: string): Promise<any> {
  const stroops = xlmToStroops(amountXlm);
  return invokeContract(userPublicKey, "deposit_funds", [
    nativeToScVal(Address.fromString(userPublicKey)),
    nativeToScVal(stroops, { type: "i128" }),
  ]);
}

export async function withdrawFunds(userPublicKey: string, amountXlm: string): Promise<any> {
  const stroops = xlmToStroops(amountXlm);
  return invokeContract(userPublicKey, "withdraw_funds", [
    nativeToScVal(Address.fromString(userPublicKey)),
    nativeToScVal(stroops, { type: "i128" }),
  ]);
}

export async function renew(userPublicKey: string, planId: number): Promise<any> {
  return invokeContract(userPublicKey, "renew", [
    nativeToScVal(Address.fromString(userPublicKey)),
    nativeToScVal(planId, { type: "u32" }),
  ]);
}

export async function collectPayment(
  userPublicKey: string,
  subscriber: string,
  planId: number
): Promise<any> {
  return invokeContract(userPublicKey, "collect_payment", [
    nativeToScVal(Address.fromString(userPublicKey)), // owner address (matches connected user)
    nativeToScVal(Address.fromString(subscriber)),
    nativeToScVal(planId, { type: "u32" }),
  ]);
}

export async function cancelSubscription(userPublicKey: string, planId: number): Promise<any> {
  return invokeContract(userPublicKey, "cancel_subscription", [
    nativeToScVal(Address.fromString(userPublicKey)),
    nativeToScVal(planId, { type: "u32" }),
  ]);
}

// ==========================================
// PUBLIC READ-ONLY (GETTER) SMART CONTRACT METHODS
// ==========================================

export async function getOwner(): Promise<string> {
  const address = await simulateCall("get_owner");
  return address ? address.toString() : "";
}

export async function getToken(): Promise<string> {
  const address = await simulateCall("get_token");
  return address ? address.toString() : "";
}

export async function getPlan(planId: number): Promise<Plan | null> {
  const raw = await simulateCall("get_plan", [nativeToScVal(planId, { type: "u32" })]);
  if (!raw) return null;

  return {
    id: Number(raw.id),
    fee: stroopsToXlm(raw.fee),
    feeStroops: raw.fee.toString(),
    interval: Number(raw.interval),
    name: raw.name.toString(),
  };
}

export async function getSubscription(user: string, planId: number): Promise<Subscription | null> {
  const raw = await simulateCall("get_subscription", [
    nativeToScVal(Address.fromString(user)),
    nativeToScVal(planId, { type: "u32" }),
  ]);
  if (!raw) return null;

  return {
    user: raw.user.toString(),
    planId: Number(raw.plan_id),
    startTime: Number(raw.start_time),
    nextPaymentDue: Number(raw.next_payment_due),
    active: raw.active,
  };
}

export async function getUserBalance(user: string): Promise<string> {
  const raw = await simulateCall("get_user_balance", [
    nativeToScVal(Address.fromString(user)),
  ]);
  return raw ? stroopsToXlm(raw) : "0";
}

export async function getAllPlans(): Promise<Plan[]> {
  const rawList = await simulateCall("get_all_plans");
  if (!rawList || !Array.isArray(rawList)) return [];

  return rawList.map((raw: any) => ({
    id: Number(raw.id),
    fee: stroopsToXlm(raw.fee),
    feeStroops: raw.fee.toString(),
    interval: Number(raw.interval),
    name: raw.name.toString(),
  }));
}

export async function getAllSubscriptions(): Promise<Subscription[]> {
  const rawList = await simulateCall("get_all_subscriptions");
  if (!rawList || !Array.isArray(rawList)) return [];

  return rawList.map((raw: any) => ({
    user: raw.user.toString(),
    planId: Number(raw.plan_id),
    startTime: Number(raw.start_time),
    nextPaymentDue: Number(raw.next_payment_due),
    active: raw.active,
  }));
}
