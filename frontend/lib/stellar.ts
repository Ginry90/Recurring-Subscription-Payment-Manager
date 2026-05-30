import { isConnected, getAddress, signTransaction } from "@stellar/freighter-api";
import { Horizon, Transaction } from "@stellar/stellar-sdk";

export function getNetworkConfig() {
  return {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    horizonUrl: "https://horizon-testnet.stellar.org",
  };
}

export async function getFreighterPublicKey(): Promise<string> {
  const connected = await isConnected();
  if (!connected) {
    throw new Error("Freighter extension is not installed or enabled");
  }

  const result = await getAddress();
  if (!result || !result.address) {
    throw new Error("Freighter wallet is locked or user rejected the connection");
  }

  return result.address;
}

export async function signAndSubmitTransaction(xdr: string): Promise<any> {
  const config = getNetworkConfig();
  const publicKey = await getFreighterPublicKey();

  // Sign transaction using Freighter
  const signedXdr = await signTransaction(xdr, {
    networkPassphrase: config.networkPassphrase,
    address: publicKey,
  });

  if (!signedXdr) {
    throw new Error("User cancelled or rejected transaction signing");
  }

  let xdrToSubmit = "";
  if (typeof signedXdr === "string") {
    xdrToSubmit = signedXdr;
  } else {
    if (signedXdr.error) {
      throw new Error(`Freighter signing error: ${signedXdr.error}`);
    }
    xdrToSubmit = signedXdr.signedTxXdr;
  }

  if (!xdrToSubmit) {
    throw new Error("Transaction signing yielded empty envelope");
  }

  // Load the transaction and submit to Horizon Testnet
  const server = new Horizon.Server(config.horizonUrl);
  const tx = new Transaction(xdrToSubmit, config.networkPassphrase);
  
  const response = await server.submitTransaction(tx);
  return response;
}

export async function fundWithFriendbot(publicKey: string): Promise<boolean> {
  const url = `https://friendbot.stellar.org/?addr=${encodeURIComponent(publicKey)}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Friendbot funding failed: ${errorText || response.statusText}`);
  }
  return true;
}
