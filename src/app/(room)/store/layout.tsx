import { StoreProvider } from '@/contexts/StoreContext';

/** A piece's page and the bag: the bag itself (StoreContext), for these two rooms only */
export default function RoomStoreLayout({ children }: { children: React.ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}
