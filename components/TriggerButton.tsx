'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function TriggerButton() {
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function onClick() {
    try {
      setLoading(true);
      const res = await fetch('/api/ingest/trigger', { method: 'POST' });
      const data = await res.json();
      if (data?.ok) {
        startTransition(() => router.refresh());
      } else {
        alert(data?.error || "Couldn't refresh. Please try again in a minute.");
      }
    } catch {
      alert("Couldn't refresh. Please try again in a minute.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={loading || isPending}
      className="text-xs md:text-sm px-3 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
      aria-busy={loading || isPending}
    >
      {loading || isPending ? 'Refreshing…' : 'Pull latest data'}
    </button>
  );
}


