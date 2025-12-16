import { redirect } from 'next/navigation';

export default function ClipsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const qs = new URLSearchParams();
  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(v => qs.append(key, v));
    } else if (value != null) {
      qs.append(key, value);
    }
  });

  redirect(qs.toString() ? `/?${qs.toString()}` : '/');
}
