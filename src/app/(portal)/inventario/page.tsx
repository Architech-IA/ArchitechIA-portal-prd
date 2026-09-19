import { redirect } from 'next/navigation';

// Este modulo ahora vive como pestaña dentro de Finance.
export default function Page() {
  redirect('/finanzas?tab=inventario');
}
