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
    PageKyb,
    PrivacyConsentScopeParamKey,
    QuadAttribute,
    QuadClientEnvironment,
    QuadClientMintParamsReadyCallback,
    QuadMintParamsBigNumbers,
    QuadSupportedChainId,
    QuadrataReact,
    QuadrataReactConfigShared,
    QuadrataReactConfigUser,
} from '@quadrata/quadrata-react';
import { AttributeStatus, QuadrataOnApplicationEndCallback } from '@quadrata/core-react';

// NOTE: find contract addresses at https://docs.quadrata.com/integration/additional-information/smart-contracts
const QUAD_PASSPORT_ADDRESS = "0x185cc335175B1E7E29e04A321E1873932379a4a0"; // Testnet

const QUADRATA_API_URL = process.env.NEXT_PUBLIC_QUADRATA_API_URL;

export interface AttributeOnboardStatusDto {
    data: {
        type: 'attributes';
        onboardStatus:{
            [attributeName: string]: {
                status: AttributeStatus;
                onboardedAt?: number;
                mintedOnchain?: boolean;
            };
        };
        offeringStatus?: {
            [attributeName: string]: {
                status: AttributeStatus;
                verifiedAt?: number;
            };
        };
        privacyStatus?: {
            [privacyPermission: string]: {
                status: 'ALLOWED' | 'REVOKED' | 'NEEDS_CONSENT';
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
    let isConsentNeeded = false;

    if (privacyStatus) {
        for (const privacyScopeKey in privacyStatus) {
            const { status } = privacyStatus[privacyScopeKey];
            if (status !== 'ALLOWED') {
                isConsentNeeded = true;
                break;
            }
        }
    }

    return isConsentNeeded;
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

function parseOnboardStatusResponse(resp: AttributeOnboardStatusDto, isBypassMint: boolean = false) {
    const {
        data: { onboardStatus, privacyStatus, offeringStatus },
    } = resp;
    const attributesToClaim = getAttributesToClaim(onboardStatus, isBypassMint);
    const isConsentNeeded = checkConsentNeeded(privacyStatus);
    if (offeringStatus) {
        // merge attribute to attest from offeringStatus into attributesToClaim
        const attributesToAttest = getAttributesToClaim(offeringStatus, true);
        for (const attributeName of attributesToAttest) {
            if (!attributesToClaim.includes(attributeName)) {
                attributesToClaim.push(attributeName);
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
    const bypassMint: boolean = false;
    const requiredAttributes = [QuadAttribute.DID, QuadAttribute.AML];
    const requiredPrivacyScopes = ['FN','LN','EM','DOB','G','GE','GIS'] as Array<PrivacyConsentScopeParamKey>;

    // State
    const [attributesToClaim, setAttributesToClaim] = useState<QuadAttribute[] | undefined>(undefined);
    const [isError, setError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [privacyScopes, setPrivacyScopes] = useState<Array<PrivacyConsentScopeParamKey> | undefined>(undefined);
    const [showModal, setShowModal] = useState<boolean>(false);
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
    
    // Check which attributes to claim for a given wallet
    const { error: onboardStatusError, data: onboardStatusData } = useQuery({
        queryKey: ['QUAD_API_ONBOARD_STATUS', account, requiredAttributes, chainId, bypassMint, requiredPrivacyScopes],
        queryFn: () => {
            setIsLoading(true);
            return apiFetchAttributesOnboardStatus({
                accessToken,
                account: account as `0x${string}`,
                attributes: requiredAttributes,
                privacyScopes: requiredPrivacyScopes,
                chainId: !bypassMint && chainId ? chainId : undefined,
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
            const { attributesToClaim, isConsentNeeded } = parseOnboardStatusResponse(onboardStatusData, bypassMint);
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
    } else if (attributesToClaim.length === 0 && (!privacyScopes || privacyScopes.length === 0)) {
        return <p>Onboarding Completed</p>;
    }

    if (!showModal) {
        return (
            <button
                type="button"
                onClick={() => setShowModal(true)}
                style={{border:'1px solid #D282A0', padding:'10px'}}
            >
                Launch Quadrata
            </button>
        );
    }

    const configShared: QuadrataReactConfigShared = {
        _debug: true,
        accessToken: accessToken,
        apiUrl: `${QUADRATA_API_URL}/v1`,
        children: undefined,
        className: 'custom__class__name',
        contactEmail: 'support@quadrata.com',
        darkMode: true,
        discordUrl: 'https://discord.gg/SR5Fc6BK',
        error: undefined,
        environment: QuadClientEnvironment.SANDBOX,
        protocolName: 'NewCo',
        showSocialButtons: false,
    };
    
    const configUser: QuadrataReactConfigUser = {
        ...configShared,
        account: account || '',
        attributes: attributesToClaim,
        bypassMint: bypassMint,
        chainId: chainId,
        countriesUnavailable: undefined, // ['US','COUNTRY','CODE','LIST']
        mintComplete: mintComplete,
        mintError: mintError,
        offeringId: undefined, // set to unique id for accreditation re-attestation
        privacyScopes: privacyScopes,
        signature: signature,
        signatureConsent: signatureConsent,
        transactionHash: transactionHash,
    };

    // Onboarding user and/or business
    // QuadrataReact should only be displayed when the configs are ready
    return (
        <>
            {accessToken && account ? (
                <QuadrataReact
                    configBusiness={configShared}
                    configUser={configUser}
                    onApplicationEnd={handleOnApplicationEnd}
                    onHide={() => setShowModal(false)}
                    onMintClick={handleMintClick}
                    onMintParamsReady={handleMintParamsReady}
                    onPageChange={handlePageChange}
                    onSign={handleSign}
                ></QuadrataReact>
            ) : (
                <></>
            )}
        </>
    );
};
