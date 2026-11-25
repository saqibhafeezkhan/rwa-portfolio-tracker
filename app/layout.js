import './globals.css';

export const metadata = {
  title: 'RWA Portfolio Tracker',
  description: 'Real World Assets · Cross-Chain Portfolio Dashboard',
};

/** Async layout — unwrap `params` / `searchParams` Promises when present (Next.js 15+). */
export default async function RootLayout(props) {
  const { children } = props;
  if (props.params) await props.params;
  if (props.searchParams) await props.searchParams;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
