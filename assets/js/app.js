document.addEventListener('DOMContentLoaded', () => {
  setCurrentDate();
  setActiveNavigation();
  setSidebarControls();
  setPasswordToggle();
  setStandardForms();
  setTableSearches();
  setCalculator();
  setReportForm();
  setDefaultDate();
});

function setCurrentDate() {
  const dateElement = document.querySelector('[data-current-date]');
  if (!dateElement) return;
  dateElement.textContent = new Intl.DateTimeFormat('es-GT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }).format(new Date());
}

function setActiveNavigation() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.menu__link').forEach((link) => {
    if (link.getAttribute('href') === page) link.classList.add('is-active');
  });
}

function setSidebarControls() {
  const sidebar = document.querySelector('[data-sidebar]');
  const toggle = document.querySelector('[data-sidebar-toggle]');
  if (!sidebar || !toggle) return;
  toggle.addEventListener('click', () => sidebar.classList.toggle('is-open'));
}

function setPasswordToggle() {
  const toggle = document.querySelector('.password-toggle');
  const input = document.querySelector('.password-field input');
  if (!toggle || !input) return;
  toggle.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    toggle.textContent = isPassword ? '◌' : '◉';
    toggle.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
}

function setStandardForms() {
  document.querySelectorAll('form[data-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const redirect = form.dataset.redirect;
      showToast(redirect ? 'Credenciales verificadas. Ingresando al sistema…' : 'Formulario validado. La conexión con la base de datos se agregará después.', 'success');
      if (redirect) window.setTimeout(() => { window.location.href = redirect; }, 600);
    });
  });
}

function setTableSearches() {
  document.querySelectorAll('[data-table-search]').forEach((input) => {
    const table = document.getElementById(input.dataset.tableSearch);
    if (!table) return;
    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      table.querySelectorAll('tbody tr:not(.empty-table)').forEach((row) => {
        row.hidden = !row.textContent.toLowerCase().includes(query);
      });
    });
  });
}

function setCalculator() {
  const form = document.querySelector('[data-calculator]');
  const output = document.querySelector('[data-calculation-result]');
  if (!form || !output) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = new FormData(form);
    const length = Number(data.get('largo'));
    const height = Number(data.get('alto'));
    const coverage = Number(data.get('rendimiento'));
    const price = Number(data.get('costo'));
    const area = length * height;
    const gallons = area / coverage;
    const material = data.get('material');
    output.innerHTML = `<div class="panel__header"><div><h2>Resultado estimado</h2><p>Revise el cálculo antes de guardarlo en el proyecto.</p></div></div><div class="calculation-summary"><div class="calculation-summary__main"><p>Material requerido</p><strong>${gallons.toFixed(2)} galones</strong></div><div class="calculation-list"><div><span>Área total</span><strong>${area.toFixed(2)} m²</strong></div><div><span>Material</span><strong>${material}</strong></div><div><span>Rendimiento</span><strong>${coverage.toFixed(2)} m²/galón</strong></div><div><span>Costo estimado</span><strong>Q ${(gallons * price).toFixed(2)}</strong></div></div><button type="button" class="button button--secondary" data-save-calculation>Guardar cálculo estimado</button></div>`;
    output.querySelector('[data-save-calculation]').addEventListener('click', () => showToast('Cálculo preparado. Se guardará cuando se conecte el módulo de proyectos.', 'success'));
  });
}

function setReportForm() {
  const form = document.querySelector('[data-report-form]');
  const preview = document.querySelector('[data-report-preview]');
  if (!form || !preview) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = new FormData(form);
    const type = data.get('tipo');
    const format = data.get('formato');
    preview.innerHTML = `<div class="panel__header"><div><h2>Vista previa</h2><p>Resultado solicitado: ${type}.</p></div></div><div class="report-content"><h3>${type}</h3><p>Filtros aplicados: ${data.get('desde') || 'sin fecha inicial'} a ${data.get('hasta') || 'sin fecha final'}.</p><div class="empty-state"><span>▥</span><h3>Sin información para mostrar</h3><p>La vista previa utilizará los datos almacenados cuando se conecte la base de datos.</p><button class="button button--secondary" type="button" data-export-report>Preparar exportación ${format}</button></div></div>`;
    preview.querySelector('[data-export-report]').addEventListener('click', () => showToast(`La exportación a ${format} se habilitará al integrar el backend.`, 'success'));
  });
}

function setDefaultDate() {
  const field = document.getElementById('movimiento-fecha');
  if (!field || field.value) return;
  field.value = new Date().toISOString().slice(0, 10);
}

function showToast(message, type = '') {
  const container = document.querySelector('.toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type ? `toast--${type}` : ''}`;
  toast.textContent = message;
  container.append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}
