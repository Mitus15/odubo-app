/**
 * The quick marks a run leaves on the screen: numbers that spring from him,
 * a flash of light, a buzz in the hand. Plain DOM and the Web Animations API,
 * so none of it passes through React while he flies.
 */

export interface BurstLine {
  text: string;
  className: string;
}

export function burst(layer: HTMLElement | null, x: number, y: number, lines: BurstLine[], rise = 48): void {
  if (!layer || typeof layer.animate !== 'function') return;
  const element = document.createElement('div');
  element.className = 'pointer-events-none absolute left-0 top-0 flex flex-col items-center whitespace-nowrap';
  for (const line of lines) {
    const span = document.createElement('span');
    span.className = line.className;
    span.textContent = line.text;
    element.appendChild(span);
  }
  layer.appendChild(element);
  const at = (dy: number, scale: number) =>
    `translate3d(${x.toFixed(1)}px, ${(y + dy).toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale})`;
  const animation = element.animate(
    [
      { opacity: 0, transform: at(10, 0.9) },
      { opacity: 1, transform: at(0, 1.05), offset: 0.14 },
      { opacity: 1, transform: at(-rise * 0.45, 1), offset: 0.55 },
      { opacity: 0, transform: at(-rise, 1) },
    ],
    { duration: 1250, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'forwards' },
  );
  animation.onfinish = () => element.remove();
}

export function flash(element: HTMLElement | null, strength: number): void {
  if (!element || typeof element.animate !== 'function') return;
  element.animate([{ opacity: strength }, { opacity: 0 }], { duration: 520, easing: 'ease-out' });
}

/** A buzz where the phone can (Android). iOS Safari has no vibration; it stays silent. */
export function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Some in-app browsers throw instead of ignoring it.
  }
}
