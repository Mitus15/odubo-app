import Link from 'next/link';

export default function MomentsIndex() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Moments</h1>
      <p className="mb-4 text-[#b2a491]">Share photos from the event — attendees can join with a code and upload their moments.</p>
      <div className="flex gap-3">
        <Link href="/moments/join" className="px-4 py-2 rounded bg-[#ede8df] text-[#171616]">Join an event</Link>
        <Link href="/moments/admin" className="px-4 py-2 rounded bg-[#171616] text-[#ede8df]">Admin</Link>
      </div>
    </div>
  );
}
