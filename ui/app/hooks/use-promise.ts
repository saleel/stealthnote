import React from 'react';

type UsePromiseOptions = {
  defaultValue?: any;
  dependencies?: any[];
  conditions?: any[];
};

function usePromise<T>(promise: () => Promise<T>, options: UsePromiseOptions = {}) {
  const { defaultValue, dependencies = [], conditions = [] } = options;

  const allConditionsValid = conditions.every((condition) => {
    if (typeof condition === 'function') return !!condition();
    return !!condition;
  });

  const [result, setResult] = React.useState<T>(defaultValue);
  const [fetchedAt, setFetchedAt] = React.useState<Date>();
  const [isFetching, setIsFetching] = React.useState<boolean>(allConditionsValid);
  const [error, setError] = React.useState<Error>();

  let didCancel = false;

  async function fetch() {
    didCancel = false;
    if (error) {
      setError(undefined);
    }

    setIsFetching(true);

    try {
      const data = await promise();
      if (!didCancel) {
        setResult(data);
        setFetchedAt(new Date());
      }
    } catch (e) {
      if (!didCancel) {
        // eslint-disable-next-line no-console
        console.error('Error on fetching data', e);
        setError(e as Error);
      }
    }

    setIsFetching(false);
  }

  React.useEffect(() => {
    if (!allConditionsValid) return;

    fetch();

    // eslint-disable-next-line consistent-return
    return () => {
      didCancel = true;
    };
  }, dependencies);

  function reFetch() {
    return fetch();
  }

  function reset() {
    setResult(defaultValue);
    setFetchedAt(undefined);
    setIsFetching(false);
    setError(undefined);
  }

  return [
    result,
    {
      isFetching,
      fetchedAt,
      reFetch,
      error,
      reset,
    },
  ] as [
    T,
    { isFetching: boolean; fetchedAt: Date; reFetch: () => void; error: Error; reset: () => void },
  ];
}

export default usePromise;
