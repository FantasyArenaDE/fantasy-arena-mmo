/** The portal's navigation can grow with width, zoom, or translated labels.
 * The full-screen desktop stage reserves its measured height. */
export function initFaCharacterChrome(header: HTMLElement | null): void {
  if (!document.body.hasAttribute('data-fa-mmo-native')) return;
  if (import.meta.env.VITE_FA_STUDIO_PREVIEW === '1') document.body.dataset.faStudioPreview = '';
  if (header) {
    const reserve = () => {
      const height = Math.ceil(header.getBoundingClientRect().height);
      if (height > 0) document.body.style.setProperty('--fa-lobby-header-height', `${height}px`);
    };
    reserve();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(reserve).observe(header);
  }

  const nameGroup = document.getElementById('new-char-name')?.closest('.char-input-group');
  const finishButton = document.getElementById('btn-create-char');
  const actions = finishButton?.parentElement;
  if (!nameGroup || !finishButton || !actions || actions.querySelector('.fa-character-finish'))
    return;
  const dock = document.createElement('div');
  dock.className = 'fa-character-finish';
  dock.append(nameGroup, finishButton);
  actions.append(dock);
}

export function focusInvalidCharacterName(input: HTMLInputElement): void {
  input.classList.add('user-invalid-fallback');
  input.setAttribute('aria-invalid', 'true');
  input.focus();
  if (
    !document.body.hasAttribute('data-fa-mmo-native') ||
    typeof input.animate !== 'function' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
    return;
  (input.getAnimations?.() ?? [])
    .filter((animation) => animation.id === 'fa-name-hint')
    .forEach((animation) => {
      animation.cancel();
    });
  const pulse = input.animate(
    [
      { boxShadow: '0 0 0 0 #e5a96800' },
      { boxShadow: '0 0 0 2px #ffdd9e, 0 0 17px 4px #e3a353a6', offset: 0.32 },
      { boxShadow: '0 0 0 6px #e5a96800' },
    ],
    { duration: 640, easing: 'ease-out' },
  );
  pulse.id = 'fa-name-hint';
}
