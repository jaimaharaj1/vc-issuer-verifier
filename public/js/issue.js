// Issuance page logic
(function () {
  let selectedCredential = null;
  let photoSource = null;
  let photoData = null;

  document.addEventListener('DOMContentLoaded', async () => {
    const ok = await App.init();
    if (!ok) return;

    renderCredentials();
    setupPhotoOptions();
    setupIssueButton();
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

    // Update UI
    document.querySelectorAll('.credential-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`.credential-card[data-id="${id}"]`).classList.add('selected');

    const optionsPanel = document.getElementById('options-panel');
    optionsPanel.classList.add('visible');

    // Show/hide photo options
    const photoOptions = document.getElementById('photo-options');
    if (selectedCredential.hasPhoto) {
      photoOptions.style.display = 'block';
      photoSource = null;
      photoData = null;
      document.querySelectorAll('input[name="photoSource"]').forEach(r => r.checked = false);
      document.getElementById('upload-area').style.display = 'none';
    } else {
      photoOptions.style.display = 'none';
      photoSource = 'none';
    }

    updateIssueButton();
  }

  function setupPhotoOptions() {
    const radios = document.querySelectorAll('input[name="photoSource"]');
    radios.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        photoSource = e.target.value;
        photoData = null;

        document.querySelectorAll('.radio-option').forEach(o => o.classList.remove('selected'));
        e.target.closest('.radio-option').classList.add('selected');

        if (photoSource === 'upload') {
          document.getElementById('upload-area').style.display = 'flex';
        } else {
          document.getElementById('upload-area').style.display = 'none';
          // Fetch from Entra ID
          App.showLoading('Fetching photo from Entra ID...');
          try {
            const res = await fetch('/api/graph/photo');
            if (res.ok) {
              const data = await res.json();
              photoData = data.photo;
              App.hideLoading();
            } else {
              const err = await res.json();
              App.hideLoading();
              alert(err.error || 'Failed to fetch photo from Entra ID');
              photoData = null;
            }
          } catch (err) {
            App.hideLoading();
            alert('Failed to fetch photo');
          }
        }
        updateIssueButton();
      });
    });

    // File upload
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('photo-file');
    const preview = document.getElementById('photo-preview');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = 'var(--accent)'; });
    uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '';
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) handleFile(fileInput.files[0]);
    });

    function handleFile(file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        photoData = e.target.result; // data URL
        preview.src = e.target.result;
        preview.style.display = 'block';
        updateIssueButton();
      };
      reader.readAsDataURL(file);
    }
  }

  function updateIssueButton() {
    const btn = document.getElementById('btn-issue');
    if (!selectedCredential) {
      btn.disabled = true;
      return;
    }
    if (selectedCredential.hasPhoto && !photoData && photoSource !== 'none') {
      btn.disabled = !photoSource || (photoSource === 'upload' && !photoData) || (photoSource === 'entra' && !photoData);
      return;
    }
    btn.disabled = false;
  }

  function setupIssueButton() {
    document.getElementById('btn-issue').addEventListener('click', startIssuance);
  }

  async function startIssuance() {
    if (!selectedCredential) return;

    const btn = document.getElementById('btn-issue');
    btn.disabled = true;

    App.showLoading('Creating issuance request...');

    try {
      const body = {
        credentialId: selectedCredential.id,
        photoSource: photoSource || null,
        photoData: photoData || null
      };

      const res = await fetch('/api/issue/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      App.hideLoading();

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to create issuance request');
        btn.disabled = false;
        return;
      }

      const data = await res.json();
      showQRCode(data);

    } catch (err) {
      App.hideLoading();
      alert('Failed to create issuance request');
      btn.disabled = false;
    }
  }

  function showQRCode(data) {
    const container = document.getElementById('qr-container');
    container.classList.add('visible');

    // QR code
    if (data.qrCode) {
      document.getElementById('qr-image').src = data.qrCode;
    }

    // Deep link for mobile
    if (App.isMobile() && data.url) {
      const deepLink = document.getElementById('deep-link');
      deepLink.href = data.url;
      deepLink.style.display = 'inline-flex';
    }

    // PIN
    if (data.pin) {
      document.getElementById('pin-display').style.display = 'flex';
      document.getElementById('pin-value').textContent = data.pin;
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
    text.textContent = data.message;

    if (data.status === 'request_retrieved') {
      indicator.classList.add('status-scanned');
      indicator.innerHTML = `<div class="spinner"></div><span id="status-text">${data.message}</span>`;
    } else if (data.status === 'issuance_successful') {
      indicator.classList.add('status-success');
      indicator.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <span>${data.message}</span>
      `;
    } else if (data.status === 'error') {
      indicator.classList.add('status-error');
      indicator.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span>${data.message}</span>
      `;
    }
  }
})();
