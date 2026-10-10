/**
 * The album screens' "Add New Tracks": what the owner chose goes to the
 * upload flow (tested against the real routes in albumTrackUpload.test.ts),
 * and what happened comes back in words, not "check the console".
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AlbumModal from '@/components/AlbumModal';
import { uploadAlbumTrack } from '@/lib/uploads/albumTrackUpload';
import type { Album } from '@/types/music';

jest.mock('@/lib/uploads/albumTrackUpload', () => ({ uploadAlbumTrack: jest.fn() }));
const mockUpload = uploadAlbumTrack as jest.MockedFunction<typeof uploadAlbumTrack>;

const loopSoul: Album = {
  id: 'loop-soul',
  title: 'Loop Soul',
  artist_name: 'Mani Odubo',
  release_type: 'album',
  explicit_content: false,
  featured: false,
};

const chooseAudio = (container: HTMLElement, ...names: string[]) => {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const files = names.map((name) => new File(['ID3'], name, { type: 'audio/mpeg' }));
  fireEvent.change(input, { target: { files } });
  return files;
};

// A saved upload reloads the page to show the new tracks; jsdom cannot
// navigate, but it lets window.location be swapped for the test.
const realLocation = Object.getOwnPropertyDescriptor(window, 'location')!;
const reload = jest.fn();
let alertSpy: jest.SpyInstance;
beforeEach(() => {
  mockUpload.mockReset();
  reload.mockReset();
  Object.defineProperty(window, 'location', { configurable: true, value: { reload } });
  alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  alertSpy.mockRestore();
  Object.defineProperty(window, 'location', realLocation);
});

describe('adding tracks from the album screen', () => {
  it('hands each chosen file to the upload flow with what was entered', async () => {
    mockUpload.mockResolvedValue({ id: 'track-1', creditsSaved: true });
    const { container } = render(<AlbumModal album={loopSoul} tracks={[]} onClose={() => {}} />);
    const [file] = chooseAudio(container, 'Makunahea.mp3');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Explicit' }));

    fireEvent.click(screen.getByRole('button', { name: 'Upload 1 Track' }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('All 1 tracks uploaded successfully!'));
    expect(mockUpload).toHaveBeenCalledWith(
      loopSoul,
      expect.objectContaining({ file, title: 'Makunahea', track_number: 1, explicit_content: true, credits: [] }),
    );
    expect(reload).toHaveBeenCalled();
  });

  it('names what failed and why, and keeps the form for another try', async () => {
    mockUpload.mockRejectedValue(new Error('The file is too large to upload here'));
    const { container } = render(<AlbumModal album={loopSoul} tracks={[]} onClose={() => {}} />);
    chooseAudio(container, 'Makunahea.wav');

    fireEvent.click(screen.getByRole('button', { name: 'Upload 1 Track' }));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('All track uploads failed.\n\nMakunahea: The file is too large to upload here'),
    );
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Upload 1 Track' })).toBeInTheDocument();
  });

  it('says which songs were saved without their credits', async () => {
    mockUpload
      .mockResolvedValueOnce({ id: 'track-1', creditsSaved: false })
      .mockRejectedValueOnce(new Error('Access Denied'));
    const { container } = render(<AlbumModal album={loopSoul} tracks={[]} onClose={() => {}} />);
    chooseAudio(container, 'Makunahea.mp3', 'News Peak.mp3');

    fireEvent.click(screen.getByRole('button', { name: 'Upload 2 Tracks' }));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        '1 tracks uploaded successfully, 1 failed.\n\nNews Peak: Access Denied' +
          '\n\nCredits did not save for Makunahea. Add them with Edit Credits.',
      ),
    );
  });
});
