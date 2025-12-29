'use client';

export default function PlaceholderTab({ title, description }: { title: string; description?: string }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="w-16 h-16 bg-[#302927] rounded-2xl flex items-center justify-center mb-4 text-3xl">
        🚧
      </div>
      <h2 className="text-2xl font-bold text-[#ede8df] mb-2">{title}</h2>
      <p className="text-[#b2a491] max-w-md">
        {description || "This feature is part of the Odubo Engine roadmap. It will be available in a future update."}
      </p>
    </div>
  );
}
