# RWA Portfolio Tracker — Next.js

Converted from the original Vite vanilla-JS implementation.

## Stack

- **Next.js 14** (App Router)
- **React 18** (Client Components where interactivity is needed)
- Google Fonts loaded via `<link>` in `app/layout.js`

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
├── app/
│   ├── layout.js          # Root layout — fonts, metadata
│   ├── page.js            # Main page — owns wallet + drawer state
│   └── globals.css        # All styles (ported from style.css)
├── components/
│   ├── Header.jsx         # Logo, chain pills, wallets button
│   ├── Ticker.jsx         # Scrolling price ticker
│   ├── KpiStrip.jsx       # 4-cell KPI strip with count-up animation
│   ├── AllocationPanel.jsx # SVG donut chart
│   ├── ChainPanel.jsx     # Chain distribution bars
│   ├── ActivityPanel.jsx  # Recent activity feed
│   ├── HoldingsTable.jsx  # Filterable holdings table
│   ├── ProtocolCards.jsx  # Protocol summary grid
│   ├── YieldStrip.jsx     # APY yield strip
│   ├── AppFooter.jsx      # Footer with live clock
│   └── WalletDrawer.jsx   # Slide-in wallet manager drawer
├── lib/
│   ├── data.js            # All static data (tickers, holdings, etc.)
│   └── wallets.js         # Wallet helpers, CHAINS, add/remove logic
├── public/
│   └── favicon.svg
└── jsconfig.json          # Path alias: @/ → project root
```

## Migration Notes

| Vite / vanilla JS | Next.js / React |
|---|---|
| `innerHTML` DOM templating | JSX components |
| `addEventListener` event delegation | `onClick` / `onChange` props |
| `localStorage` singleton store | `useState` + `useEffect` hydration |
| Count-up via `setInterval` + DOM refs | `useCountUp` hook with React state |
| `setInterval` clock via DOM id | `useEffect` clock in `AppFooter` |
| Single `style.css` | `app/globals.css` (unchanged) |
| `vite.config.js` | `next.config.js` |
