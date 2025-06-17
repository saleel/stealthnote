import { Provider as GoogleOAuthProvider } from "@stealthnote/provider-organization-google-jwt";
import { Provider as ProveByEmailProvider } from "@stealthnote/provider-organization-email";
import { AnonGroupProvider } from "../../types";

export const Providers: Record<string, AnonGroupProvider> = {
  "google-oauth": GoogleOAuthProvider,
  "email": ProveByEmailProvider,
};

export const ProviderSlugKeyMap: Record<string, AnonGroupProvider> = {
  domain: GoogleOAuthProvider,
};
