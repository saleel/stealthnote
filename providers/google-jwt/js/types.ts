export interface EphemeralKey {
  publicKey: bigint;
  salt: bigint;
  expiry: Date;
}

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
 * Ephemeral key pair generated and stored in the browser's local storage
 * This key is used to sign messages.
 */
export interface EphemeralKey {
  privateKey: bigint;
  publicKey: bigint;
  salt: bigint;
  expiry: Date;
  ephemeralPubkeyHash: bigint;
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
   * @param ephemeralPubkeyHash - Hash of the ephemeral pubkey, expiry and salt
   * @returns Returns the AnonGroup and membership proof, along with additional args that may be needed for verification
   */
  generateProof(ephemeralKey: EphemeralKey, args?: object): Promise<{
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
    anonGroupId: string,
    ephemeralPubkey: bigint,
    ephemeralPubkeyExpiry: Date,
    proofArgs: object
  ): Promise<boolean>;

  /**
   * Get the AnonGroup by its unique identifier
   * @param groupId - Unique identifier for the AnonGroup
   * @returns Promise resolving to the AnonGroup
   */
  getAnonGroup(groupId: string): AnonGroup;
}