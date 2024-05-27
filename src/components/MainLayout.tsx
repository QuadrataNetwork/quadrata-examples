// third party libs
import type { JSX, PropsWithChildren } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

// local libs
import { WagmiWrapper } from '@/components/WagmiWrapper';

export function MainLayout({ children }: PropsWithChildren): JSX.Element {
    return (
        <WagmiWrapper>
            <div>
                <div className="w-full text-right p-5">
                    <span className="inline-block">
                        <ConnectButton/>
                    </span>
                </div>
                <main>
                    <div className="px-8">
                        {children}
                    </div>
                </main>
            </div>
        </WagmiWrapper>
    );
}