interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (params: any) => void;
        prompt: () => void;
      };
    };
  };
}