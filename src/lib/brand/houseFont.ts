import { Libre_Baskerville } from 'next/font/google';

/**
 * The house face: Libre Baskerville Bold, the face the ODUBO lockup is drawn
 * in (docs/decisions/odubo-logo.md), as --font-house. Only the pages that set
 * a name in it load it: the Studio's "Studio", the title screen's
 * "Mani Odubo".
 */
export const houseFont = Libre_Baskerville({ subsets: ['latin'], weight: '700', variable: '--font-house', display: 'swap' });
