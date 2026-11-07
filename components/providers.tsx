'use client';

import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { useStandardWalletAdapters } from '@solana/wallet-standard-wallet-adapter-react';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  return <ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed' }}><StandardProviders>{children}</StandardProviders></ConnectionProvider>;
}
function StandardProviders({ children }: { children: ReactNode }) {
  const wallets = useStandardWalletAdapters([]);
  return <WalletProvider wallets={wallets} autoConnect={false}>{children}</WalletProvider>;
}
