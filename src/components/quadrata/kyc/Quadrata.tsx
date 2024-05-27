'use client';

// third party libs
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parseUnits } from 'viem';
import {
  useAccount,
  useSignMessage,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract
} from 'wagmi';

// quadrata libs
import QUAD_PASSPORT_ABI from "@quadrata/contracts/abis/QuadPassport.json";
import {
  Page,
  PrivacyConsentScopeParamKey,
  PrivacyConsentScopeParams,
  QuadAttribute,
  QuadClient,
  QuadClientConfig,
  QuadClientEnvironment,
  QuadClientMintParamsReadyCallback,
  QuadMintParamsBigNumbers,
} from '@quadrata/client-react';
import { AttributeStatus, QuadSupportedChainId, QuadrataOnApplicationEndCallback } from '@quadrata/core-react';

const QUAD_PASSPORT_ADDRESS = '0x185cc335175B1E7E29e04A321E1873932379a4a0'; // Testnet

const QUADRATA_API_URL = process.env.NEXT_PUBLIC_QUADRATA_API_URL;

export interface AttributeOnboardStatusDto {
  data: {
    type: 'attributes';
    onboardStatus:{
      [attributeName: string]: {
        status: string;
        onboardedAt?: number;
        mintedOnchain?: boolean;
      };
    };
    offeringStatus?: {
      [attributeName: string]: {
        status: string;
        verifiedAt?: number;
      };
    };
    privacyStatus?: {
      [privacyPermission: string]: {
        status: string;
        allowedAt?: number;
        revokedAt?: number;
        revokedReason?: string;
      };
    };
  };
}

function getAttributesToClaim(onboardStatus: any, isBypassMint: boolean) {
  const attributesToClaim = [];
  for (const attributeName in onboardStatus) {
    const { status, mintedOnchain } = onboardStatus[attributeName];
    if (
      (status !== AttributeStatus.READY && status !== 'NOT_APPLICABLE') ||
      (!isBypassMint && !mintedOnchain && status === AttributeStatus.READY)
    ) {
      attributesToClaim.push(attributeName as QuadAttribute);
    }
  }
  return attributesToClaim;
}

function checkConsentNeeded(privacyStatus: any) {
  if (privacyStatus) {
    for (const privacyScopeKey in privacyStatus) {
      const { status } = privacyStatus[privacyScopeKey];
      if (status !== 'ALLOWED') {
        // if any permission is not allowed, all of the desired 
        // permissions need to be requested again
        return true;
      }
    }
  }
  return false;
}

