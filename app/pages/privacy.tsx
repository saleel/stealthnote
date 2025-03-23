import React from 'react';
import Head from 'next/head';

export default function PrivacyPolicyPage() {
    return (
        <>
            <Head>
                <title>Privacy Policy - StealthNote</title>
            </Head>

            <div className="article">
                <h1 className="article-title">Privacy Policy</h1>

                <div className="mt-3">
                    <h3>Introduction</h3>
                    <p>
                        At StealthNote, we are committed to protecting your privacy and ensuring the security 
                        of your communications. This privacy policy explains how we handle your data.
                    </p>

                    <h3>Data Collection and Storage</h3>
                    <p>
                        StealthNote is designed with privacy at its core. Our server:
                    </p>
                    <ul>
                        <li>Never collects any personal information from the users</li>
                        <li>Only stores messages, public keys, and Zero-Knowledge proofs</li>
                        <li>Never has access to your full JWT token</li>
                    </ul>

                    <h3>Data Retention</h3>
                    <p>
                        Please note that while we store your messages:
                    </p>
                    <ul>
                        <li>We do not guarantee long-term persistence of messages</li>
                        <li>
                            Messages may be deleted at any time due to system maintenance, updates, 
                            or other technical reasons
                        </li>
                    </ul>

                    <h3>Internal Message Board</h3>
                    <p>
                        Internal messages in StealthNote are not encrypted. They are only hidden from the public field.
                        StealthNote server has access to all internal messages.
                        <br />
                        We strive our best to keep the server secure,
                        but we cannot guarantee any data leakage.
                    </p>

                    <h3>Changes to Privacy Policy</h3>
                    <p>
                        We may update this privacy policy from time to time. Any changes will be reflected 
                        on this page.
                    </p>

                    <h3>Contact</h3>
                    <p>
                        If you have any questions about our privacy policy or how we handle your data, 
                        please reach out to us on <a href="https://x.com/stealthnote_">X</a>.
                    </p>
                </div>
            </div>
        </>
    );
} 