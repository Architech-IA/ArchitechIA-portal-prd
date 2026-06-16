'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function AppBackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push('/apps/catalogo')}
      className="rounded-lg border border-gray-700 p-2 text-gray-300 hover:bg-gray-800 hover:text-white"
      title="Volver al catálogo"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
