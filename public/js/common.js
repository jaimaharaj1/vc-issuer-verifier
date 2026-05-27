// Common utilities for VC Issuer & Verifier
const App = {
  user: null,
  config: null,

  async init() {
    try {
      const res = await fetch('/api/user');
      if (res.status === 401) {
        window.location.href = '/auth/login';
        return false;
      }
      const data = await res.json();
      App.user = data.user;
      App.config = data.config;
      App.renderNav();
      if (App.config.showInfoBanner) {
        App.renderInfoBanner();
      }
      return true;
    } catch (err) {
      console.error('Failed to load user data:', err);
      return false;
    }
  },

  renderNav() {
    const nav = document.getElementById('navbar');
    if (!nav) return;

    const initials = App.user.name
      ? App.user.name.split(' ').map(n => n[0]).join('').toUpperCase()
      : '?';

    const currentPath = window.location.pathname;

    nav.innerHTML = `
      <a href="/" class="navbar-brand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
        <span>${App.config.clientName}</span>
      </a>
      <div class="navbar-links">
        <a href="/" class="${currentPath === '/' ? 'active' : ''}">Home</a>
        <a href="/issue" class="${currentPath === '/issue' ? 'active' : ''}">Issue</a>
        <a href="/verify" class="${currentPath === '/verify' ? 'active' : ''}">Verify</a>
      </div>
      <div class="navbar-user">
        <div class="user-avatar">${initials}</div>
        <button class="btn-logout" onclick="window.location.href='/auth/logout'">Sign out</button>
      </div>
    `;
  },

  renderInfoBanner() {
    const container = document.getElementById('info-banner');
    if (!container) return;

    container.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <div class="info-banner-content">
        <div class="info-banner-item"><span>DID:</span> <strong>${App.config.didAuthority}</strong></div>
        <div class="info-banner-item"><span>Credentials:</span> <strong>${App.config.credentials.length}</strong></div>
        <div class="info-banner-item"><span>User:</span> <strong>${App.user.username}</strong></div>
      </div>
    `;
    container.style.display = 'flex';
  },

  // Poll request status
  async pollStatus(requestId, onUpdate) {
    const poll = async () => {
      try {
        const res = await fetch(`/api/status/${requestId}`);
        if (!res.ok) return;
        const data = await res.json();
        onUpdate(data);
        if (data.status === 'issuance_successful' || data.status === 'presentation_verified' || data.status === 'error') {
          return; // Stop polling
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
      setTimeout(poll, 1500);
    };
    poll();
  },

  // Detect mobile
  isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  },

  // Get credential icon SVG
  getIcon(iconName) {
    const icons = {
      'shield-check': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
      'briefcase': '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>',
      'award': '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>',
      'user-check': '<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>',
      'file-check': '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/>'
    };
    const paths = icons[iconName] || icons['shield-check'];
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  },

  showLoading(message = 'Loading...') {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `<div class="loading-content"><div class="loading-spinner"></div><p>${message}</p></div>`;
      document.body.appendChild(overlay);
    }
    overlay.querySelector('p').textContent = message;
    requestAnimationFrame(() => overlay.classList.add('visible'));
  },

  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
    }
  }
};