function apiFetchAttributesOnboardStatus(args: {
  accessToken: string;
  account: string;
  attributes: Array<QuadAttribute>;
  chainId?: number;
  privacyScopes?: Array<PrivacyConsentScopeParamKey>;
}): Promise<AttributeOnboardStatusDto> {
  const {
    accessToken,
    account,
    attributes,
    chainId,
    privacyScopes
  } = args;
  const attrQuery = attributes.map((attr) => attr.toLowerCase()).join(',');
  const privacyScopesQuery = privacyScopes ? privacyScopes?.join(',') : undefined;
  const queryStringParameters: Record<string, any> = {
    wallet: account,
    attributes: attrQuery
  };
  if (chainId) {
    queryStringParameters.chainId = chainId;
  }
  if (privacyScopesQuery) {
    queryStringParameters.privacyScopes = privacyScopesQuery;
  }
  const queryString = new URLSearchParams(queryStringParameters);
  return fetch(
    `${QUADRATA_API_URL}/v2/attributes/onboard_status?${queryString.toString()}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-cache',
    }
  ).then((response) => {;
    if (!response.ok) {
      throw new Error('Onboard status failed');
    }
    return response.json();
  }) as Promise<AttributeOnboardStatusDto>;
};

export function parseOnboardStatusResponse(
    resp: AttributeOnboardStatusDto,
    isBypassMint: boolean = false
) {
  const { data: { onboardStatus, privacyStatus, offeringStatus } } = resp;
  const attributesToClaim = getAttributesToClaim(onboardStatus, isBypassMint);
  const isConsentNeeded = checkConsentNeeded(privacyStatus);
  if (offeringStatus) {
    // merge attribute to attest from offeringStatus into attributesToClaim
    const attributesToAttest = getAttributesToClaim(offeringStatus, true);
    for (const name of attributesToAttest) {
      if (!attributesToClaim.includes(name)) {
        attributesToClaim.push(name);
      }
    }
  }
  return { attributesToClaim, isConsentNeeded };
}

// Component
export const Quadrata: React.FC<{ accessToken: string }> = ({ 
  accessToken
}) => {
  // reused config options
  const isBypassMint = false;
  const requiredAttributes = [QuadAttribute.DID, QuadAttribute.AML];
  const requiredPrivacyScopes = [
    PrivacyConsentScopeParams.FN,
    PrivacyConsentScopeParams.LN,
    PrivacyConsentScopeParams.EM,
    PrivacyConsentScopeParams.DOB,
  ];

  // State
  const [attributesToClaim, setAttributesToClaim] = useState<QuadAttribute[]>([]);
  const [isError, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [privacyScopes, setPrivacyScopes] = useState<Array<PrivacyConsentScopeParamKey> | undefined>(undefined);
  const [showClient, setShowClient] = useState(false);
  const [signature, setSignature] = useState<string>();
  const [signatureConsent, setSignatureConsent] = useState<string>();
  
  // Minting
  const [mintComplete, setMintComplete] = useState(false);
  const [mintError, setMintError] = useState<string>();
  const [mintParams, setMintParams] = useState<QuadMintParamsBigNumbers>();

  // wagmi hooks
  const { signMessageAsync } = useSignMessage();
  const {
    address: account,
    chain: { id: chainId } = { id: 0 },
    isConnecting,
    isDisconnected
  } = useAccount();

  const contractConfig = useMemo(() => {
    if (!mintParams) {
      return undefined;
    }
    return {
      abi: QUAD_PASSPORT_ABI,
      args: [mintParams.account, mintParams.params[0], mintParams.signaturesIssuers[0]],
      address: QUAD_PASSPORT_ADDRESS as `0x${string}`,
      value: (mintParams?.fee || parseUnits('0', 18)) as bigint, // note: assumes same as ether with 18 decimals
      functionName: 'setAttributesIssuer',
    };
  }, [mintParams]);

  useSimulateContract(contractConfig);

  const {
    data: transactionHash,
    writeContract,
    error: writeContractError
  } = useWriteContract();
  
  useWaitForTransactionReceipt({
    hash: transactionHash,
  });

  useEffect(() => {
    if (transactionHash) {
      // Setting mint to complete
      setMintComplete(true);
      // Resetting state
      setMintParams(undefined);
      setSignature(undefined);
    }
  }, [transactionHash]);
  
  useEffect(() => {
    if (writeContractError) {
      console.log('[Quadrata Integration]: Mint error: ', writeContractError);
      setMintError(writeContractError.message);
    }
  }, [writeContractError]);

  const quadConfig: QuadClientConfig = {
    _debug: true,
    apiUrl: `${QUADRATA_API_URL}/v1`,
    countriesUnavailable: undefined, // ['US','COUNTRY','CODE','LIST']
    environment: QuadClientEnvironment.SANDBOX,
    protocolName: 'NewCo',
  };
    
  // Check which attributes to claim for a given wallet
  const { error: onboardStatusError, data: onboardStatusData } = useQuery({
    queryKey: ['QUAD_API_ONBOARD_STATUS', account, requiredAttributes, chainId, isBypassMint, requiredPrivacyScopes],
    queryFn: () => {
      setIsLoading(true);
      return apiFetchAttributesOnboardStatus({
        accessToken,
        account: account as `0x${string}`,
        attributes: requiredAttributes,
        privacyScopes: requiredPrivacyScopes,
        chainId: !isBypassMint && chainId ? chainId : undefined,
      }).catch((err) => {
        setError(true);
        throw err;
      });
    },
    enabled: !!account,
    gcTime: 0,
  });
  useEffect(() => {
    if (onboardStatusError) {
      console.error(`/onboard_status error : ${onboardStatusError}`);
      setError(true);
      setIsLoading(false);
      throw new Error(`/onboard_status error : ${onboardStatusError}`);
    }
    if (onboardStatusData) {
      const { attributesToClaim, isConsentNeeded } = parseOnboardStatusResponse(onboardStatusData, isBypassMint);
      setAttributesToClaim(attributesToClaim);
      if (isConsentNeeded) {
        setPrivacyScopes(requiredPrivacyScopes);
      } else {
        setPrivacyScopes(undefined);
      }
      setError(false);
      setIsLoading(false);
    }
  }, [onboardStatusData, onboardStatusError]);

  // Handlers
  const handleOnApplicationEnd: QuadrataOnApplicationEndCallback = ({ status, error }) => {
    // Application has reached an end state: completion or error
    console.log('handleOnApplicationEnd:::status:::', status);
    console.log('handleOnApplicationEnd:::error:::', error);
  };

  const handleSign = async (message: string, isConsent: boolean) => {
    // User clicked the initial sign button
    // Signing the message and updating state.
    // will automatically navigate to the next step upon signature update
    if (account) {
      const signature = await signMessageAsync({ message });
      if (isConsent) {
        setSignatureConsent(signature);
      } else {
        setSignature(signature);
      }
    }
  };

  const handlePageChange = (page: Page) => {
    if (page === Page.INTRO && signature) {
      // Intro page navigation will get triggered when a different wallet is detected,
      // Resetting previous state if present
      setSignature(undefined);
      setMintParams(undefined);
    }
  };
  
  const handleMintClick = useCallback(() => {
    if (writeContract && contractConfig) {
      // Trying to mint passport
      writeContract(contractConfig);
    }
  }, [writeContract, contractConfig]);

  const handleMintParamsReady: QuadClientMintParamsReadyCallback = (mintParams) => {
    // Setting mint params to prepare write function
    setMintParams(mintParams);
  };

  // QuadrataReact should only be displayed if the wallet is connected
  if (!account) {
      return <p>Please connect your wallet</p>;
  }

  if (isError) {
      return <p>Error initializing onboard status</p>;
  }

  // QuadrataReact should only be displayed if attributesToClaim has data
  if (isConnecting || isLoading || !attributesToClaim) {
      return <p>Loading...</p>
  }
  if (attributesToClaim.length === 0 
      && (!privacyScopes || privacyScopes.length === 0)
  ) {
    return <p>Onboarding Completed</p>;
  }

  if (!showClient) {
    return (
      <button
        type="button"
        onClick={() => setShowClient(true)}
        style={{border:'1px solid #D282A0', padding:'10px'}}
      >
        Launch Quadrata
      </button>
    );
  }
  
  // User is missing at least one attribute,
  // Onboarding user
  return (
    <QuadClient
      accessToken={accessToken}
      account={account}
      attributes={attributesToClaim}
      bypassMint={isBypassMint}
      chainId={chainId}
      config={quadConfig}     
      darkMode={true} 
      mintComplete={mintComplete}
      mintError={mintError}
      offeringId={undefined}
      privacyScopes={privacyScopes ? privacyScopes : undefined}
      onApplicationEnd={handleOnApplicationEnd}
      onHide={() => setShowClient(false)}
      onMintClick={handleMintClick}
      onMintParamsReady={handleMintParamsReady}
      onPageChange={handlePageChange}
      onSign={handleSign}      
      signature={signature}
      signatureConsent={signatureConsent}
      transactionHash={transactionHash}
    />
  );
};
