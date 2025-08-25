import ScreenLayout from '@/components/ui/ScreenLayout';
import ScrollContainer from '@/components/ui/ScrollContainer';

export default function StudioPage() {
  return (
    <ScreenLayout>
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-stone-950 via-stone-900 to-red-950" />
      <ScrollContainer>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
          <h1 className="text-3xl font-bold mb-4">Studio</h1>
          <p className="text-gray-300">Studio page placeholder.</p>
        </div>
      </ScrollContainer>
    </ScreenLayout>
  );
}
