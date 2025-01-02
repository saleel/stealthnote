import { GoogleOAuthProvider } from "./google-oauth";
import { AnonGroupProvider } from "../types";

export const Providers: Record<string, AnonGroupProvider> = {
  "google-oauth": GoogleOAuthProvider,
};

export const ProviderSlugKeyMap: Record<string, AnonGroupProvider> = {
  domain: GoogleOAuthProvider,
};
