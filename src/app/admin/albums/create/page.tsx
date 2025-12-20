import AlbumCreationWizard from '@/components/AlbumCreationWizard/AlbumCreationWizard';

export default function CreateAlbumPage() {
  return (
    <div className="w-full min-h-screen text-white">
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Create New Album</h1>
          <p className="text-gray-400">Create an album and upload tracks in one workflow</p>
        </div>
        
        <AlbumCreationWizard />
      </div>
    </div>
  );
}
