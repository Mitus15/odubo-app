/**
 * The rooms: the pages set in the room he dances in (components/room).
 * Each draws itself edge to edge (RoomShell, RoomScreen), so the group holds
 * nothing but the page. What a room shares with the rest of the site (the
 * faces, analytics, the email capture, the cookie bar) is in the root layout;
 * the rest of the site's machinery (components/layout/AppShell) is never sent
 * to a room. docs/decisions/the-title-screen.md, "A room's own layout".
 */
export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
