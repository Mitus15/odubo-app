import { Libre_Baskerville } from 'next/font/google';

/**
 * The house face: Libre Baskerville Bold, the face the ODUBO lockup is drawn
 * in (docs/decisions/odubo-logo.md), as --font-house. Only the pages that set
 * a name in it fetch it (the Studio's "Studio"): it is not preloaded, since the
 * rooms carry the variable but name the site with the danceman mark.
 */
export const houseFont = Libre_Baskerville({ subsets: ['latin'], weight: '700', variable: '--font-house', display: 'swap', preload: false });
