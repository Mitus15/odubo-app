import { RoomShell, Symbol } from '@/components/room/RoomParts';
import { onRoom, ROOM_DARK } from '@/lib/room';

/**
 * The gear's door, the moment it is tapped: the house's room with the hanger
 * in it, breathing, while the pieces come (a cold server can take a moment).
 * A visitor never taps and sees nothing happen.
 */
export default function GearLoading() {
  return (
    <RoomShell colour={ROOM_DARK} on={onRoom(ROOM_DARK)} scroll={false}>
      <div className="flex h-[calc(100%-var(--room-top))] items-center justify-center" aria-busy="true" aria-label="The gear is coming">
        <Symbol name="gear" className="h-10 w-10 animate-pulse opacity-60" />
      </div>
    </RoomShell>
  );
}
