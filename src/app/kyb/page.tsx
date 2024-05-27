import Image from 'next/image';
import dynamic from 'next/dynamic';
import { MainLayout } from '@/components/MainLayout';

import '@rainbow-me/rainbowkit/styles.css';
import '@quadrata/core-react/lib/cjs/quadrata-ui.min.css';

// kyb-react is a client-only component and references `document` so we lazy load with ssr:false
const Quadrata = dynamic(() => 
  import('@/components/quadrata/kyb/Quadrata')
    .then(module => module.Quadrata), 
  { ssr: false }
);

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

export default async function Kyb() {
  const { data: { accessToken } } = await getAccessToken();
  return (
    <MainLayout>
        <h1 className="py-20 text-center text-3xl">
          Business Onboarding
          <p className="pt-5 text-xs">
            <a
              href="https://docs.quadrata.com/integration/how-to-integrate/onboard-users/business-passport-onboarding"
              target="_blank"
              className="hover:text-blue-400"
            >
              https://docs.quadrata.com/integration/how-to-integrate/onboard-users/business-passport-onboarding
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
