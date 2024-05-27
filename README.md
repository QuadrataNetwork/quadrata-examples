This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

> Last updated `May 26, 2024`

# Quadrata Full Examples

This project implements the full examples found at the [Quadrata Documentation](https://docs.quadrata.com/integration/how-to-integrate/onboard-users)

Each onboarding section is in its own path under `src/app`.

From the browser at `http://localhost:3000`
- /all-in-one -> (All-In-One Passport Onboarding)[https://docs.quadrata.com/integration/how-to-integrate/onboard-users/all-in-one-passport-onboarding/4.-full-example]
- /kyb - (Business Passport Onboarding)[https://docs.quadrata.com/integration/how-to-integrate/onboard-users/business-passport-onboarding/4.-full-example]
- /kyc - (Individual Passport Onboarding)[https://docs.quadrata.com/integration/how-to-integrate/onboard-users/individual-passport-onboarding/6.-full-example]

The components matching each page can be found at `src/components`
- `src/components/quadrata/all-in-one/Quadrata.tsx`
- `src/components/quadrata/kyb/Quadrata.tsx`
- `src/components/quadrata/kyc/Quadrata.tsx`

> The Wagmi provider and wrapper components are located at `src/components/WagmiWrapper.tsx`

> Each page uses `src/components/MainLayout.tsx` which includes the `WagmiWrapper` and `Rainbowkit` connect button.

## Getting Started

1. Copy `.env.dist` to `.env.local`
1. Modfy `.env.local` with your API key, desired API URL and Wallet Connect Project ID.
1. Start the application by running `npm run dev` 
1. Navigate to the example you would like to experiement with (pages listed above or at `src/app/*`)

> Note: Every dApp that relies on WalletConnect now needs to obtain a projectId from WalletConnect Cloud. This is absolutely free and only takes a few minutes.

### Install dependencies

```bash
npm install
```

### Run the development server:

```bash
npm run dev
```

# Disclaimer

This is not a production ready application.

This NextJS application serves as an example for how to integrate the different Quadrata Onboarding Applications as described at 
(Onboard Users)[https://docs.quadrata.com/integration/how-to-integrate/onboard-users].

> Decide on the application flow you wish to support and modify the package.json dependencies so only the required packages are installed
> for your desired flow.