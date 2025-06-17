"use client";

import React from "react";
import IonIcon from "@reacticons/ionicons";
import { generateEphemeralKey } from "../lib/ephemeral-key";
import { Component as ProveByEmail } from "@stealthnote/provider-organization-email";
import { Component as ProveByGoogleJWT } from "@stealthnote/provider-organization-google-jwt";

const ProveModal = (props: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (provider: string, args?: object) => void;
}) => {
  const { isOpen, onClose, onSubmit } = props;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header">
          <h3 className="modal-title">Prove you own a company email address</h3>
          <button className="modal-close-button" onClick={onClose}>
            <IonIcon name="close" />
          </button>
        </div>

        <div className="modal-content">
          <ProveByEmail
            getEphemeralKey={() => generateEphemeralKey()}
            onSubmit={(args) => {
              onSubmit("email", args);
              onClose();
            }}
          />

          <br />
          <hr />
          <br />

          <ProveByGoogleJWT
            getEphemeralKey={() => generateEphemeralKey()}
            onSubmit={(args) => {
              onSubmit("google-oauth", args);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ProveModal;
