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

3. Start the development server:

```bash
npm run dev
```

4. Open http://localhost:3000 in your browser.

## Environment variables

The app can run with default seeded data, but live wallet balance and price updates require API keys.

Required or commonly used variables:

- `ALCHEMY_API_KEY` — used for Ethereum and EVM account balance lookups
- `HELIUS_API_KEY` — used for Solana wallet balance lookups
- `UNISWAP_API_KEY` — used for Uniswap-backed price lookups
- `UNISWAP_SWAPPER_ADDRESS` — optional swapper address used by some price scripts
- `CRON_SECRET` — optional shared secret for protecting cron endpoints

If you do not provide these variables, the UI may still load with seeded or cached data, but live data refreshes may be limited.

## Available scripts

```bash
npm run dev          # Start the Next.js development server
npm run build        # Create a production build
npm run start        # Start the production server
npm run sync:ondo    # Sync ONDO asset manifests
npm run sync:backed  # Sync backed assets data
npm run migrate:hourly  # Migrate hourly price history
npm run jupiter:backed  # Populate Jupiter-backed price data
npm run uniswap:gold    # Sync Uniswap gold price data
npm run sync:usyc        # Sync USYC stats
```

## API and data flow

- The main dashboard is rendered from the app entry page and uses client-side state to manage wallets and portfolio data.
- Wallet balances are fetched through API routes under the app/api directory.
- Price and market refresh logic is driven by cron-style endpoints and supporting scripts.
- Asset manifests and protocol metadata live under the data directory and are used to shape the UI.

## Deployment

This app is well suited for deployment on Vercel or any Node.js-capable hosting provider. Make sure your environment variables are configured in the deployment environment before enabling live data features.

## Notes

This repository started as a Vite-based implementation and has since been migrated to a Next.js application structure with a more modular component and API architecture.
