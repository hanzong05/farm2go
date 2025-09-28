import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';

// Redirect to the shared order component
export default function FarmerOrderRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    if (id) {
      // Redirect to the shared order component
      router.replace(`/order/${id}` as any);
    } else {
      router.back();
    }
  }, [id]);

  return null;
}