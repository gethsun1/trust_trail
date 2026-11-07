export type WalletConnectionInput = { providerCount: number; connecting: boolean; connected: boolean; address?: string };
export type WalletConnectionState = { status: 'missing-provider' | 'connecting' | 'connected' | 'disconnected'; address?: string };
export function getWalletConnectionState(input: WalletConnectionInput): WalletConnectionState {
  if (!input.providerCount) return { status: 'missing-provider' };
  if (input.connecting) return { status: 'connecting' };
  if (input.connected && input.address) return { status: 'connected', address: input.address };
  return { status: 'disconnected' };
}
export function walletAccountChanged(previous?: string, current?: string) {
  return Boolean(previous && current && previous !== current);
}
