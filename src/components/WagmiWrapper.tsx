'use client';

// third party libs
import type { JSX, PropsWithChildren } from 'react';
import { WagmiProvider, http } from 'wagmi';
import * as chains from 'wagmi/chains';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const config = getDefaultConfig({
    appName: 'Quadrata Example App',
    projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!,
    ssr: true,
    chains: [
        chains.arbitrum,
        chains.arbitrumGoerli,
        chains.avalanche,
        chains.avalancheFuji,
        chains.base,
        chains.baseGoerli,
        chains.evmos,
        chains.evmosTestnet,
        chains.goerli,
        chains.hardhat,
        chains.mainnet,
        chains.optimism,
        chains.optimismGoerli,
        chains.polygon,
        chains.polygonMumbai,
        chains.sepolia,
        chains.zkSync,
        chains.zkSyncSepoliaTestnet,
    ],
    transports: {
        [chains.arbitrum.id]: http(),
        [chains.arbitrumGoerli.id]: http(),
        [chains.avalanche.id]: http(),
        [chains.avalancheFuji.id]: http(),
        [chains.base.id]: http(),
        [chains.baseGoerli.id]: http(),
        [chains.evmos.id]: http(),
        [chains.evmosTestnet.id]: http(),
        [chains.goerli.id]: http(),
        [chains.hardhat.id]: http(),
        [chains.mainnet.id]: http(),
        [chains.optimism.id]: http(),
        [chains.optimismGoerli.id]: http(),
        [chains.polygon.id]: http(),
        [chains.polygonMumbai.id]: http(),
        [chains.sepolia.id]: http(),
        [chains.zkSync.id]: http(),
        [chains.zkSyncSepoliaTestnet.id]: http(),
    },
});

const queryClient = new QueryClient();

export function WagmiWrapper(props: PropsWithChildren): JSX.Element {
    return (
        <QueryClientProvider client={queryClient}>
            <WagmiProvider config={config}>
                <RainbowKitProvider>
                    {props.children}
                </RainbowKitProvider>
            </WagmiProvider>
        </QueryClientProvider>
    );
}