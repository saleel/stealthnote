/**
 * Represents an anonymous group where members can post messages without revealing their identity
 * Example: people in a company
 */
export interface AnonGroup {
  /** Unique identifier for the group (e.g: company domain) */
  id: string;
  /** Display name of the group */
  title: string;
  /** URL to the group's logo image */
  logoUrl: string;
}

/**
 * Provider interface for generating and verifying ZK proofs of AnonGroup membership
 * Example: Google, Slack (for "people in a company")
 */
export interface AnonGroupProvider {
  /** Get the provider's unique identifier */
  name(): string;

  /** Slug is a key that represents the type of the AnonGroup identifier (to be used in URLs). Example: "domain" */
  getSlug(): string;

  /**
   * Generate a ZK proof that the current user is a member of an AnonGroup
   * @param ephemeralPubkey - Pubkey modulus of a ephemeral keypair that the user will use to sign messages later
   * @returns Returns the AnonGroup and membership proof, along with additional args that may be needed for verification
   */
  generateProof(ephemeralPubkey: string): Promise<{
    proof: Uint8Array;
    anonGroup: AnonGroup;
    proofArgs: object;
  }>;

  /**
   * Verify a ZK proof of group membership
   * @param proof - The ZK proof to verify
   * @param ephemeralPubkey - Pubkey modulus of the ephemeral key that was used when generating the proof
   * @param anonGroup - AnonGroup that the proof claims membership in
   * @param proofArgs - Additional args that was returned when the proof was generated
   * @returns Promise resolving to true if the proof is valid
   */
  verifyProof(
    proof: Uint8Array,
    ephemeralPubkey: string,
    anonGroupId: string,
    proofArgs: object
  ): Promise<boolean>;

  /**
   * Get the AnonGroup by its unique identifier
   * @param groupId - Unique identifier for the AnonGroup
   * @returns Promise resolving to the AnonGroup
   */
  getAnonGroup(groupId: string): AnonGroup;
}

/**
 * Represents a message posted by an AnonGroup member
 */
export interface Message {
  /** Unique identifier for the message */
  id: string;
  /** ID of the AnonGroup the corresponding user belongs to */
  anonGroupId: string;
  /** Name of the provider that generated the proof that the user (user's ephemeral pubkey) belongs to the AnonGroup */
  anonGroupProvider: string;
  /** Content of the message */
  text: string;
  /** Unix timestamp when the message was created */
  timestamp: number;
  /** Whether this message is only visible to other members of the same AnonGroup */
  internal: boolean;
  /** Number of likes message received */
  likes: number;
}

export interface SignedMessage extends Message {
  /** RSA signature of the message - signed by the user's ephemeral private key (in hex format) */
  signature: string;
  /** RSA pubkey (modulus) that can verify the signature (in hex format) */
  ephemeralPubkey: string;
}

export interface SignedMessageWithProof extends SignedMessage {
  /** ZK proof that the sender belongs to the AnonGroup */
  proof: Uint8Array;
  /** Additional args that was returned when the proof was generated */
  proofArgs: object;
}

export const LocalStorageKeys = {
  PrivateKey: "privateKey",
  PublicKey: "publicKey",
  GoogleOAuthState: "googleOAuthState",
  GoogleOAuthNonce: "googleOAuthNonce",
  DarkMode: "darkMode",
};
