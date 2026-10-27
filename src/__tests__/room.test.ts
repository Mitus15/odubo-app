/**
 * The room (lib/room): the colour a page is set in, and the writing on it.
 */
import { onRoom, roomFor, ROOM_DARK, ROOM_INK, ROOM_SAND } from '@/lib/room';
import type { Level } from '@/lib/levels';

const level = (id: string, colour: string) => ({ id, colour }) as Level;

describe('onRoom', () => {
  it('writes in ink on every song colour light enough for it', () => {
    for (const c of ['#f593a6', '#ee5a45', '#efd28c', '#7b9df3', '#e47fd1', '#e6e7ea']) expect(onRoom(c)).toBe(ROOM_INK);
  });
  it('writes in sand where ink would not read', () => {
    expect(onRoom('#002fa7')).toBe(ROOM_SAND); // Memories
    expect(onRoom(ROOM_DARK)).toBe(ROOM_SAND); // the outro
  });
  it('answers any new colour with whichever writing reads better on it', () => {
    expect(onRoom('#808080')).toBe(ROOM_INK); // a mid grey: ink still reads
    expect(onRoom('#6b3a2b')).toBe(ROOM_SAND); // a mid brown: ink does not, sand does better
    expect(onRoom('#ffffff')).toBe(ROOM_INK);
    expect(onRoom('#000000')).toBe(ROOM_SAND);
  });
  it('falls back to ink for a colour it cannot read', () => {
    expect(onRoom('tomato')).toBe(ROOM_INK);
  });
});

describe('roomFor', () => {
  const levels = [level('new', '#ee5a45'), level('old', '#f593a6')];
  it('is the room the visitor came from', () => {
    expect(roomFor(levels, 'old')).toMatchObject({ colour: '#f593a6', on: ROOM_INK });
  });
  it('is the newest room otherwise, and for an address it does not know', () => {
    expect(roomFor(levels).colour).toBe('#ee5a45');
    expect(roomFor(levels, 'gone').colour).toBe('#ee5a45');
  });
  it('is the house ink before anything is out', () => {
    expect(roomFor([])).toEqual({ colour: ROOM_DARK, on: ROOM_SAND, level: null });
  });
});
