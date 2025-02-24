import { GoogleOAuthProvider } from "./google-oauth";
import { AnonGroupProvider } from "../types";
// import { SlackOAuthProvider } from "./slack-oauth";

export const Providers: Record<string, AnonGroupProvider> = {
  "google-oauth": GoogleOAuthProvider,
  // "slack-oauth": SlackOAuthProvider,
};

export const ProviderSlugKeyMap: Record<string, AnonGroupProvider> = {
  domain: GoogleOAuthProvider,
};
