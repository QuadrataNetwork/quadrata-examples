'use client';

// third party libs
import React, { useState } from 'react';

// quadrata libs
import { QuadClientEnvironment, QuadrataOnApplicationEndCallback } from '@quadrata/core-react';
import { PageKyb, QuadClientKybConfig, QuadrataKyb } from '@quadrata/kyb-react';

const QUADRATA_API_URL = process.env.NEXT_PUBLIC_QUADRATA_API_URL;

const quadKybConfig: QuadClientKybConfig = {
    apiUrl: `${QUADRATA_API_URL}/v1`,    // Testing url: https://int.quadrata.com/api/v1
    environment: QuadClientEnvironment.SANDBOX, // Use QuadClientEnvironment.SANDBOX for testing environment
    protocolName: 'NewCo',
    _debug: true,
};

// Component
export const Quadrata: React.FC<{ accessToken: string }> = ({
  accessToken,
}) => {
    const [showModal, setShowModal] = useState<boolean>(false);

    // Handlers
    const handleOnApplicationEnd: QuadrataOnApplicationEndCallback = ({ status, error }) => {
        // Application has reached an end state: completion or error
        console.log('handleOnApplicationEnd:::status:::', status);
        console.log('handleOnApplicationEnd:::error:::', error);
    };
  
    const handleOnHide = () => {
        // do something on QuadrataKyb client hide
        setShowModal(false);
    };

    const handlePageChange = (page: PageKyb) => {
        // do something on page change
    };

    if (!showModal) {
        // Button to launch the KYB application
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

    return (
        <QuadrataKyb
            accessToken={accessToken}
            config={quadKybConfig}
            darkMode={true}
            onApplicationEnd={handleOnApplicationEnd}
            onHide={handleOnHide}
            onPageChange={handlePageChange}
        />
    );
};