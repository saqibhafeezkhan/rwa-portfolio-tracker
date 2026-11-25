# RWA Portfolio Tracker

A modern Next.js dashboard for tracking tokenized real-world asset (RWA) holdings across multiple wallets and chains. The app aggregates wallet balances, displays portfolio value and performance, and surfaces allocation, chain distribution, protocol summaries, and live pricing data for a curated set of on-chain assets.

## What this project does

- Tracks wallet balances for supported EVM and Solana addresses
- Aggregates holdings into a single portfolio view
- Shows portfolio value, 24h change, allocation breakdown, and chain distribution
- Surfaces live price and market data for supported RWA-related assets
- Persists tracked wallets in browser storage for a personalized experience
- Includes automated scripts for syncing asset manifests and price data

## Tech stack

- Next.js 16 with the App Router
- React 18
- CSS modules/styles in the global stylesheet
- Viem for EVM chain interactions
- REST-style API routes for wallet balance and cron-driven price updates

## Features

- Multi-wallet portfolio tracking
- Live balance fetching from Alchemy, Helius, and viem-backed providers
- Tokenized asset manifests stored under the data directory
- Price refresh endpoints for Uniswap, USYC, Centrifuge, and ONDO-related ticker data
- Local wallet management with add/remove flows

## Project structure

```text
app/                # Next.js app routes and API endpoints
components/         # Reusable UI components for the dashboard
lib/                # Portfolio aggregation, wallet helpers, chain providers, price logic
data/               # Asset manifests and static data
public/             # Static assets
scripts/            # One-off sync and maintenance scripts
```

## Prerequisites

- Node.js 18+ recommended
- npm or pnpm

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file if you plan to use live wallet or price providers:

```bash
cp .env.example .env.local
```

   Next.js only reads `.env*` files. If you already have a file named `env` at the
   repo root, rename it to `.env.local` so it is loaded (and not committed).

3. Validate the asset manifests:

```bash
npm run validate:data
```

4. Start the development server:

```bash
npm run dev
```

5. Open http://localhost:3000 in your browser.

## Environment variables

The app can run with default seeded data, but live wallet balance and price updates require API keys.

Required or commonly used variables:

- `ALCHEMY_API_KEY` — used for Ethereum and EVM account balance lookups
- `HELIUS_API_KEY` — used for Solana wallet balance lookups
- `UNISWAP_API_KEY` — used for Uniswap-backed price lookups
- `UNISWAP_SWAPPER_ADDRESS` — optional swapper address used by some price scripts
- `CRON_SECRET` — shared secret that protects cron endpoints (the browser never receives it)
- `ETHEREUM_RPC_URL`, `POLYGON_RPC_URL`, `ARBITRUM_RPC_URL`, `BASE_RPC_URL`, `BNB_RPC_URL` — optional RPC overrides for viem balance reads

Wallet balances require `ALCHEMY_API_KEY` (Ethereum) or `HELIUS_API_KEY` (Solana).
Without them the dashboard still loads, but wallet balances cannot be fetched.
Market prices refresh from Ondo/Jupiter in the ticker route; the Uniswap,
Centrifuge, and USYC manifests are refreshed in the background at most every
five minutes.

## Tests

```bash
npm test              # node:test unit tests
npm run validate:data # validate every manifest contract address
```

## Available scripts

```bash
npm run dev            # Start the Next.js development server
npm run build          # Validate manifests + create a production build
npm run start          # Start the production server
npm test               # Run unit tests
npm run validate:data  # Validate manifest contract addresses
npm run sync:ondo      # Sync ONDO asset manifests
npm run sync:backed  # Sync backed assets data
npm run migrate:hourly  # Migrate hourly price history
npm run jupiter:backed  # Populate Jupiter-backed price data
npm run uniswap:gold    # Sync Uniswap gold price data
npm run sync:usyc        # Sync USYC stats
```

## API and data flow

- The main dashboard is rendered from the app entry page and uses client-side state to manage wallets and portfolio data. Seed prices/protocol metadata are passed from the server so full manifests are not bundled into client JS.
- Wallet balances are fetched through API routes under the app/api directory.
- `/api/ondo/ticker` is cached for 60s and coalesces provider calls; provider-priced manifests refresh in the background after the response (throttled to five minutes).
- Hourly history and 24h changes are appended by `POST /api/cron/hourly-prices`; schedule it hourly with `Authorization: Bearer $CRON_SECRET`.
- `npm run validate:data` (also run before builds) rejects malformed EVM/Solana addresses so tokens cannot silently disappear from holdings.
- Asset manifests and protocol metadata live under the data directory and are used to shape the UI.

## Deployment

This app is well suited for deployment on Vercel or any Node.js-capable hosting provider. Make sure your environment variables are configured in the deployment environment before enabling live data features.

## Notes

This repository started as a Vite-based implementation and has since been migrated to a Next.js application structure with a more modular component and API architecture.
