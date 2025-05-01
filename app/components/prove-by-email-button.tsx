"use client";

import React, { useState, useCallback } from "react";
import IonIcon from "@reacticons/ionicons";
import emailParser from "postal-mime";

const emailIconPath =
  "M424 80H88a56.06 56.06 0 00-56 56v240a56.06 56.06 0 0056 56h336a56.06 56.06 0 0056-56V136a56.06" +
  " 56.06 0 00-56-56zm-14.18 92.63l-144 112a16 16 0 01-19.64 0l-144-112a16 16 0 1119.64-25.26L256" +
  " 251.73l134.18-104.36a16 16 0 0119.64 25.26z";

const ProveByEmail = (props: {
  onSubmitEmail: (email: { email: string, domain: string, dkimSelector: string }) => void;
  isLoading: boolean;
  disabled: boolean;
}) => {
  const { onSubmitEmail, isLoading, disabled } = props;

  const [isOpen, setIsOpen] = useState(true);
  const [emailContent, setEmailContent] = useState("");
  const [error, setError] = useState("");
  const [domain, setDomain] = useState("");
  const [dkimSelector, setDkimSelector] = useState("");

  async function parseEmail(emailContent: string) {
    const email = await emailParser.parse(emailContent);

    if (email.to?.length && email.to.length > 1) {
      throw new Error("Invalid email: This email contains more than one To address");
    }

    if (!email.from?.address || !email.to?.[0]?.address) {
      throw new Error("Invalid email: Both From and To headers are required");
    }

    // Check if domains match
    const fromDomain = email.from.address.split('@')[1];
    const toDomain = email.to[0].address.split('@')[1];

    if (fromDomain !== toDomain) {
      throw new Error(`Domain address of From (${fromDomain}) does not match To (${toDomain})`);
    }

    // Check for BCC and CC headers
    if (email.cc?.length && email.cc.length > 0) {
      throw new Error("Invalid email: Emails with CC are not supported");
    }

    if (email.bcc?.length && email.bcc.length > 0) {
      throw new Error("Invalid email: Emails with BCC are not supported");
    }

    // Ensure From and To email addresses are present in the DKIM signature
    const dkimHeader = email.headers.find(header => header.key === 'dkim-signature');
    if (!dkimHeader) {
      throw new Error("Invalid email: No DKIM signature found");
    }

    // Extract d= from the DKIM header
    function extractDKIMValue(dkimString: string, key: string) {
      let dkimParts;
      if (dkimString.includes(`;${key}=`)) {
        dkimParts = dkimString.split(`;${key}=`);
      } else if (dkimString.includes(`; ${key}=`)) {
        dkimParts = dkimString.split(`; ${key}=`);
      } else {
        throw new Error(`Invalid email: No ${key} found in the email signature`);
      }

      return dkimParts[1].split(';')[0];
    }

    const dkimDomain = extractDKIMValue(dkimHeader.value, "d");
    if (!dkimDomain.startsWith(fromDomain)) {
      throw new Error(`Invalid email: This email is not signed by the domain ${fromDomain}. Found ${dkimDomain}`);
    }

    const dkimSelector = extractDKIMValue(dkimHeader.value, "s");
    const dkimSignedFields = extractDKIMValue(dkimHeader.value, "h");

    const signedFields = dkimSignedFields.split(":").map(field => field.trim());
    if (!signedFields.includes("from") || !signedFields.includes("to")) {
      throw new Error("Invalid email: Either of From or To is not included in the signature");
    }

    return { domain: fromDomain, dkimSelector };
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith('.eml')) {
      setError("Please drop a valid .eml file");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;

      try {
        const { domain, dkimSelector } = await parseEmail(content);
        setEmailContent(content);
        setDomain(domain);
        setDkimSelector(dkimSelector);
        setError("");
      } catch (error) {
        setError(error instanceof Error ? error.message : "An unknown error occurred when parsing the email");
        setEmailContent("");
      }
    };
    reader.readAsText(file);
  }, []);

  const handleSubmit = useCallback(() => {
    onSubmitEmail({ email: emailContent, domain, dkimSelector });
    setIsOpen(false);
  }, [emailContent, domain, dkimSelector, onSubmitEmail, setIsOpen]);

  const emailIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      style={{ fill: "var(--shade-800)" }}
    >
      <path d={emailIconPath} />
    </svg>
  );

  const dropZoneContent = !emailContent ? (
    <div className="drop-zone-placeholder">
      <IonIcon name="cloud-upload-outline" size="large" />
      <p>Drag and drop your .eml file here</p>
    </div>
  ) : (
    <div className="drop-zone-content">
      <IonIcon name="checkmark-circle-outline" size="large" />
      <p>Email file loaded</p>
    </div>
  );

  const modalContent = (
    <div className="modal-content">
      <p>
        To verify your identity, please follow these steps:
      </p>
      <ol>
        <li>Download your email as an .eml file from your email client</li>
        <li>Drag and drop the .eml file below</li>
      </ol>

      <div
        className="email-drop-zone"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {dropZoneContent}
      </div>

      {error && <div className="error-message">{error}</div>}

      {domain && (
        <p>
          You can use this email to prove that you are part of the {domain}.
        </p>
      )}

      <button
        className="submit-button"
        onClick={handleSubmit}
        disabled={!!error}
      >
        Submit
      </button>
    </div>
  );

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="message-form-oauth-button" disabled={disabled}>
        {isLoading ? <span className="spinner-icon small" /> : emailIcon}
      </button>

      {isOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <button className="modal-close-button" onClick={() => setIsOpen(false)}>
              <IonIcon name="close" />
            </button>
            <h2 className="modal-title">Verify by Email</h2>
            {modalContent}
          </div>
        </div>
      )}
    </>
  );
};

export default ProveByEmail;
