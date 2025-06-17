"use client";

import React from "react";
import IonIcon from "@reacticons/ionicons";
import { generateEphemeralKey } from "../lib/ephemeral-key";
import { Providers } from "../lib/providers";
import { AnonGroupProvider } from "../../types";

const ProveModal = (props: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (provider: string, args?: object) => void;
}) => {
  const { isOpen, onClose, onSubmit } = props;

  if (!isOpen) {
    return null;
  }

  function renderProvider(provider: AnonGroupProvider) {
    const ProviderComponent = provider.getComponent();
    return (
      <ProviderComponent
        getEphemeralKey={() => generateEphemeralKey()}
        onSubmit={(args: object) => {
          onSubmit(provider.name(), args);
          onClose();
        }}
      />
    );
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
          {Object.values(Providers).map((provider) => (
            <React.Fragment key={provider.name()}>
              {renderProvider(provider)}
              <br />
              <hr />
              <br />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProveModal;
