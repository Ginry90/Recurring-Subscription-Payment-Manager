# Stellar Recurring Subscription Payment Manager (Astralis Pay)

An advanced, decentralized subscription billing application built on the Stellar network. Astralis Pay empowers contract owners to establish recurring subscription plans (monthly/weekly/daily) with fixed on-chain XLM fees, and allows subscribers to seamlessly authorize automatic collections or perform manual renewals. 

By employing a hybrid payment engine (Prepaid Escrow balances for automatic operator draws, and Direct Wallet calls for manual signatures), this project elegantly navigates Stellar's cryptographic authentication (`require_auth`) rules, delivering a fully non-custodial, recurring payment experience on the blockchain.

---

## Deployed Contract (Stellar Testnet)
- **Contract ID**: `CB5O37WBSY22AH4E2VNHBAINWDEOCA2N4EGI6YL2K4K5DQ46AVDVK26Z`
- **Explorer Link**: [https://stellar.expert/explorer/testnet/contract/CB5O37WBSY22AH4E2VNHBAINWDEOCA2N4EGI6YL2K4K5DQ46AVDVK26Z](https://stellar.expert/explorer/testnet/contract/CB5O37WBSY22AH4E2VNHBAINWDEOCA2N4EGI6YL2K4K5DQ46AVDVK26Z)

---

## Tech Stack
- **Smart Contract**: Rust language using Stellar's official Soroban SDK (`21.0.0`) for memory-efficient and secure on-chain state transitions.
- **Frontend**: Next.js 14 App Router with TypeScript for robust, server-rendered components.
- **Styling**: Tailored, modern dark-themed styling with Tailwind CSS and CSS-keyframe transitions.
- **Wallet Connection**: Freighter Browser Extension integration using the official `@stellar/freighter-api`.
- **SDK & RPC client**: `@stellar/stellar-sdk` utilizing the modern `SorobanRpc.Server` and Horizon submitters targeting the official Stellar Testnet environment.

---

## Prerequisites
Before you begin, ensure you have the following installed on your machine:
- **Rust**: Version 1.74.0+ (Install: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **WebAssembly target**: `rustup target add wasm32-unknown-unknown`
- **Stellar CLI**: Installed and locked to version (Install: `cargo install --locked stellar-cli --features opt`)
- **Node.js**: Version 18.0.0+ (or Bun version 1.1.0+ as a package manager)
- **Freighter Wallet**: Installed inside your web browser (Chrome, Brave, Firefox, Edge) from [Freighter App](https://freighter.app).

---

## Project Structure
Below is the directory structure detailing every file and folder in the project:

```
/contracts
  /src
    lib.rs               <-- Soroban Rust contract (plan storage, escrow ledgers, events, and unit tests)
  Cargo.toml             <-- Rust package metadata, CDYLIB specifications, and dependencies
/frontend
  /app
    globals.css          <-- Custom base configurations, premium scrollbars, and keyframe animations
    layout.tsx           <-- Next.js root layout with high-fidelity dark styling and metadata SEO tokens
    page.tsx             <-- App dashboard layout incorporating shared states and workflows
  /components
    WalletConnect.tsx    <-- Freighter connector interface, G-address truncators, and Friendbot funder
    MainFeature.tsx      <-- Subscription Marketplace, Escrow deposits/withdrawals, and Admin panels
  /lib
    stellar.ts           <-- Freighter integration, Horizon submission client, and Friendbot calls
    contract.ts          <-- Soroban RPC client, simulation handlers, and binary ScVal converters
  /types
    index.ts             <-- Typings for Plans, Subscriptions, and wallet payloads
  package.json           <-- Node dependency specifications for Tailwind, TypeScript, and Stellar SDKs
  tailwind.config.ts     <-- Extended Tailwind configurations for custom fonts and color layouts
  next.config.mjs        <-- Standard Next.js server configuration
.env.example             <-- Workspace environment template
README.md                <-- Thorough installation, building, deployment, and usage manual
```

---

## Step 1 — Build the Smart Contract
1. Navigate into the `contracts` directory:
   ```bash
   cd contracts
   ```
2. Build the optimized WebAssembly binary:
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ```
   **Output**: This compiles your contract and produces the optimized `.wasm` file located at:
   `target/wasm32-unknown-unknown/release/recurring_subs.wasm`

---

## Step 2 — Set Up a Testnet Identity
Use the Stellar CLI to generate a secure cryptographic keypair on the Stellar Testnet:
```bash
stellar keys generate --global my-key --network testnet
```
Verify the generated public G-address:
```bash
stellar keys address my-key
```
*Note: Generating a key through Stellar CLI automatically funds your new account with 10,000 Testnet XLM using the Friendbot service!*

---

## Step 3 — Deploy Contract to Testnet
1. Deploy your smart contract WebAssembly binary to the Testnet network:
   ```bash
   stellar contract deploy \
     --wasm target/wasm32-unknown-unknown/release/recurring_subs.wasm \
     --source my-key \
     --network testnet
   ```
2. **Copy the Contract ID**: The CLI will return the contract address ID. For this deployment, the ID is:
   `CB5O37WBSY22AH4E2VNHBAINWDEOCA2N4EGI6YL2K4K5DQ46AVDVK26Z`

---

## Step 4 — Install Frontend Dependencies
1. Navigate into the `frontend` directory:
   ```bash
   cd ../frontend
   ```
2. Install all Node.js dependencies using `bun` (or `npm` if preferred):
   ```bash
   bun install
   ```
   *Note: This downloads and installs React, Tailwind CSS, `@stellar/stellar-sdk`, and the `@stellar/freighter-api` interface.*

---

## Step 5 — Configure Environment Variables
1. Create a local environment file by copying our template:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and paste your deployed Contract ID from **Step 3** into the `NEXT_PUBLIC_CONTRACT_ID` variable:
   ```env
   NEXT_PUBLIC_CONTRACT_ID=CB5O37WBSY22AH4E2VNHBAINWDEOCA2N4EGI6YL2K4K5DQ46AVDVK26Z
   ```

---

## Step 6 — Run the Frontend
1. Start the Next.js local development server:
   ```bash
   bun dev
   ```
2. Open [http://localhost:3000](http://localhost:3000) inside your web browser.

---

## Step 7 — Using the App
To interact with Astralis Pay:
1. **Configure Wallet**: Open the Freighter extension in your browser, click **Settings (Gear Icon)** &rarr; **Network** &rarr; Select **Testnet**.
2. **Connect Wallet**: Click the **Connect Freighter Wallet** button in the top-right corner of the Astralis dashboard.
3. **Friendbot Funding**: If your Freighter address has no XLM, click the glowing **Get Testnet XLM** button to instantly credit your address with 10,000 testnet tokens.
4. **Contract Initialization (Owner Only)**:
   - If deploying a brand new contract instance, go to the **Admin Panel** tab.
   - Enter your Freighter G-address in the "Owner" input.
   - Enter the native Stellar asset contract ID (`CDLZFC3SYJYDZT7K67VZ75HPJGWGCLU2PCUAJ74F7CH7SU44F573WOE2`) in the "Token" input.
   - Click **Initialize** and approve the Freighter prompt.
5. **Create Subscription Plans (Owner Only)**:
   - Inside the **Admin Panel** tab, enter a Plan ID (e.g., `1`), Name (e.g., `Monthly Premium`), Price (e.g., `15` XLM), and select your billing interval.
   - Click **Register Plan** and approve the Freighter prompt to store the plan on-chain.
6. **User Subscription**:
   - Navigate to the **Subscription Plans** tab, locate your newly created plan, and click **Subscribe Now**.
   - Approve the Freighter wallet transaction. This transfers the first interval's fee directly to the owner's account and starts your active subscription.
7. **Deposit Escrow (Auto-Billing)**:
   - Navigate to the **Prepaid Escrow** tab.
   - Enter an amount (e.g., `50` XLM) and click **Deposit**. Approve in Freighter.
   - Your prepaid escrow balance inside the contract increases.
8. **Collect Recurring Fees (Owner Only)**:
   - Once a subscription passes its due date, the owner can navigate to **Admin Panel** &rarr; **System-Wide Subscribers**.
   - Click **Collect Payment** next to a subscriber's row.
   - The contract automatically deducts the fee from the subscriber's contract balance, sends it to the owner, and advances the subscription's next due date.

---

## Smart Contract Functions

| Function Name | Parameters | Access | Description | Type |
| :--- | :--- | :--- | :--- | :--- |
| `initialize` | `owner: Address`, `token: Address` | Public (Once) | Initializes the owner and XLM contract addresses. | Write |
| `register_plan` | `plan_id: u32`, `fee: i128`, `interval: u64`, `name: Symbol` | Owner | Registers a subscription plan with a billing interval. | Write |
| `subscribe` | `user: Address`, `plan_id: u32` | User | Subscribes a user, pulling first interval fee directly. | Write |
| `deposit_funds` | `user: Address`, `amount: i128` | User | Deposits XLM into contract escrow for automated billing. | Write |
| `withdraw_funds` | `user: Address`, `amount: i128` | User | Withdraws unused prepaid escrow funds from the contract. | Write |
| `renew` | `user: Address`, `plan_id: u32` | User | Manually pays for the next interval from wallet. | Write |
| `collect_payment` | `owner: Address`, `user: Address`, `plan_id: u32` | Owner | Charges the subscriber's contract escrow when due. | Write |
| `cancel_subscription` | `user: Address`, `plan_id: u32` | User | Immediately deactivates a user's subscription. | Write |
| `get_owner` | None | Public | Returns the contract administrator's G-address. | Read |
| `get_token` | None | Public | Returns the configured payment token contract address. | Read |
| `get_plan` | `plan_id: u32` | Public | Returns specific plan structures registered on-chain. | Read |
| `get_subscription` | `user: Address`, `plan_id: u32` | Public | Returns active subscription status and next payment due. | Read |
| `get_user_balance` | `user: Address` | Public | Returns user escrow prepaid balance inside the contract. | Read |
| `get_all_plans` | None | Public | Returns a list of all plans registered on the contract. | Read |
| `get_all_subscriptions`| None | Public | Returns all system-wide subscribers. | Read |

---

## Common Errors & Fixes

### "Transaction simulation failed: Error"
- **Cause**: The smart contract is either uninitialized, or the contract ID in your `.env.local` is incorrect.
- **Fix**: Check that your contract is deployed on Testnet, update `NEXT_PUBLIC_CONTRACT_ID` in `.env.local`, and ensure you have run the **Initialize** step in the Admin Panel.

### "Freighter not found"
- **Cause**: The browser extension is missing or disabled.
- **Fix**: Install Freighter from [freighter.app](https://freighter.app) and reload your browser window.

### "Account not found / Not funded"
- **Cause**: Your Freighter wallet has never been activated on Testnet and contains 0 XLM.
- **Fix**: Click the **Get Testnet XLM** button to invoke the Friendbot faucet to initialize and credit your wallet.

### "wasm32 target not found"
- **Cause**: Your local Rust setup does not have the compilation target for WebAssembly.
- **Fix**: Run `rustup target add wasm32-unknown-unknown` inside your terminal.

---

## Testnet Resources
- **Stellar Testnet Explorer**: [Stellar.Expert Testnet](https://stellar.expert/explorer/testnet)
- **Stellar Lab**: [Stellar Laboratory](https://lab.stellar.org)
- **Friendbot Endpoint**: `https://friendbot.stellar.org/?addr=YOUR_ADDRESS`
