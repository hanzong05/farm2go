import { router } from 'expo-router';
import React, { useEffect } from 'react';

export default function Index() {
  useEffect(() => {
    router.replace('/buyer/marketplace' as any);
  }, []);

  return null;
}