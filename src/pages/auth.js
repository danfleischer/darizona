import { sendMagicLink } from '../supabase.js';
import { getParam, show } from '../utils.js';

export function showAuth() {
  show('pg-auth');
}

export function initAuth() {
  const form = document.getElementById('magic-link-form');
  const emailInput = document.getElementById('auth-email');
  const btn = document.getElementById('auth-btn');
  const sent = document.getElementById('auth-sent');
  const errEl = document.getElementById('auth-error');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return;
    btn.innerHTML = '<div class="spin"></div> Sending...';
    btn.disabled = true;
    errEl.textContent = '';
    try {
      // Preserve ?pool= param so magic link lands back on the right pool
      const poolToken = getParam('pool');
      const redirectTo = window.location.origin + window.location.pathname
        + (poolToken ? '?pool=' + poolToken : '');
      await sendMagicLink(email, redirectTo);
      form.style.display = 'none';
      sent.style.display = 'block';
    } catch (err) {
      btn.innerHTML = 'Send magic link &rarr;';
      btn.disabled = false;
      errEl.textContent = err.message || 'Something went wrong. Try again.';
    }
  });
}
