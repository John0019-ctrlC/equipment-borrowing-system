// QR + manual check-in for the attendance page (FR-02, NFR-02).
(function () {
  const statusEl = document.getElementById('scan-status');
  const countEl = document.getElementById('count');
  const logBody = document.getElementById('log-body');
  const url = `/attendance/${window.EVENT_ID}/checkin`;
  let busy = false;
  let lastToken = null;

  async function checkin(payload) {
    if (busy) return;
    busy = true;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      statusEl.textContent = data.message;
      statusEl.className = 'scan-status ' + (data.ok ? 'ok' : 'warn');
      if (data.ok) {
        countEl.textContent = data.count;
        setTimeout(() => location.reload(), 900); // refresh log table
      }
    } catch (e) {
      statusEl.textContent = 'Network error. Try again.';
      statusEl.className = 'scan-status warn';
    } finally {
      setTimeout(() => (busy = false), 800);
    }
  }

  document.getElementById('manual-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('schoolId');
    if (input.value.trim()) checkin({ schoolId: input.value.trim() });
    input.value = '';
  });

  if (window.Html5Qrcode) {
    const scanner = new Html5Qrcode('reader');
    scanner
      .start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, (text) => {
        if (text === lastToken) return;
        lastToken = text;
        setTimeout(() => (lastToken = null), 3000);
        checkin({ token: text });
      })
      .catch(() => {
        statusEl.textContent = 'Camera unavailable. Use manual check-in below.';
      });
  } else {
    statusEl.textContent = 'Scanner library not loaded. Use manual check-in below.';
  }
})();
