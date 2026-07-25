// ---- Service catalogue: fetched live from the backend, not hardcoded ----
let SERVICES = [];

async function loadServices() {
  const tabsEl = document.getElementById('service-tabs');
  const panelEl = document.getElementById('service-panel');
  const serviceSelect = document.getElementById('service');

  try {
    const res = await fetch('/api/services');
    if (!res.ok) throw new Error('Request failed: ' + res.status);
    SERVICES = await res.json();
  } catch (err) {
    panelEl.innerHTML = '<p class="muted">Could not load services right now. Please refresh the page.</p>';
    console.error(err);
    return;
  }

  // Build tabs
  tabsEl.innerHTML = '';
  SERVICES.forEach((cat, i) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (i === 0 ? ' active' : '');
    btn.textContent = cat.title;
    btn.dataset.id = cat.id;
    btn.addEventListener('click', () => selectCategory(cat.id));
    tabsEl.appendChild(btn);
  });

  // Populate contact form service dropdown
  SERVICES.forEach(cat => {
    cat.items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item;
      opt.textContent = `${item} (${cat.title})`;
      serviceSelect.appendChild(opt);
    });
  });

  // Build SaaS grid from the "future-saas" category if present
  const saasCat = SERVICES.find(c => c.id === 'future-saas');
  const saasGrid = document.getElementById('saas-grid');
  if (saasCat && saasGrid) {
    saasGrid.innerHTML = saasCat.items.map(item => `
      <div class="saas-card">
        <div class="tag2">IN DEVELOPMENT</div>
        <h4>${escapeHtml(item)}</h4>
      </div>
    `).join('');
  }

  if (SERVICES.length) {
    selectCategory(SERVICES[0].id);
  }
}

function selectCategory(id) {
  const cat = SERVICES.find(c => c.id === id);
  if (!cat) return;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.id === id);
  });

  const panelEl = document.getElementById('service-panel');
  panelEl.innerHTML = `
    <div class="panel-head">
      <h3>${escapeHtml(cat.title)}</h3>
      <span class="sheet-num">SHEET ${cat.sheet}</span>
    </div>
    <p class="panel-blurb">${escapeHtml(cat.blurb)}</p>
    <div class="chip-grid">
      ${cat.items.map(item => `<span class="chip">${escapeHtml(item)}</span>`).join('')}
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Contact form: real submission to the backend ----
function initContactForm() {
  const form = document.getElementById('contact-form');
  const statusEl = document.getElementById('form-status');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = '';
    statusEl.className = 'form-status';

    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      company: form.company.value.trim(),
      service: form.service.value,
      message: form.message.value.trim()
    };

    if (!payload.name || !payload.email || !payload.message) {
      statusEl.textContent = 'Please fill in your name, email, and message.';
      statusEl.className = 'form-status err';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong.');
      }

      statusEl.textContent = data.message || 'Thanks — we got your message.';
      statusEl.className = 'form-status ok';
      form.reset();
    } catch (err) {
      statusEl.textContent = err.message || 'Could not send your message. Please try again or email us directly.';
      statusEl.className = 'form-status err';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send message';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadServices();
  initContactForm();
});
