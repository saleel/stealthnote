"use client";

import React, { useState, useMemo } from "react";
import IonIcon from "@reacticons/ionicons";
import { useDropzone } from 'react-dropzone';
import emailParser from "postal-mime";
import { EphemeralKey } from "./types";


const ProveByEmail = (props: {
  onSubmit: (email: { email: string, domain: string, dkimSelector: string }) => void;
  getEphemeralKey: () => Promise<EphemeralKey>;
}) => {
  const { onSubmit, getEphemeralKey } = props;

  const [emailContent, setEmailContent] = useState("");
  const [error, setError] = useState("");
  const [domain, setDomain] = useState("");
  const [dkimSelector, setDkimSelector] = useState("");

  const { getRootProps, getInputProps, isFocused, isDragAccept, isDragReject } = useDropzone({
    accept: {
      'application/octet-stream': ['.eml'],
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      try {
        if (!acceptedFiles.length) {
          throw new Error("Invalid file type: Please upload a valid .eml file");
        }

        const content = await acceptedFiles[0].text();
        const { domain, dkimSelector } = await parseEmail(content);
        setEmailContent(content);
        setDomain(domain);
        setDkimSelector(dkimSelector);
        setError("");
      } catch (error) {
        setError(error instanceof Error ? error.message : "Error parsing the email");
        setEmailContent("");
        setDomain("");
        setDkimSelector("");
      }
    },
  });

  async function onSubmitClick() {
    await getEphemeralKey();
    onSubmit({ email: emailContent, domain, dkimSelector });
  }

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
      throw new Error(`Invalid email: "From" domain (@${fromDomain}) does not match "To" 
       domain (@${toDomain}). This is not an internal company email.`);
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

  const dropZoneStyles = useMemo(() => ({
    ...baseStyle,
    ...(isFocused ? focusedStyle : {}),
    ...(isDragAccept ? acceptStyle : {}),
    ...(isDragReject ? rejectStyle : {})
  }), [
    isFocused,
    isDragAccept,
    isDragReject
  ]);

  return (
    <div>
      <p>
        You can anonymously prove that you are part of a company by proving 
        you have received an <strong>internal company email</strong>.
      </p>

      {!emailContent && (
        <>
          <p>
            Download <strong>any</strong> email you received from
            &quot;someone@your-company.com&quot; and drop it here.
          </p>

          <div {...getRootProps({ style: dropZoneStyles })}>
            <input {...getInputProps()} />
            <p>Drag and drop your .eml file here, or click to select</p>
          </div>

          {!error && (
            <p>
              This will generate a cryptographic proof of the email and
              extract your company domain.
              This happens entirely in your browser and the <strong>email never leaves your device</strong>.
            </p>
          )}
        </>
      )}

      {error && (
        <div className="error-message">{error}</div>
      )}

      {emailContent && (
        <div>
          <p style={{ marginBottom: '1rem' }} className="success-message">
            Amazing! You can use this email to prove that you are part of the <strong>{domain}</strong>.
            <br />
            <br />
            Click Submit to generate proof and start posting anonymously.
          </p>

          <button
            className="prove-modal-button"
            onClick={onSubmitClick}
            disabled={!!error}
          >
            <IonIcon name="mail" style={{ color: "var(--primary-900)", fontSize: "1.5rem" }} />
            Submit Email
          </button>
        </div>
      )}

    </div>
  );
};

export default ProveByEmail;


const baseStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '200px',
  borderWidth: 1,
  borderRadius: 2,
  borderColor: 'var(--shade-500)',
  borderStyle: 'dashed',
  backgroundColor: 'var(--shade-200)',
  color: 'var(--shade-700)',
  outline: 'none',
  transition: 'border .24s ease-in-out',
  marginBottom: '2rem',
  cursor: 'pointer',
};

const focusedStyle = {
  borderColor: 'var(--shade-300)'
};

const acceptStyle = {
  borderColor: '#00e676'
};

const rejectStyle = {
  borderColor: '#ff1744'
};
