// Verification page logic
(function () {
  let selectedCredential = null;
  let faceCheckEnabled = false;

  document.addEventListener('DOMContentLoaded', async () => {
    const ok = await App.init();
    if (!ok) return;

    renderCredentials();
    setupFaceCheck();
    setupVerifyButton();
  });

  function renderCredentials() {
    const container = document.getElementById('credential-list');
    container.innerHTML = App.config.credentials.map(cred => `
      <div class="credential-card glass-card" data-id="${cred.id}">
        <div class="credential-card-header">
          <div class="credential-card-icon">${App.getIcon(cred.icon)}</div>
          <h4>${cred.name}</h4>
        </div>
        <p>${cred.description}</p>
      </div>
    `).join('');

    container.querySelectorAll('.credential-card').forEach(card => {
      card.addEventListener('click', () => selectCredential(card.dataset.id));
    });
  }

  function selectCredential(id) {
    selectedCredential = App.config.credentials.find(c => c.id === id);

    document.querySelectorAll('.credential-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`.credential-card[data-id="${id}"]`).classList.add('selected');

    const optionsPanel = document.getElementById('options-panel');
    optionsPanel.classList.add('visible');

    // Show FaceCheck option only if credential has photo
    const faceCheckOption = document.getElementById('facecheck-option');
    if (selectedCredential.hasPhoto) {
      faceCheckOption.style.display = 'block';
    } else {
      faceCheckOption.style.display = 'none';
      faceCheckEnabled = false;
    }

    document.getElementById('btn-verify').disabled = false;
  }

  function setupFaceCheck() {
    const toggle = document.getElementById('facecheck-toggle');
    toggle.addEventListener('click', () => {
      faceCheckEnabled = !faceCheckEnabled;
      toggle.classList.toggle('active', faceCheckEnabled);
    });
  }

  function setupVerifyButton() {
    document.getElementById('btn-verify').addEventListener('click', startVerification);
  }

  async function startVerification() {
    if (!selectedCredential) return;

    const btn = document.getElementById('btn-verify');
    btn.disabled = true;

    App.showLoading('Creating verification request...');

    try {
      const body = {
        credentialId: selectedCredential.id,
        faceCheck: faceCheckEnabled
      };

      const res = await fetch('/api/verify/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      App.hideLoading();

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to create verification request');
        btn.disabled = false;
        return;
      }

      const data = await res.json();
      showQRCode(data);

    } catch (err) {
      App.hideLoading();
      alert('Failed to create verification request');
      btn.disabled = false;
    }
  }

  function showQRCode(data) {
    const container = document.getElementById('qr-container');
    container.classList.add('visible');

    if (data.qrCode) {
      document.getElementById('qr-image').src = data.qrCode;
    }

    if (App.isMobile() && data.url) {
      const deepLink = document.getElementById('deep-link');
      deepLink.href = data.url;
      deepLink.style.display = 'inline-flex';
    }

    // Hide options
    document.getElementById('options-panel').classList.remove('visible');
    document.getElementById('credential-list').style.display = 'none';

    // Poll status
    App.pollStatus(data.requestId, updateStatus);
  }

  function updateStatus(data) {
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');

    indicator.className = 'status-indicator';

    if (data.status === 'request_retrieved') {
      indicator.classList.add('status-scanned');
      indicator.innerHTML = `<div class="spinner"></div><span>${data.message}</span>`;
    } else if (data.status === 'presentation_verified') {
      indicator.classList.add('status-success');
      indicator.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <span>${data.message}</span>
      `;
      // Show claims
      if (data.payload && data.payload.verifiedCredentials) {
        displayClaims(data.payload.verifiedCredentials);
      }
    } else if (data.status === 'error') {
      indicator.classList.add('status-error');
      indicator.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span>${data.message}</span>
      `;
    } else {
      indicator.classList.add('status-waiting');
      indicator.innerHTML = `<div class="spinner"></div><span>${data.message || 'Waiting...'}</span>`;
    }
  }

  function displayClaims(verifiedCredentials) {
    const container = document.getElementById('claims-container');
    const tbody = document.querySelector('#claims-table tbody');
    tbody.innerHTML = '';

    verifiedCredentials.forEach(vc => {
      // Add credential type header
      if (vc.type && vc.type.length > 0) {
        const typeRow = document.createElement('tr');
        typeRow.innerHTML = `<td colspan="2" style="color:var(--accent);font-weight:600;padding-top:1rem;">${vc.type.join(', ')}</td>`;
        tbody.appendChild(typeRow);
      }

      // Add issuer
      if (vc.authority) {
        const issuerRow = document.createElement('tr');
        issuerRow.innerHTML = `<td style="color:var(--text-secondary);">Issuer</td><td>${vc.authority}</td>`;
        tbody.appendChild(issuerRow);
      }

      // Add claims
      if (vc.claims) {
        Object.entries(vc.claims).forEach(([key, value]) => {
          // Skip photo data (too large to display)
          if (typeof value === 'string' && value.length > 500) {
            value = `[${key} — ${value.length} characters]`;
          }
          const row = document.createElement('tr');
          row.innerHTML = `<td style="color:var(--text-secondary);">${key}</td><td>${escapeHtml(String(value))}</td>`;
          tbody.appendChild(row);
        });
      }
    });

    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
