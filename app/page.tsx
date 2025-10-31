'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Instant redirect - no delay
    const newChatId = nanoid();
    router.replace(`/chat/${newChatId}`);
  }, [router]);

  // Return nothing - instant redirect means this won't be seen
  return null;
}
