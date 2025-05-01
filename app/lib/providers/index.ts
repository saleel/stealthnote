import { GoogleOAuthProvider } from "./google-oauth";
import { AnonGroupProvider } from "../types";
import { MicrosoftOAuthProvider } from "./microsoft-oauth";
import { ProveByEmailProvider } from "./prove-by-email";

export const Providers: Record<string, AnonGroupProvider> = {
  "google-oauth": GoogleOAuthProvider,
  "microsoft-oauth": MicrosoftOAuthProvider,
  "prove-by-email": ProveByEmailProvider,
};

export const ProviderSlugKeyMap: Record<string, AnonGroupProvider> = {
  domain: GoogleOAuthProvider,
};
