import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { getCredentials } from '@/lib/storage';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [hasCreds, setHasCreds] = useState(false);

  useEffect(() => {
    let mounted = true;
    getCredentials()
      .then((creds) => {
        if (mounted) setHasCreds(Boolean(creds));
      })
      .finally(() => {
        if (mounted) setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return null;

  return <Redirect href={hasCreds ? '/(tabs)' : '/login'} />;
}
