import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import { AuthProvider } from '../hooks/useAuth';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>ALTX Finance</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </>
  );
}
