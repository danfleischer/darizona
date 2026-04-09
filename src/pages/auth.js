import state from '../state.js';
import { getPoolPlayerByPin } from '../supabase.js';
import { show } from '../utils.js';

export function showAuth() {
  show('pg-auth');
}

export function initAuth() {
  const form = document.getElementById('pin-form');
  const pinInput = document.getElementById('auth-pin');
  const btn = document.getElementById('auth-btn');
  const errEl = document.getElementById('auth-error');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const pinRaw = (pinInput.value || '');
    const pin = pinRaw.replace(/\D/g, '');
    if (pin.length !== 4) {
      errEl.textContent = 'Hello, plz enter the last 4 of your cell';
      return;
    }
    if (!state.poolId) {
      errEl.textContent = 'WRONG! Plz try again';
      return;
    }
    btn.innerHTML = '<div class="spin"></div> Checking...';
    btn.disabled = true;
    errEl.textContent = '';
    try {
      const player = await getPoolPlayerByPin(state.poolId, pin);
      if (!player) {
        throw new Error('PIN not found for this pool.');
      }
      state.userId = player.user_id;
      state.displayName = player.display_name;
      localStorage.setItem('pin_user_id', player.user_id);
      localStorage.setItem('pin_display_name', player.display_name || '');
      localStorage.setItem('pin_pool_id', state.poolId);
      document.dispatchEvent(new CustomEvent('pin-login'));
    } catch (err) {
      btn.innerHTML = 'Enter &rarr;';
      btn.disabled = false;
      errEl.textContent = err.message || 'Sign in failed. Try again.';
    }
  });
}
