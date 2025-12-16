import { redirect } from 'next/navigation';

export async function generateMetadata() {
  return { title: 'Featured (archived)' };
}

export default function FeaturedPage() {
  redirect('/');
}
