'use server';

import Image from 'next/image';
import { MainLayout } from '@/components/MainLayout';
import { Quadrata } from '@/components/quadrata/kyc/Quadrata';

import '@rainbow-me/rainbowkit/styles.css';
import '@quadrata/core-react/lib/cjs/quadrata-ui.min.css';

function getAccessToken() {
  return fetch(`${process.env.NEXT_PUBLIC_QUADRATA_API_URL}/v1/login`, {
    method: 'post',
    body: JSON.stringify({
      apiKey: process.env.QUADRATA_API_KEY,
    }),
    headers: {
      'Content-Type': 'application/json'
    },
    cache: 'no-cache'
  }).then(response => response.json());
}

export default async function Kyc() {
  const { data: { accessToken } } = await getAccessToken();
  return (
    <MainLayout>
        <h1 className="py-20 text-center text-3xl">
          Individual Onboarding
          <p className="pt-5 text-xs">
            <a
              href="https://docs.quadrata.com/integration/how-to-integrate/onboard-users/individual-passport-onboarding"
              target="_blank"
              className="hover:text-blue-400"
            >
              https://docs.quadrata.com/integration/how-to-integrate/onboard-users/individual-passport-onboarding
            </a>
          </p>
        </h1>
        <div className="flex flex-col items-center justify-between">
            <Quadrata 
              accessToken={accessToken}
            />
        </div>
    </MainLayout>
  );
}
