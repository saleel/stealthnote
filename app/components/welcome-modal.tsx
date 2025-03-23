import { LocalStorageKeys } from '@/lib/types';
import IonIcon from '@reacticons/ionicons';
import { useLocalStorage } from '@uidotdev/usehooks';
import { useState } from 'react';

export const WelcomeModal = () => {
  const [hasSeenWelcome, setHasSeenWelcome] = useLocalStorage(LocalStorageKeys.HasSeenWelcomeMessage, false);
  const [isOpen, setIsOpen] = useState(!hasSeenWelcome);

  const handleClose = () => {
    setHasSeenWelcome(true);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className={'modal-overlay'}>
      <div className={'modal'}>
        <button className={'modal-close-button'} onClick={handleClose}>
          <IonIcon name="close" />
        </button>
        <h2 className={'modal-title'}>Welcome to StealthNote!</h2>
        <div className={'modal-content'}>
          <p>
            StealthNote is a platform to anonymously post messages while proving you belong to an organization -
            without revealing who you are.
          </p>
          <p>
            We use {' '}
            <a
              href="https://en.wikipedia.org/wiki/Zero-knowledge_proof"
              target="_blank"
              rel="noopener noreferrer">
              Zero Knowledge Proofs
            </a>
            , which allows you to prove you have a valid Google Workspace account from your 
            organization, while keeping your email address and other details private.
          </p>
          <p>
            The messages you post cannot be linked to you (except for some edge cases).
            Read more about how it works {' '}
            <a href="https://saleel.xyz/blog/stealthnote/" target="_blank" rel="noopener noreferrer">here</a>.
          </p>
        </div>
      </div>
    </div>
  );
}; 