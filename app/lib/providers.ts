import { GoogleOAuthProvider } from "@stealthnote/google-jwt-provider";
import { AnonGroupProvider } from "./types";
import { Provider as ProveByEmailProvider } from "@stealthnote/organization-email";

export const Providers: Record<string, AnonGroupProvider> = {
  "google-oauth": GoogleOAuthProvider,
  "email": ProveByEmailProvider,
};

export const ProviderSlugKeyMap: Record<string, AnonGroupProvider> = {
  domain: GoogleOAuthProvider,
};
