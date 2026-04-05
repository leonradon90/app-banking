import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import { AuthProvider } from '../hooks/useAuth';
import { PwaInstallPrompt } from '../components/PwaInstallPrompt';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>ALTX Finance</title>
        <meta
          name="description"
          content="ALTX Finance keeps accounts, transfers, cards, and alerts in one installable banking workspace."
        />
        <meta name="application-name" content="ALTX Finance" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ALTX Finance" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0f766e" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <AuthProvider>
        <Component {...pageProps} />
        <PwaInstallPrompt />
      </AuthProvider>
    </>
  );
}
