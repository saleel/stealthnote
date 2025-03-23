import React from 'react';
import Head from 'next/head';

export default function DisclaimerPage() {
    return (
        <>
            <Head>
                <title>Disclaimer - StealthNote</title>
            </Head>

            <div className="article">
                <h1 className="article-title">Disclaimer</h1>

                <div className="mt-3">
                    <p>
                        While we strive to provide secure and private messaging, 
                        we want to be transparent about the limitations and potential risks:
                    </p>
                    <p>
                        <strong>No Absolute Guarantee of Anonymity:</strong> While we implement strong 
                        security measures, we cannot guarantee complete anonymity of messages. 
                        There may be undiscovered bugs in our application
                        or the underlying cryptographic implementations that could compromise security.
                    </p>
                    <p>
                        <strong>Timing Attack Vulnerability:</strong> Sophisticated actors (like Google) 
                        might be able to perform timing attacks or traffic analysis to potentially deanonymize users.
                    </p>
                    <p>
                        <strong>Small Group Risk:</strong> If very few people from your organization are using this
                        application, the JWT issuer may be able to probabilistically identify users.
                    </p>
                </div>

                <div className="mt-3">
                    <p>
                        We are not liable for any damages or losses incurred as a result of using this application.
                    </p>
                </div>
            </div>
        </>
    );
} 