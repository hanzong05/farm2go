import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';

// Redirect to the order detail page
export default function AdminOrderRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    if (id) {
      // Redirect to the order detail page
      router.replace(`/order-detail/${id}` as any);
    } else {
      router.back();
    }
  }, [id]);

  return null;
}
