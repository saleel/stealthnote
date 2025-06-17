import GoogleOAuthProvider from '@stealthnote/provider-organization-google-jwt';
import ProveByEmailProvider from '@stealthnote/provider-organization-email';
import { AnonGroupProvider } from '../../types';

export const Providers: Record<string, AnonGroupProvider> = {
  [ProveByEmailProvider.name()]: ProveByEmailProvider,
  [GoogleOAuthProvider.name()]: GoogleOAuthProvider,
};

export const ProviderSlugKeyMap: Record<string, AnonGroupProvider> = {
  domain: GoogleOAuthProvider,
};
