const API_CONFIG = {
  baseUrl: '/api',
  legacyTokenKey: 'recubrimientos_token',
  rememberedUserKey: 'recubrimientos_usuario_recordado'
};
const MATERIAL_IMAGE_MAX_MB = 5;

const browserWindow = typeof window !== 'undefined' ? window : globalThis;
if (browserWindow) {
  browserWindow.API_CONFIG = API_CONFIG;
}

/* Mapeo global de usuarios para rellenar nombres faltantes en movimientos */
const usuariosMapeo = {};

/* Cache del usuario actual para incluir en operaciones que lo requieren */
let usuarioActual = null;
let mostrarMaterialesArchivados = false;
const mostrarArchivados = {
  clientes: false,
  proyectos: false,
  usuarios: false
};
const richTextEditors = new Map();

function initializeRichTextEditors() {
  if (typeof Quill === 'undefined') return;

  document.querySelectorAll('[data-rich-text-editor]').forEach((container) => {
    const targetId = container.dataset.richTextEditor;
    const textarea = document.getElementById(targetId);
    if (!textarea || richTextEditors.has(targetId)) return;

    const editor = new Quill(container, {
      theme: 'snow',
      placeholder: textarea.placeholder,
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link'],
          ['clean']
        ]
      }
    });

    textarea.hidden = true;
    editor.on('text-change', () => {
      textarea.value = editor.root.innerHTML === '<p><br></p>' ? '' : editor.root.innerHTML;
    });
    richTextEditors.set(targetId, { editor, textarea });
    setRichTextValue(targetId, textarea.value);
  });
}

function setRichTextValue(targetId, value = '') {
  const instance = richTextEditors.get(targetId);
  const textarea = document.getElementById(targetId);
  if (textarea) textarea.value = value || '';
  if (!instance) return;

  if (value) {
    instance.editor.clipboard.dangerouslyPasteHTML(value);
  } else {
    instance.editor.setText('');
  }
  instance.textarea.value = value || '';
}

function syncRichTextEditors() {
  richTextEditors.forEach(({ editor, textarea }) => {
    textarea.value = editor.root.innerHTML === '<p><br></p>' ? '' : editor.root.innerHTML;
  });
}

function formatColorCode(value = '#ffffff') {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : '#FFFFFF';
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return `${hex} · rgb(${red}, ${green}, ${blue})`;
}

function sanitizeRichText(value) {
  if (!value) return '';
  const template = document.createElement('template');
  template.innerHTML = String(value);
  const allowedTags = new Set(['A', 'BR', 'EM', 'LI', 'OL', 'P', 'STRONG', 'U', 'UL']);

  template.content.querySelectorAll('*').forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }
    [...element.attributes].forEach((attribute) => {
      if (element.tagName === 'A' && attribute.name === 'href' && /^https?:\/\//i.test(attribute.value)) return;
      element.removeAttribute(attribute.name);
    });
    if (element.tagName === 'A') {
      element.target = '_blank';
      element.rel = 'noopener noreferrer';
    }
  });

  return template.innerHTML;
}

function getLoginErrorMessage(error) {
  const rawMessage = error && typeof error.message === 'string' ? error.message : '';
  const normalized = String(rawMessage || '').trim();
  const lowerMessage = normalizeErrorText(normalized);

  if (!normalized) return 'Credenciales inválidas. Verifique su usuario y contraseña.';

  if (/(unauthorized|invalid credentials|credenciales invalid|usuario o contrasena|usuario o contraseña|wrong password|bad credentials|not authorized|401|403)/i.test(lowerMessage)) {
    return 'Credenciales inválidas. Verifique su usuario y contraseña.';
  }

  if (/(email|usuario|contrasena|password)/i.test(lowerMessage)) {
    return 'Credenciales inválidas. Verifique su usuario y contraseña.';
  }

  return normalized;
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    setCurrentDate();
    setActiveNavigation();
    applyRoleAccess();
    initializeRichTextEditors();
    setSidebarControls();
    setPasswordToggle();
    applyRememberedLoginState();
    setStandardForms();
    setTableSearches();
    setupResponsiveTables();
    setCalculator();
    setReportForm();
    setDefaultDate();
    loadDashboardData();
    loadRecentProjects();
    loadCrudLists();
    setupClienteModal();
    setupMaterialModal();
    setupLaborModal();
    setupInventoryModule();
    loadCurrentUserDisplay();
    setupUsuariosModule();
    setupProyectoModule();
    setupProyectoModal();
    setupCalculatorModule();
    setupReportModal();
    setupArchiveTabs();
  });
}

if (typeof module !== 'undefined') {
  module.exports = { getLoginErrorMessage };
}

function getDisplayUserName(user, fallback = 'Usuario') {
  const candidates = [
    user?.nombre,
    user?.usuario,
    user?.email,
    user?.name
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (!value || value === 'null' || value === 'undefined') continue;
    if (user?.rol && value === user.rol) continue;
    return value;
  }

  return fallback;
}

async function loadCurrentUserDisplay() {
  try {
    const currentUser = await getCurrentUser();
    if (currentUser) {
      const userName = getDisplayUserName(currentUser, 'Usuario');
      
      /* Llenar el nombre en la barra superior */
      const nombreElement = document.querySelector('[data-usuario-nombre]');
      if (nombreElement) {
        nombreElement.textContent = userName;
      }
      
      /* Llenar el rol en la barra superior */
      const rolElement = document.querySelector('[data-usuario-rol]');
      if (rolElement) {
        rolElement.textContent = currentUser.rol || '';
      }
      
      /* Generar avatar con las iniciales */
      const avatarElement = document.querySelector('[data-avatar-usuario]');
      if (avatarElement) {
        const initials = userName
          .split(' ')
          .slice(0, 2)
          .map(word => word.charAt(0).toUpperCase())
          .join('');
        avatarElement.textContent = initials;
      }
    }
  } catch (error) {
    console.warn('No se pudo cargar los datos del usuario para mostrar:', error.message);
  }
}

function setCurrentDate() {
  const dateElement = document.querySelector('[data-current-date]');
  if (!dateElement) return;
  dateElement.textContent = new Intl.DateTimeFormat('es-GT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }).format(new Date());
}

function setActiveNavigation() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.enlace-menu').forEach((link) => {
    if (link.getAttribute('href') === page) link.classList.add('activo');
  });
}

async function applyRoleAccess() {
  let currentUser = null;
  try {
    const storedUser = sessionStorage.getItem('usuarioActual');
    currentUser = storedUser ? JSON.parse(storedUser) : null;
  } catch (_error) {
    currentUser = null;
  }

  const applyAccess = (user) => {
    if (!user) return;
    const isAdministrator = String(user.rol || '').trim().toLowerCase() === 'administrador';
    document.querySelectorAll('.enlace-menu, .acciones-rapidas a').forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (!isAdministrator && /(?:^|\/)usuarios\.html(?:$|#|\?)/i.test(href) && !link.dataset.accessChecked) {
        link.dataset.accessChecked = 'true';
        link.addEventListener('click', (event) => {
          event.preventDefault();
          showAccessDeniedModal();
        });
      }
    });
  };

  applyAccess(currentUser);
  if (!currentUser) applyAccess(await getCurrentUser());

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const isAdministrator = String((currentUser || usuarioActual)?.rol || '').trim().toLowerCase() === 'administrador';
  if (!isAdministrator && currentPage.toLowerCase() === 'usuarios.html') {
    showToast('No tiene permisos para acceder al módulo de usuarios.', 'error');
    window.setTimeout(() => {
      window.location.href = window.location.pathname.includes('/modulos/') ? '../index.html' : 'index.html';
    }, 300);
  }
}

function showAccessDeniedModal() {
  const existingModal = document.querySelector('[data-access-denied-modal]');
  if (existingModal) {
    existingModal.hidden = false;
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-acceso-denegado';
  modal.dataset.accessDeniedModal = 'true';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'titulo-acceso-denegado');
  modal.innerHTML = `<div class="modal-acceso-denegado__contenido"><button type="button" class="modal-acceso-denegado__cerrar" aria-label="Cerrar">×</button><span class="modal-acceso-denegado__icono">!</span><h2 id="titulo-acceso-denegado">No tienes acceso</h2><p>Tu rol no permite ingresar al módulo de usuarios.</p><button type="button" class="boton boton-principal modal-acceso-denegado__aceptar">Entendido</button></div>`;
  document.body.appendChild(modal);

  const closeModal = () => {
    modal.hidden = true;
  };
  modal.querySelectorAll('.modal-acceso-denegado__cerrar, .modal-acceso-denegado__aceptar').forEach((button) => {
    button.addEventListener('click', closeModal);
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
}

function setSidebarControls() {
  const barraLateral = document.querySelector('[data-barra-lateral]');
  const appShell = document.querySelector('.app-shell');
  const toggle = document.querySelector('[data-barra-lateral-toggle]');
  if (!barraLateral || !toggle) return;

  const closeSidebar = () => {
    barraLateral.classList.remove('abierto');
    if (appShell) {
      appShell.classList.remove('barra-lateral-activa');
    }
  };

  // Toggle barra-lateral cuando se hace clic en el botón hamburguesa
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = barraLateral.classList.contains('abierto');
    barraLateral.classList.toggle('abierto', !isOpen);
    if (appShell) {
      appShell.classList.toggle('barra-lateral-activa', !isOpen);
    }
  });

  // Cerrar barra-lateral cuando se hace clic en un enlace del menú
  document.querySelectorAll('.enlace-menu').forEach((link) => {
    link.addEventListener('click', () => {
      closeSidebar();
    });
  });

  document.querySelectorAll('.cerrar-sesion').forEach((link) => {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        await apiRequest('auth/logout', { method: 'POST' });
      } catch (_error) {
        // Aunque el servidor no responda, limpiamos rastros antiguos y sacamos al usuario de la UI.
      } finally {
        clearLegacyAuthStorage();
        window.location.href = link.getAttribute('href') || 'login.html';
      }
    });
  });

  // Cerrar barra-lateral cuando se hace clic fuera del menú
  document.addEventListener('click', (event) => {
    if (!barraLateral.classList.contains('abierto')) return;
    if (event.target.closest('[data-barra-lateral]') || event.target.closest('[data-barra-lateral-toggle]')) return;
    closeSidebar();
  });

  // Cerrar barra-lateral cuando se hace clic en el overlay
  if (appShell) {
    appShell.addEventListener('click', (e) => {
      if (e.target === appShell && barraLateral.classList.contains('abierto')) {
        closeSidebar();
      }
    });
  }
}

function setupArchiveTabs() {
  document.querySelectorAll('[data-archive-view]').forEach((button) => {
    button.addEventListener('click', async () => {
      const resource = button.dataset.archiveResource;
      if (!resource || !(resource in mostrarArchivados)) return;
      mostrarArchivados[resource] = button.dataset.archiveView === 'archived';
      document.querySelectorAll(`[data-archive-resource="${resource}"]`).forEach((tab) => {
        tab.classList.toggle('activa', tab.dataset.archiveView === (mostrarArchivados[resource] ? 'archived' : 'active'));
      });
      await loadCrudLists();
    });
  });
}

function setPasswordToggle() {
  const toggle = document.querySelector('.alternar-contrasena');
  const input = document.querySelector('.campo-contrasena input');
  if (!toggle || !input) return;
  toggle.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    toggle.textContent = isPassword ? '◌' : '◉';
    toggle.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
}

function getRememberedUser() {
  try {
    const saved = localStorage.getItem(API_CONFIG.rememberedUserKey);
    if (!saved) return '';
    const parsed = JSON.parse(saved);
    if (typeof parsed === 'string') return parsed.trim();
    if (parsed && typeof parsed.usuario === 'string') return parsed.usuario.trim();
    return '';
  } catch (_error) {
    return '';
  }
}

function saveRememberedUser(username, shouldRemember) {
  const normalized = String(username || '').trim();

  if (shouldRemember && normalized) {
    localStorage.setItem(API_CONFIG.rememberedUserKey, JSON.stringify({ usuario: normalized }));
    return;
  }

  localStorage.removeItem(API_CONFIG.rememberedUserKey);
}

function applyRememberedLoginState() {
  const loginForm = document.querySelector('form[data-form]');
  if (!loginForm) return;

  const usernameInput = loginForm.querySelector('[name="usuario"]');
  const rememberInput = loginForm.querySelector('[name="recordar"]');
  const rememberedUser = getRememberedUser();

  if (rememberInput) {
    rememberInput.checked = Boolean(rememberedUser);
  }

  if (usernameInput && rememberedUser) {
    usernameInput.value = rememberedUser;
  }
}

function setStandardForms() {
  document.querySelectorAll('form[data-form]').forEach((form) => {
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton && !form.dataset.originalSubmitText) {
      form.dataset.originalSubmitText = submitButton.textContent.trim();
    }

    form.addEventListener('reset', () => {
      window.setTimeout(() => {
        form.dataset.editId = '';
        const hiddenIdInput = form.querySelector('input[name="id"]');
        if (hiddenIdInput) hiddenIdInput.value = '';
        if (submitButton) submitButton.textContent = form.dataset.originalSubmitText || 'Guardar cliente';
        clearFormErrors();
      }, 0);
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormErrors();
      
      if (!form.checkValidity()) {
        displayValidationErrors(form);
        return;
      }

      const endpoint = resolveApiEndpoint(form);
      if (endpoint) {
        try {
          const payload = objectFromForm(form);
          const isEditing = Boolean(form.dataset.editId);
          const targetEndpoint = isEditing ? `${endpoint}/${form.dataset.editId}` : endpoint;
          const response = await apiRequest(targetEndpoint, {
            method: isEditing ? 'PUT' : 'POST',
            body: payload
          });

          const successMessage = response?.message || (isEditing ? 'Registro actualizado correctamente.' : 'Registro guardado correctamente.');
          showToast(successMessage, 'success');

          if (endpoint === 'auth/login' && response?.user) {
            clearLegacyAuthStorage();
            const usernameInput = form.querySelector('[name="usuario"]');
            const rememberInput = form.querySelector('[name="recordar"]');
            const shouldRemember = Boolean(rememberInput && rememberInput.checked);
            saveRememberedUser(usernameInput ? usernameInput.value : '', shouldRemember);

            /* Guardar datos del usuario autenticado en sessionStorage */
            if (response.user && (response.user.id_usuario || response.user.id)) {
              usuarioActual = response.user;
              sessionStorage.setItem('usuarioActual', JSON.stringify(response.user));
            }
          }

          if (form.dataset.redirect) {
            window.setTimeout(() => { window.location.href = form.dataset.redirect; }, 600);
          }

          form.reset();
          form.dataset.editId = '';
          const hiddenIdInput = form.querySelector('input[name="id"]');
          if (hiddenIdInput) hiddenIdInput.value = '';
          if (submitButton) submitButton.textContent = form.dataset.originalSubmitText || 'Guardar cliente';
          await loadCrudLists();
          return;
        } catch (error) {
          const loginErrorMessage = endpoint === 'auth/login' ? getLoginErrorMessage(error) : (error.message || 'No se pudo conectar con la API.');
          showToast(loginErrorMessage, 'error');
          if (endpoint === 'auth/login') {
            const usuarioInput = form.querySelector('[name="usuario"]');
            const passwordInput = form.querySelector('[name="contrasena"]');
            const loginError = document.getElementById('error-login');
            if (usuarioInput) usuarioInput.classList.add('is-invalid');
            if (passwordInput) passwordInput.classList.add('is-invalid');
            if (loginError) {
              loginError.textContent = loginErrorMessage;
              loginError.classList.add('is-visible');
              loginError.style.display = 'block';
            }
          }
          return;
        }
      }

      const redirect = form.dataset.redirect;
      showToast(redirect ? 'Credenciales verificadas. Ingresando al sistema…' : 'Formulario validado.', 'success');
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
      updateTableSearchCount(input, table);
    });
    updateTableSearchCount(input, table);
    const tbody = table.querySelector('tbody');
    if (tbody) {
      new MutationObserver(() => updateTableSearchCount(input, table)).observe(tbody, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden']
      });
    }
  });
}

function updateTableSearchCount(input, table) {
  const countElement = document.querySelector(`[data-search-count="${table.id}"]`);
  if (!countElement) return;
  const rows = [...table.querySelectorAll('tbody tr:not(.empty-table)')];
  const visibleRows = rows.filter((row) => !row.hidden).length;
  countElement.textContent = `${visibleRows} ${visibleRows === 1 ? 'registro encontrado' : 'registros encontrados'}`;
}

function refreshTableSearchCount(table) {
  const input = document.querySelector(`[data-table-search="${table.id}"]`);
  if (input) updateTableSearchCount(input, table);
}

async function setupCalculatorModule() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (page !== 'calculo-materiales.html') return;
  await loadCalculatorMaterials();
}

async function loadCalculatorMaterials() {
  const select = document.getElementById('calculo-material');
  if (!select) return;

  try {
    const response = await apiRequest('materiales');
    const items = Array.isArray(response) ? response : (response && Array.isArray(response.data) ? response.data : []);
    select.innerHTML = '<option value="">Seleccione un material</option>' + items.map((material) => {
      const id = material.id_material ?? material.id ?? '';
      const name = material.nombre || 'Material sin nombre';
      return `<option value="${escapeAttribute(id)}">${escapeHtml(name)}</option>`;
    }).join('');
  } catch (error) {
    console.warn('No se pudieron cargar los materiales para el cálculo:', error.message);
  }
}

function setCalculator() {
  const form = document.querySelector('[data-calculator]');
  const output = document.querySelector('[data-calculation-result]');
  if (!form || !output) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearFormErrors();
    if (!form.checkValidity()) { displayValidationErrors(form); return; }
    const data = new FormData(form);
    const length = Number(data.get('largo'));
    const height = Number(data.get('alto'));
    const coverage = Number(data.get('rendimiento'));
    const price = Number(data.get('costo') || 0);
    const area = length * height;
    const gallons = area / coverage;
    const materialSelect = form.querySelector('#calculo-material');
    const materialName = materialSelect && materialSelect.selectedIndex > 0
      ? materialSelect.options[materialSelect.selectedIndex].text
      : (data.get('material') || 'Material');
    output.innerHTML = `<div class="encabezado-panel"><div><h2>Resultado estimado</h2><p>Revise el cálculo antes de guardarlo.</p></div></div><div class="resumen-calculo"><div class="resumen-calculo__main"><p>Material requerido</p><strong>${gallons.toFixed(2)} galones</strong></div><div class="lista-calculo"><div><span>Área total</span><strong>${area.toFixed(2)} m²</strong></div><div><span>Material</span><strong>${materialName}</strong></div><div><span>Rendimiento</span><strong>${coverage.toFixed(2)} m²/galón</strong></div><div><span>Costo estimado</span><strong>Q ${(gallons * price).toFixed(2)}</strong></div></div><button type="button" class="boton boton-secundario" data-save-calculation>Guardar cálculo estimado</button></div>`;
    output.querySelector('[data-save-calculation]').addEventListener('click', () => showToast('Cálculo preparado y listo para guardar mediante la API.', 'success'));
  });
}

async function renderReportPreview(form, preview) {
  const data = new FormData(form);
  const type = data.get('tipo');
  const format = data.get('formato');
  const query = new URLSearchParams({ tipo: type });
  ['desde', 'hasta', 'estado'].forEach((key) => {
    if (data.get(key)) query.set(key, data.get(key));
  });
  preview.innerHTML = '<div class="contenido-reporte"><p>Cargando reporte...</p></div>';

  try {
    const report = await apiRequest(`reportes?${query.toString()}`);
    const rows = Array.isArray(report.filas) ? report.filas : [];
    const headers = report.columnas || [];
    const tableRows = rows.map((row) => `<tr>${Object.values(row).map((value) => `<td>${escapeHtml(formatReportValue(value))}</td>`).join('')}</tr>`).join('');
    preview.innerHTML = `<div class="encabezado-panel"><div><h2>Vista previa</h2><p>${escapeHtml(report.tipo)} · ${rows.length} registro(s)</p></div><div class="acciones-reporte"><button class="boton boton-secundario" type="button" data-export-report="excel">Excel</button><button class="boton boton-secundario" type="button" data-export-report="pdf">PDF</button></div></div><div class="contenido-reporte"><h3>${escapeHtml(report.tipo)}</h3><div class="tabla-reporte"><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${tableRows || `<tr><td colspan="${headers.length}">No hay información para los filtros seleccionados.</td></tr>`}</tbody></table></div></div>`;
    preview.querySelectorAll('[data-export-report]').forEach((button) => button.addEventListener('click', () => {
      if (button.dataset.exportReport === 'pdf') downloadReportPdf(report);
      else downloadReportExcel(report);
    }));
    if (format === 'PDF') downloadReportPdf(report);
    if (format === 'Excel') downloadReportExcel(report);
  } catch (error) {
    preview.innerHTML = `<div class="contenido-reporte"><div class="empty-state"><span>!</span><h3>No se pudo generar el reporte</h3><p>${escapeHtml(error.message)}</p></div></div>`;
    showToast(error.message, 'error');
  }
}

function formatReportValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return Number(value).toLocaleString('es-GT', { maximumFractionDigits: 2 });
  return normalizeDateValue(value);
}

async function downloadReportExcel(report) {
  if (typeof ExcelJS === 'undefined') {
    showToast('No se pudo cargar ExcelJS. Verifique su conexión a internet.', 'error');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Reporte');
  const reportRows = (report.filas || []).map((row) => Object.values(row).map(formatReportValue));
  worksheet.addTable({
    name: 'TablaReporte',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    columns: report.columnas.map((name) => ({ name })),
    rows: reportRows
  });
  worksheet.columns.forEach((column, index) => {
    const longestValue = Math.max(
      report.columnas[index].length,
      ...reportRows.map((row) => String(row[index] ?? '').length),
      12
    );
    column.width = Math.min(longestValue + 3, 35);
  });
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  link.download = `${report.tipo.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadReportPdf(report) {
  const jsPdfNamespace = window.jspdf;
  if (!jsPdfNamespace || typeof jsPdfNamespace.jsPDF !== 'function') {
    showToast('No se pudo cargar jsPDF. Verifique su conexión a internet.', 'error');
    return;
  }

  const documentPdf = new jsPdfNamespace.jsPDF({ orientation: 'landscape' });
  documentPdf.setFontSize(16);
  documentPdf.text(report.tipo, 14, 16);
  documentPdf.setFontSize(9);
  documentPdf.text(`Generado: ${new Intl.DateTimeFormat('es-GT').format(new Date())}`, 14, 23);
  documentPdf.autoTable({
    head: [report.columnas],
    body: (report.filas || []).map((row) => Object.values(row).map(formatReportValue)),
    startY: 29,
    theme: 'grid',
    headStyles: { fillColor: [31, 90, 117] },
    styles: { fontSize: 8, cellPadding: 2 },
    didDrawPage: (data) => {
      documentPdf.setFontSize(8);
      documentPdf.text(`Página ${data.pageNumber}`, documentPdf.internal.pageSize.getWidth() - 28, documentPdf.internal.pageSize.getHeight() - 8);
    }
  });
  documentPdf.save(`${report.tipo.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.pdf`);
}

function setReportForm() {
  const form = document.querySelector('[data-report-form]');
  const preview = document.querySelector('[data-report-preview]');
  if (!form || !preview) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearFormErrors();
    if (!form.checkValidity()) { displayValidationErrors(form); return; }
    renderReportPreview(form, preview);
  });
}

function setupReportModal() {
  const button = document.getElementById('btnGenerarReporte');
  const form = document.getElementById('formReporteModal');
  const modal = document.getElementById('modalGenerarReporte');
  if (!button || !form || !modal || typeof bootstrap === 'undefined') return;

  button.addEventListener('click', () => {
    form.reset();
    clearFormErrors();
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearFormErrors();
    if (!form.checkValidity()) {
      displayValidationErrors(form);
      return;
    }
    const preview = document.querySelector('[data-report-preview]');
    if (preview) {
      renderReportPreview(form, preview);
    }

    const bootstrapModal = bootstrap.Modal.getInstance(modal);
    if (bootstrapModal) bootstrapModal.hide();
  });
}

function setDefaultDate() {
  const field = document.getElementById('movimiento-fecha');
  if (!field || field.value) return;
  field.value = new Date().toISOString().slice(0, 10);
}

function showToast(message, type = '') {
  if (type === 'error') {
    const openModal = document.querySelector('.modal.show, .modal-acceso-denegado:not([hidden])');
    const modalForm = openModal?.querySelector('form');
    if (modalForm && showFormError(modalForm, message)) return;
  }

  const container = document.querySelector('.contenedor-alertas');
  if (!container) return;
  const alerta = document.createElement('div');
  alerta.className = `alerta ${type ? `alerta--${type}` : ''}`;
  alerta.textContent = message;
  container.append(alerta);
  window.setTimeout(() => alerta.remove(), 4200);
}

function resolveApiEndpoint(form) {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const endpoint = form.dataset.apiEndpoint || form.dataset.endpoint;
  if (endpoint) return endpoint;

  const pageMap = {
    'login.html': 'auth/login',
    'clientes.html': 'clientes',
    'proyectos.html': 'proyectos',
    'materiales.html': 'materiales',
    'inventario.html': 'inventario/movimientos',
    'usuarios.html': 'usuarios'
  };

  return pageMap[page] || null;
}

function clearFormErrors() {
  const errors = document.querySelectorAll('.error-formulario');
  errors.forEach(error => {
    error.textContent = '';
    error.style.display = 'none';
  });

  const inputs = document.querySelectorAll('input.is-invalid, textarea.is-invalid, select.is-invalid');
  inputs.forEach(input => {
    input.classList.remove('is-invalid');
    input.style.borderColor = '';
  });

  document.querySelectorAll('.error-modal').forEach((error) => error.remove());
}

function showFormError(form, message) {
  const modal = form?.closest('.modal');
  if (!modal || !message) return false;

  let errorElement = modal.querySelector('.error-modal');
  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.className = 'error-modal';
    errorElement.setAttribute('role', 'alert');
    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) modalBody.prepend(errorElement);
    else modal.prepend(errorElement);
  }
  errorElement.textContent = message;
  return true;
}

function displayValidationErrors(form) {
  const fields = form.querySelectorAll('[required], [type="email"], [type="tel"], [type="number"], [type="date"]');
  let firstErrorMessage = '';
  
  fields.forEach(field => {
    const fieldName = field.name;
    if (!fieldName) return;
    
    // Validar el campo
    if (!field.checkValidity()) {
      field.classList.add('is-invalid');
      
      // Buscar el elemento de error correspondiente
      const errorElement = document.getElementById(`error-${fieldName}`);
      if (errorElement) {
        // Obtener el mensaje de validación específico
        let message = '';
        if (fieldName === 'identificacion' && field.validity.valueMissing) {
          message = 'El DPI es obligatorio.';
        } else if (fieldName === 'identificacion' && field.validity.patternMismatch) {
          message = 'DPI inválido. Debe ingresar 13 dígitos sin guiones.';
        } else if (field.validity.valueMissing) {
          message = `${fieldName} es requerido.`;
        } else if (field.validity.typeMismatch) {
          message = `Por favor ingrese un ${field.type} válido.`;
        } else if (field.validity.tooShort) {
          message = `Mínimo ${field.minLength} caracteres.`;
        } else if (field.validity.patternMismatch) {
          message = `Formato inválido.`;
        } else if (field.validity.rangeUnderflow) {
          message = `El valor debe ser mayor a ${field.min}.`;
        } else if (field.validity.rangeOverflow) {
          message = `El valor debe ser menor a ${field.max}.`;
        } else if (field.validity.stepMismatch) {
          message = `Valor inválido.`;
        } else {
          message = field.validationMessage || 'Campo inválido.';
        }
        
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        if (!firstErrorMessage) firstErrorMessage = message;
      }
    } else {
      field.classList.remove('is-invalid');
      const errorElement = document.getElementById(`error-${fieldName}`);
      if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
      }
    }
  });

  if (firstErrorMessage) showFormError(form, firstErrorMessage);
}

function applyFieldError(form, fieldName, message) {
  const normalizedField = String(fieldName || '').trim();
  const input = form.querySelector(`[name="${normalizedField}"]`) || form.querySelector(`[name="${normalizedField.toLowerCase()}"]`);
  const dashedField = normalizedField.replace(/_/g, '-');
  const errorElement = document.getElementById(`error-${normalizedField}`)
    || document.getElementById(`error-${normalizedField.toLowerCase()}`)
    || document.getElementById(`error-${dashedField}`)
    || document.getElementById(`error-${dashedField.toLowerCase()}`);

  if (input) {
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
  }

  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

function normalizeErrorText(message) {
  return String(message || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function clearLegacyAuthStorage() {
  localStorage.removeItem(API_CONFIG.legacyTokenKey);
  sessionStorage.removeItem(API_CONFIG.legacyTokenKey);
  clearRememberedUser();
  /* Limpiar datos del usuario autenticado */
  sessionStorage.removeItem('usuarioActual');
  usuarioActual = null;
}

function clearRememberedUser() {
  localStorage.removeItem(API_CONFIG.rememberedUserKey);
}

function handleFormError(error, form) {
  clearFormErrors();

  const rawPayload = error && error.response ? error.response : null;
  const fallbackMessage = error && error.message ? error.message : 'Error desconocido';
  let errorData = rawPayload;

  if (!errorData && typeof fallbackMessage === 'string' && fallbackMessage.includes('{')) {
    try {
      errorData = JSON.parse(fallbackMessage);
    } catch (e) {
      errorData = null;
    }
  }

  const errorObject = errorData && typeof errorData === 'object' ? errorData : {};
  const mappedErrors = {};

  if (errorObject.errors && typeof errorObject.errors === 'object') {
    Object.entries(errorObject.errors).forEach(([field, messages]) => {
      mappedErrors[field] = Array.isArray(messages) ? messages[0] : messages;
    });
  }

  if (errorObject.error && typeof errorObject.error === 'object') {
    if (errorObject.error.errors && typeof errorObject.error.errors === 'object') {
      Object.entries(errorObject.error.errors).forEach(([field, messages]) => {
        mappedErrors[field] = Array.isArray(messages) ? messages[0] : messages;
      });
    }

    if (!mappedErrors.message && errorObject.error.message) {
      mappedErrors.message = errorObject.error.message;
    }
  }

  if (Object.keys(mappedErrors).length > 0) {
    Object.entries(mappedErrors).forEach(([field, message]) => {
      if (field === 'message') return;
      applyFieldError(form, field, message);
    });

    const alertaMessage = mappedErrors.message || errorObject.message || fallbackMessage;
    if (alertaMessage) {
      showToast(alertaMessage, 'error');
    }
    return;
  }

  const responseMessage = typeof errorObject.message === 'string' ? errorObject.message : (
    typeof errorObject.error === 'string' ? errorObject.error : fallbackMessage
  );

  const normalizedMessage = String(responseMessage || fallbackMessage || 'Error desconocido');
  const lowerMessage = normalizeErrorText(normalizedMessage);

  if ((/categoria/.test(lowerMessage)) && (/duplic|ya existe|existe|registrad|repet|ocupad/.test(lowerMessage))) {
    applyFieldError(form, 'categoria_nombre', 'La categoría ya existe. Ingrese un nombre diferente.');
    showToast('La categoría ya existe.', 'error');
    return;
  }

  if ((/codigo|code/.test(lowerMessage)) && (/duplic|ya existe|existe|registrad|repet|ocupad/.test(lowerMessage))) {
    applyFieldError(form, 'codigo', 'El código ya existe. Ingrese un código diferente.');
    showToast('El código del material ya existe.', 'error');
    return;
  }

  if ((/dpi|identificacion|nit|cui|cedula/.test(lowerMessage)) && (/duplic|ya existe|existe|registrad|repet|ocupad/.test(lowerMessage))) {
    applyFieldError(form, 'identificacion', 'DPI duplicado o ya existe en la base de datos.');
    showToast('El DPI ya existe en la base de datos.', 'error');
    return;
  }

  if ((/dpi|identificacion|nit|cui|cedula/.test(lowerMessage)) && (/invalido|formato|incorrect|mal/.test(lowerMessage))) {
    applyFieldError(form, 'identificacion', 'DPI inválido. Verifique el formato o los datos ingresados.');
    showToast('DPI inválido.', 'error');
    return;
  }

  showToast(normalizedMessage, 'error');
}

async function apiRequest(endpoint, options = {}) {
  const baseUrl = (window.API_CONFIG && window.API_CONFIG.baseUrl) || API_CONFIG.baseUrl;
  const resource = String(endpoint).replace(/^\/+/, '');
  const url = `${baseUrl.replace(/\/$/, '')}/${resource}`;

  const headers = {
    Accept: 'application/json',
    ...(options.headers || {})
  };

  const requestOptions = {
    method: 'GET',
    credentials: 'include',
    ...options,
    headers
  };

  if (requestOptions.body && !(requestOptions.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (requestOptions.body && typeof requestOptions.body !== 'string' && !(requestOptions.body instanceof FormData)) {
    requestOptions.body = JSON.stringify(requestOptions.body);
  }

  try {
    const response = await fetch(url, requestOptions);
    const responseText = await response.text();
    let payload = null;

    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch (error) {
        payload = responseText;
      }
    }

    if (!response.ok) {
      const message = payload && typeof payload === 'object' ? (payload.message || payload.error || 'Error en la API.') : response.statusText || 'Error en la API.';
      const apiError = new Error(message);
      apiError.response = payload;
      apiError.status = response.status;
      if (response.status === 401 && !window.location.pathname.endsWith('login.html')) {
        clearLegacyAuthStorage();
        window.location.href = window.location.pathname.includes('/modulos/') ? '../login.html' : 'login.html';
      }
      throw apiError;
    }

    return payload;
  } catch (error) {
    if (error instanceof TypeError) {
      const networkError = new Error('La API no está disponible en este momento. Verifique que el backend esté levantado en ' + baseUrl);
      networkError.response = null;
      throw networkError;
    }
    throw error;
  }
}

function normalizeDateValue(value) {
  if (value === null || value === undefined || value === '') return value;

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) return '';

  const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    return trimmed;
  }

  const europeanDateMatch = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (europeanDateMatch) {
    const [, day, month, year] = europeanDateMatch;
    return `${year}-${month}-${day}`;
  }

  const isoDateWithTimeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T.*$/);
  if (isoDateWithTimeMatch) {
    return `${isoDateWithTimeMatch[1]}-${isoDateWithTimeMatch[2]}-${isoDateWithTimeMatch[3]}`;
  }

  const parsedDate = new Date(trimmed);
  if (!Number.isNaN(parsedDate.getTime())) {
    const localDate = new Date(parsedDate.getTime() - (parsedDate.getTimezoneOffset() * 60000));
    return localDate.toISOString().slice(0, 10);
  }

  return trimmed;
}

function objectFromForm(form) {
  const formData = new FormData(form);
  const payload = {};

  formData.forEach((value, key) => {
    payload[key] = value;
  });

  return payload;
}

function normalizeProjectPayload(payload = {}) {
  const source = { ...payload };
  const normalized = {};

  const optionalDateKeys = ['fecha_inicio'];
  const optionalTextKeys = ['tipo', 'altura', 'descripcion'];
  const numericKeys = ['largo', 'altura', 'presupuesto', 'costo_estimado', 'area_m2', 'id_mano_obra'];
  const clientIdKeys = ['cliente_id', 'id_cliente'];

  const mapKey = (key, replacementKey) => {
    if (source[key] !== undefined && source[replacementKey] === undefined) {
      source[replacementKey] = source[key];
    }
  };

  mapKey('nombre', 'nombre_proyecto');
  mapKey('fechaInicio', 'fecha_inicio');
  mapKey('presupuesto', 'costo_estimado');
  mapKey('costo_estimado', 'presupuesto');

  if (source.fecha_inicio !== undefined) {
    source.fecha_inicio = normalizeDateValue(source.fecha_inicio);
  }

  if (source.fechaInicio !== undefined) {
    source.fechaInicio = normalizeDateValue(source.fechaInicio);
  }

  if (source.id_cliente === undefined && source.cliente_id !== undefined) {
    source.id_cliente = source.cliente_id;
  }

  if (source.cliente_id === undefined && source.id_cliente !== undefined) {
    source.cliente_id = source.id_cliente;
  }

  if (source.largo !== undefined && source.altura !== undefined && source.largo !== '' && source.altura !== '') {
    const largo = Number(source.largo ?? 0);
    const altura = Number(source.altura ?? 0);
    if (!Number.isNaN(largo) && !Number.isNaN(altura) && largo > 0 && altura > 0) {
      source.area_m2 = Number((largo * altura).toFixed(2));
    }
  }

  if (source.area_m2 === undefined || source.area_m2 === '') {
    const largo = Number(source.largo ?? 0);
    const altura = Number(source.altura ?? 0);
    if (!Number.isNaN(largo) && !Number.isNaN(altura) && (largo > 0 || altura > 0)) {
      source.area_m2 = Number((largo * altura).toFixed(2));
    }
  }

  const allowedKeys = ['id_cliente', 'id_usuario', 'usuario_id', 'nombre_proyecto', 'estado', 'fecha_inicio', 'area_m2', 'largo', 'altura', 'tipo', 'id_mano_obra', 'costo_estimado', 'presupuesto', 'costo_mano_obra', 'precio_mano_obra', 'descripcion'];

  Object.entries(source).forEach(([key, value]) => {
    if (key === 'id' || key === 'ancho' || key === 'notas') return;
    if (!allowedKeys.includes(key)) return;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        if (optionalDateKeys.includes(key) || optionalTextKeys.includes(key) || key === 'costo_estimado' || key === 'presupuesto' || key === 'area_m2') {
          return;
        }
        if (clientIdKeys.includes(key)) {
          return;
        }
      }
      value = trimmed;
    }

    if (clientIdKeys.includes(key) && value !== '' && value !== null && value !== undefined) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) value = parsed;
    }

    if (numericKeys.includes(key) && value !== '' && value !== null && value !== undefined) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        value = parsed;
      }
    }

    if (key === 'nombre_proyecto' && (!value || String(value).trim() === '')) {
      return;
    }

    normalized[key] = value;
  });

  if (normalized.nombre_proyecto === undefined && source.nombre_proyecto !== undefined) {
    normalized.nombre_proyecto = source.nombre_proyecto;
  }

  if (normalized.id_cliente === undefined && source.id_cliente !== undefined) {
    normalized.id_cliente = source.id_cliente;
  }

  if (normalized.costo_estimado === undefined && source.costo_estimado !== undefined) {
    normalized.costo_estimado = source.costo_estimado;
  }

  if (normalized.presupuesto === undefined && source.presupuesto !== undefined) {
    normalized.presupuesto = source.presupuesto;
  }

  if (normalized.area_m2 === undefined && source.area_m2 !== undefined) {
    normalized.area_m2 = source.area_m2;
  }

  if (normalized.id_usuario === undefined && source.id_usuario !== undefined) {
    normalized.id_usuario = source.id_usuario;
  }

  if (normalized.usuario_id === undefined && source.usuario_id !== undefined) {
    normalized.usuario_id = source.usuario_id;
  }

  return normalized;
}

async function loadDashboardData() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (page !== 'index.html') return;

  try {
    const summary = await apiRequest('dashboard/summary');
    const metricCards = document.querySelectorAll('.tarjeta-metrica strong');
    if (!metricCards.length || !summary) return;

    const values = [
      summary.clientes ?? 0,
      summary.proyectos ?? 0,
      summary.materiales ?? 0,
      summary.alertas ?? 0
    ];

    metricCards.forEach((element, index) => {
      element.textContent = values[index] ?? 0;
    });

    const smallTexts = document.querySelectorAll('.tarjeta-metrica small');
    if (smallTexts[0]) smallTexts[0].textContent = summary.clientesLabel || 'Registros actuales';
    if (smallTexts[1]) smallTexts[1].textContent = summary.proyectosLabel || 'En seguimiento';
    if (smallTexts[2]) smallTexts[2].textContent = summary.materialesLabel || 'Disponibles';
    if (smallTexts[3]) smallTexts[3].textContent = summary.alertasLabel || 'Requieren revisión';
  } catch (error) {
    console.warn('Dashboard no disponible:', error.message);
  }
}

async function loadRecentProjects() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (page !== 'index.html') return;

  const container = document.getElementById('proyectos-recientes-container');
  if (!container) return;

  try {
    const projects = await apiRequest('proyectos');
    const items = Array.isArray(projects) ? projects.slice(0, 5) : [];

    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span>▣</span>
          <h3>Aún no hay proyectos</h3>
          <p>Registre su primer proyecto para iniciar el seguimiento.</p>
          <a class="boton boton-secundario" href="modulos/proyectos.html">Registrar proyecto</a>
        </div>
      `;
      return;
    }

    const rows = items.map((project) => {
      const idValue = project.id_proyecto ?? project.id ?? '';
      const nombre = project.nombre || project.nombre_proyecto || 'Sin nombre';
      const cliente = project.cliente_nombre || project.cliente || 'Sin cliente';
      const estado = project.estado || 'Pendiente';
      const fecha = formatDateValue(project.fecha_inicio || project.fechaInicio || '—');
      const presupuesto = project.presupuesto ?? project.costo_estimado ?? 0;

      return `
        <div class="lista-proyectos-recientes__item">
          <div>
            <strong>${escapeHtml(nombre)}</strong>
            <small>${escapeHtml(cliente)}</small>
          </div>
          <div class="lista-proyectos-recientes__meta">
            <span>${escapeHtml(estado)}</span>
            <small>${escapeHtml(fecha)}</small>
            <small>Q ${Number(presupuesto).toFixed(2)}</small>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="lista-proyectos-recientes">
        ${rows}
      </div>
    `;
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <span>▣</span>
        <h3>No se pudieron cargar los proyectos</h3>
        <p>Intente nuevamente más tarde.</p>
      </div>
    `;
    console.warn('No se pudieron cargar los proyectos recientes:', error.message);
  }
}

function obtenerMaterialesProyecto(form) {
  const container = form.querySelector('#listaMaterialesProyecto');
  if (!container) return [];

  return Array.from(container.querySelectorAll('[data-project-material-item]')).map((item) => {
    const idMaterial = item.dataset.materialId;
    const cantidad = Number(item.dataset.cantidad || 0);

    if (!idMaterial || !Number.isFinite(cantidad) || cantidad <= 0) {
      return null;
    }

    return {
      id_material: Number(idMaterial),
      cantidad,
      precio_unitario: Number(item.dataset.precioUnitario || 0)
    };
  }).filter(Boolean);
}

function ensureProjectMaterialTable(list) {
  if (!list) return null;

  if (list.querySelector('.tabla-materiales-proyecto')) {
    return list.querySelector('.tabla-materiales-proyecto');
  }

  list.innerHTML = `
    <div class="tabla-materiales-proyecto">
      <div class="tabla-materiales-proyecto__header">
        <span>Material</span>
        <span>Cantidad</span>
        <span>Subtotal</span>
        <span></span>
      </div>
      <div class="tabla-materiales-proyecto__body"></div>
    </div>
  `;

  return list.querySelector('.tabla-materiales-proyecto');
}

function crearFilaMaterialProyecto(material, cantidad, precio, showActions = true) {
  const row = document.createElement('div');
  row.className = 'tabla-materiales-proyecto__row';
  row.dataset.projectMaterialItem = 'true';
  row.dataset.materialId = String(material.id_material ?? material.id ?? '');
  row.dataset.cantidad = String(cantidad);
  row.dataset.precioUnitario = String(precio);

  const nombre = material.nombre || material.material_nombre || 'Material';
  const subtotal = (Number(cantidad) * Number(precio || 0)).toFixed(2);

  row.innerHTML = `
    <span class="material-proyecto-nombre">${escapeHtml(nombre)}</span>
    <span class="material-proyecto-cantidad">${Math.trunc(Number(cantidad))} un.</span>
    <span class="material-proyecto-subtotal">Q ${subtotal}</span>
    ${showActions ? '<button type="button" class="btn btn-sm btn-outline-danger btn-quitar-material">Quitar</button>' : '<span></span>'}
  `;

  if (showActions) {
    row.querySelector('.btn-quitar-material').onclick = () => row.remove();
  }

  return row;
}

function cargarOpcionesMaterialesProyecto(select) {
  if (!select) return;

  const laborSelect = document.getElementById('proyecto-mano-obra-select');

  return Promise.all([
    apiRequest('materiales'),
    apiRequest('inventario')
  ])
    .then(([materialesResponse, inventarioResponse]) => {
      const materiales = Array.isArray(materialesResponse)
        ? materialesResponse
        : (materialesResponse && Array.isArray(materialesResponse.data) ? materialesResponse.data : []);

      const inventario = Array.isArray(inventarioResponse)
        ? inventarioResponse
        : (inventarioResponse && Array.isArray(inventarioResponse.data) ? inventarioResponse.data : []);

      const stockPorMaterial = {};
      inventario.forEach((item) => {
        const idMaterial = item.id_material ?? item.idMaterial ?? item.material_id ?? item.id ?? '';
        if (idMaterial !== '') {
          stockPorMaterial[String(idMaterial)] = Number(item.stock_actual ?? item.stock ?? 0);
        }
      });

      const laborMaterials = materiales.filter((material) => normalizeErrorText(material.categoria || material.tipo) === 'mano de obra');
      const regularMaterials = materiales.filter((material) => normalizeErrorText(material.categoria || material.tipo) !== 'mano de obra');
      select.innerHTML = '<option value="">Seleccione un material</option>' + regularMaterials.map((material) => {
        const id = material.id_material ?? material.id ?? '';
        const name = material.nombre || 'Material sin nombre';
        const precio = Number(material.precio_unitario ?? material.precio ?? 0);
        const stockDisponible = stockPorMaterial[String(id)] ?? 0;
        return `<option value="${escapeAttribute(id)}" data-precio="${escapeAttribute(String(precio))}" data-stock="${escapeAttribute(String(Math.trunc(Number(stockDisponible))))}">${escapeHtml(name)} - Q ${Number(precio).toFixed(2)} - Disponible: ${Math.trunc(Number(stockDisponible))}</option>`;
      }).join('');

      if (laborSelect) {
        laborSelect.innerHTML = '<option value="">Sin mano de obra</option>' + laborMaterials.map((material) => {
          const id = material.id_material ?? material.id ?? '';
          const name = material.nombre || 'Trabajo de mano de obra';
          const companyPrice = Number(material.precio_unitario ?? material.costo ?? 0);
          const clientPrice = Number(material.precio_venta ?? companyPrice);
          return `<option value="${escapeAttribute(id)}" data-price-m2="${escapeAttribute(String(companyPrice))}">${escapeHtml(name)} - Empresa Q ${companyPrice.toFixed(2)}/m² · Cliente Q ${clientPrice.toFixed(2)}/m²</option>`;
        }).join('');
      }
    })
    .catch((error) => {
      console.warn('No se pudieron cargar los materiales para el proyecto:', error.message);
    });
}

async function bindProjectMaterialButtons(form) {
  const select = form.querySelector('#proyecto-material-select');
  const cantidadInput = form.querySelector('#proyecto-material-cantidad');
  const addButton = form.querySelector('#btnAgregarMaterialProyecto');
  const list = form.querySelector('#listaMaterialesProyecto');

  if (!select || !cantidadInput || !addButton || !list) return;

  ensureProjectMaterialTable(list);
  await cargarOpcionesMaterialesProyecto(select);

  addButton.onclick = () => {
    const materialId = Number(select.value || 0);
    const cantidad = Number(cantidadInput.value || 0);

    if (!materialId || !Number.isFinite(cantidad) || cantidad <= 0) {
      showToast('Seleccione un material y una cantidad válida.', 'error');
      return;
    }

    const selectedOption = select.options[select.selectedIndex];
    const nombre = selectedOption ? selectedOption.text.replace(/\s*-\s*Q\s*[0-9.]+/i, '') : 'Material';
    const precio = Number(selectedOption?.dataset?.precio || 0);
    const stockDisponible = Number(selectedOption?.dataset?.stock || 0);

    const body = list.querySelector('.tabla-materiales-proyecto__body');
    const existingItem = Array.from(list.querySelectorAll('[data-project-material-item]')).find((item) => item.dataset.materialId === String(materialId));
    const totalCantidad = existingItem ? Number(existingItem.dataset.cantidad || 0) + cantidad : cantidad;

    if (totalCantidad > stockDisponible) {
      showToast(`La cantidad supera el stock disponible (${Math.trunc(stockDisponible)}).`, 'error');
      return;
    }

    if (existingItem) {
      const newCantidad = totalCantidad;
      existingItem.dataset.cantidad = String(newCantidad);
      existingItem.querySelector('.material-proyecto-cantidad').textContent = `${Math.trunc(newCantidad)} un.`;
      existingItem.querySelector('.material-proyecto-subtotal').textContent = `Q ${(newCantidad * precio).toFixed(2)}`;
      cantidadInput.value = '';
      select.selectedIndex = 0;
      return;
    }

    const row = document.createElement('div');
    row.className = 'tabla-materiales-proyecto__row';
    row.dataset.projectMaterialItem = 'true';
    row.dataset.materialId = String(materialId);
    row.dataset.cantidad = String(cantidad);
    row.dataset.precioUnitario = String(precio);
    row.innerHTML = `
      <span class="material-proyecto-nombre">${escapeHtml(nombre)}</span>
      <span class="material-proyecto-cantidad">${Math.trunc(cantidad)} un.</span>
      <span class="material-proyecto-subtotal">Q ${(cantidad * precio).toFixed(2)}</span>
      <button type="button" class="btn btn-sm btn-outline-danger btn-quitar-material">Quitar</button>
    `;

    row.querySelector('.btn-quitar-material').onclick = () => row.remove();
    body.appendChild(row);
    cantidadInput.value = '';
    select.selectedIndex = 0;
  };
}

function bindProjectPipelineStatusChanges() {
  const pipeline = document.getElementById('pipelineProyectos');
  if (!pipeline) return;

  pipeline.querySelectorAll('.pipeline-status-select').forEach((select) => {
    select.onchange = async () => {
      const projectId = select.dataset.projectId;
      const nextStatus = select.value;

      if (!projectId || !nextStatus) return;

      try {
        await apiRequest(`proyectos/${projectId}`, {
          method: 'PUT',
          body: { estado: nextStatus }
        });
        showToast('Estado del proyecto actualizado.', 'success');
        await loadCrudLists();
      } catch (error) {
        showToast(error.message || 'No se pudo actualizar el estado del proyecto.', 'error');
      }
    };
  });
}

function renderProjectPipeline(items = []) {
  const pipeline = document.getElementById('pipelineProyectos');
  if (!pipeline) return;

  const groups = {
    Pendiente: [],
    'En proceso': [],
    Finalizado: []
  };

  items.forEach((item) => {
    const estado = item.estado || 'Pendiente';
    const safeState = estado === 'En proceso' ? 'En proceso' : (estado === 'Finalizado' ? 'Finalizado' : 'Pendiente');
    if (!groups[safeState]) {
      groups.Pendiente.push(item);
      return;
    }
    groups[safeState].push(item);
  });

  const configColumns = [
    { key: 'Pendiente', label: 'Pendientes', icon: 'ico pendiente.png', theme: 'pending' },
    { key: 'En proceso', label: 'En Proceso', icon: 'ico en proceso.png', theme: 'progress' },
    { key: 'Finalizado', label: 'Finalizados', icon: 'ico finalizado.png', theme: 'done' }
  ];

  pipeline.innerHTML = configColumns.map((column) => {
    const itemsColumn = groups[column.key] || [];
    const subtitle = column.key === 'Pendiente'
      ? 'Proyectos por iniciar o en espera'
      : column.key === 'En proceso' ? 'Proyectos en ejecución' : 'Proyectos completados';
    const cards = itemsColumn.length
      ? itemsColumn.map((item) => {
          const projectId = findRecordId(item);
          const name = item.nombre || item.nombre_proyecto || 'Proyecto sin nombre';
          const client = item.cliente_nombre || item.cliente || 'Sin cliente';
          const code = item.codigo || `#PRY-${String(projectId || '').padStart(3, '0')}`;
          const date = formatDateValue(item.fecha_inicio || item.fechaInicio || '—');
          const currentStatus = item.estado || column.key;
          return `
            <article class="pipeline-item">
              <div class="pipeline-item__topline">
                <span class="pipeline-item__icon">▣</span>
                <div class="pipeline-item__identity">
                  <strong>${escapeHtml(name)}</strong>
                  <small>${escapeHtml(client)}</small>
                  <span>${escapeHtml(code)} · ${escapeHtml(date)}</span>
                </div>
                <button type="button" class="pipeline-item__menu" data-view-proyecto-id="${projectId}" data-record='${escapeAttribute(JSON.stringify(item))}' aria-label="Ver proyecto">⋮</button>
              </div>
              <label class="pipeline-status-label">
                <span>Estado</span>
                <select class="pipeline-status-select" data-project-id="${projectId}" aria-label="Cambiar estado de proyecto">
                  <option value="Pendiente" ${currentStatus === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                  <option value="En proceso" ${currentStatus === 'En proceso' ? 'selected' : ''}>En proceso</option>
                  <option value="Finalizado" ${currentStatus === 'Finalizado' ? 'selected' : ''}>Finalizado</option>
                </select>
              </label>
            </article>
          `;
        }).join('')
      : '<div class="pipeline-empty">Sin proyectos en este estado</div>';

    return `
      <article class="pipeline-column pipeline-column--${column.theme}">
        <div class="pipeline-header">
          <span class="pipeline-header__icon"><img src="../assets/img/${column.icon}" alt=""></span>
          <div>
            <strong>${column.label}</strong>
            <small>${subtitle}</small>
          </div>
        </div>
        <strong class="pipeline-count">${itemsColumn.length}</strong>
        <div class="pipeline-list">${cards}</div>
      </article>
    `;
  }).join('');

  bindProjectPipelineStatusChanges();
  bindViewProyectoButtons(pipeline);
}

async function loadCrudLists() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const resources = {
    'clientes.html': {
      endpoint: 'clientes',
      tableId: 'tabla-clientes',
      emptyMessage: 'No hay clientes registrados.'
    },
    'proyectos.html': {
      endpoint: 'proyectos',
      tableId: 'tabla-proyectos',
      emptyMessage: 'No hay proyectos registrados.'
    },
    'materiales.html': {
      endpoint: 'materiales',
      tableId: 'tabla-materiales',
      emptyMessage: 'No hay materiales registrados.'
    },
    'inventario.html': {
      endpoint: 'inventario',
      tableId: 'tabla-inventario',
      emptyMessage: 'No hay existencias registradas.'
    },
    'usuarios.html': {
      endpoint: 'usuarios',
      tableId: 'tabla-usuarios',
      emptyMessage: 'No hay usuarios registrados.'
    }
  };

  const config = resources[page];
  if (!config) return;

  const table = document.getElementById(config.tableId);
  if (!table) return;

  try {
    const currentUser = await getCurrentUser();
    const isAdministrator = String(currentUser?.rol || '').trim().toLowerCase() === 'administrador';
    const archiveResource = ['clientes.html', 'proyectos.html', 'usuarios.html'].includes(page)
      ? config.endpoint
      : null;
    const showArchived = page === 'materiales.html'
      ? mostrarMaterialesArchivados
      : Boolean(archiveResource && mostrarArchivados[archiveResource]);
    const resourceEndpoint = showArchived
      ? `${config.endpoint}?estado=Archivado`
      : config.endpoint;
    const response = await apiRequest(resourceEndpoint);
    const items = Array.isArray(response) ? response : (response && Array.isArray(response.data) ? response.data : []);

    if (!items.length) {
      renderEmptyTable(table, config.emptyMessage);
      refreshTableSearchCount(table);
      if (page === 'inventario.html') {
        renderInventorySummary([]);
        await loadInventoryMovements();
      }
      return;
    }

    if (page === 'clientes.html') {
      table.querySelector('tbody').innerHTML = items.map((item) => {
        const record = JSON.stringify(item);
        const idValue = item.id_cliente ?? item.idCliente ?? item.id ?? '';
        return `
          <tr>
            <td>${item.nombre || item.razonSocial || 'Sin nombre'}</td>
            <td>${item.telefono || '—'}</td>
            <td>${item.correo || '—'}</td>
            <td>${item.estado_archivado === 'Archivado' ? 'Archivado' : 'Activo'}</td>
            <td>
              <button class="boton boton-icono" type="button" data-view-ficha="${idValue}" data-record='${escapeAttribute(record)}' title="Ver ficha completa"><img src="../assets/img/ico lupa.png" alt="Ver ficha"></button>
              <button class="boton boton-icono" type="button" data-edit-id="${idValue}" data-edit-endpoint="${config.endpoint}" data-record='${escapeAttribute(record)}' title="Editar"><img src="../assets/img/ico editar.png" alt="Editar"></button>
              ${showArchived
                ? `<button class="boton boton-transparente" type="button" data-unarchive-id="${idValue}" data-unarchive-endpoint="${config.endpoint}" title="Desarchivar">Desarchivar</button>`
                : `<button class="boton boton-icono boton-peligro" type="button" data-archive-id="${idValue}" data-archive-endpoint="${config.endpoint}" title="Archivar"><img src="../assets/img/ico eliminar.png" alt="Archivar"></button>`}
            </td>
          </tr>
        `;
      }).join('');
      bindViewFichaButtons(table);
      bindEditButtons(table);
      bindArchiveButtons(table);
      bindUnarchiveButtons(table);
      return;
    }

    if (page === 'proyectos.html') {
      renderProjectPipeline(items);

      table.querySelector('tbody').innerHTML = items.map((item) => {
        const record = JSON.stringify(item);
        const idValue = findRecordId(item);
        const nombre = item.nombre || item.nombre_proyecto || 'Sin nombre';
        const cliente = item.cliente_nombre || item.cliente || item.nombre_cliente || 'Sin cliente';
        const fecha = formatDateValue(item.fecha_inicio || item.fechaInicio || '—');
        const area = Number(item.area_m2 ?? item.largo ?? 0);
        const altura = item.altura ?? '—';
        const largo = altura !== '—' && area > 0 && Number(altura) > 0
          ? Number((area / Number(altura)).toFixed(2))
          : (item.largo ?? item.area_m2 ?? '—');
        const largoDisplay = largo === '—' || largo === null || largo === undefined ? '—' : Number(largo).toFixed(2);
        const tipo = item.tipo || '—';
        const costoEmpresa = Number(item.costo_total ?? item.costo_estimado ?? 0);
        const cotizacionCliente = Number(item.precio_cotizacion ?? item.presupuesto ?? item.costo_estimado ?? 0);
        const estado = item.estado || 'Pendiente';
        return `
          <tr>
            <td>${escapeHtml(nombre)}</td>
            <td>${escapeHtml(cliente)}</td>
            <td>${escapeHtml(fecha)}</td>
            <td>${escapeHtml(largoDisplay)}</td>
            <td>${escapeHtml(String(altura))}</td>
            <td>${escapeHtml(String(Number(area) > 0 ? Number(area).toFixed(2) : '—'))} ${Number(area) > 0 ? 'm²' : ''}</td>
            <td>${escapeHtml(tipo)}</td>
            <td>Q ${costoEmpresa.toFixed(2)}</td>
            <td>Q ${cotizacionCliente.toFixed(2)}</td>
            <td>${escapeHtml(estado)}</td>
            <td>
              <button class="boton boton-icono" type="button" data-view-proyecto-id="${idValue ?? ''}" data-record='${escapeAttribute(record)}' title="Ver detalle"><img src="../assets/img/ico lupa.png" alt="Ver detalle"></button>
              <button class="boton boton-icono" type="button" data-edit-id="${idValue ?? ''}" data-edit-endpoint="${config.endpoint}" data-record='${escapeAttribute(record)}' title="Editar"><img src="../assets/img/ico editar.png" alt="Editar"></button>
              ${showArchived
                ? `<button class="boton boton-transparente" type="button" data-unarchive-id="${idValue ?? ''}" data-unarchive-endpoint="${config.endpoint}" title="Desarchivar">Desarchivar</button>`
                : (estado === 'Finalizado'
                  ? `<button class="boton boton-icono boton-peligro" type="button" data-archive-id="${idValue ?? ''}" data-archive-endpoint="${config.endpoint}" title="Archivar"><img src="../assets/img/ico eliminar.png" alt="Archivar"></button>`
                  : '')}
            </td>
          </tr>
        `;
      }).join('');
      bindViewProyectoButtons(table);
      bindEditButtons(table);
      bindArchiveButtons(table);
      bindUnarchiveButtons(table);
      return;
    }

    if (page === 'inventario.html') {
      renderInventorySummary(items);
      renderInventoryTable(table, items);
      await loadInventoryMovements();
      return;
    }
    if (page === 'materiales.html') {
      table.querySelector('tbody').innerHTML = items.map((item) => {
        const record = JSON.stringify(item);
        const idValue = findRecordId(item);
        const nombre = item.nombre || 'Sin nombre';
        const categoria = item.categoria || 'Sin categoría';
        const unidad = item.unidad || '—';
        const rendimiento = item.rendimiento ?? '—';
        const costo = item.costo ? `Q ${Number(item.costo).toFixed(2)}` : '—';
        const stockMinimo = item.stock_minimo ?? item.stockMinimo ?? '—';
        const codigo = item.codigo || '—';
        const isLabor = normalizeErrorText(categoria) === 'mano de obra';
        const imagen = item.imagen
          ? `<img src="${escapeAttribute(item.imagen)}" alt="" style="width: 42px; height: 42px; object-fit: cover; border-radius: 6px;">`
          : '<span aria-label="Sin imagen">—</span>';
        return `
          <tr>
            <td>${imagen}</td>
            <td>${codigo}</td>
            <td>${nombre}</td>
            <td>${categoria}</td>
            <td>${unidad}</td>
            <td>${rendimiento !== '—' ? `${Number(rendimiento).toFixed(2)} m²` : '—'}</td>
            <td>${costo}</td>
            <td>${stockMinimo}</td>
            <td>
              <button class="material-menu-trigger" type="button" data-material-menu-trigger aria-label="Más opciones" aria-expanded="false">⋮</button>
              <div class="material-menu" data-material-menu hidden>
                <button type="button" data-material-menu-action="edit">Editar</button>
                <button type="button" data-material-menu-action="delete">${mostrarMaterialesArchivados ? 'Desarchivar' : 'Eliminar'}</button>
              </div>
              <button class="boton boton-icono" type="button" data-view-material data-record='${escapeAttribute(record)}' title="Ver detalle"><img src="../assets/img/ico lupa.png" alt="Ver detalle"></button>
              ${mostrarMaterialesArchivados
                ? `<button class="boton boton-transparente" type="button" data-unarchive-id="${idValue ?? ''}" data-unarchive-endpoint="materiales" title="Desarchivar material">Desarchivar</button>`
                : `${isLabor
                  ? `<button class="boton boton-icono" type="button" data-edit-labor-id="${idValue ?? ''}" data-record='${escapeAttribute(record)}' title="Editar tipo de trabajo"><img src="../assets/img/ico editar.png" alt="Editar tipo de trabajo"></button>`
                  : `<button class="boton boton-icono" type="button" data-edit-id="${idValue ?? ''}" data-edit-endpoint="${config.endpoint}" data-record='${escapeAttribute(record)}' title="Editar"><img src="../assets/img/ico editar.png" alt="Editar"></button>`}
                   ${isAdministrator
                     ? `<button class="boton boton-icono boton-peligro" type="button" data-delete-id="${idValue ?? ''}" data-delete-endpoint="${config.endpoint}" title="Eliminar definitivamente"><img src="../assets/img/ico eliminar.png" alt="Eliminar definitivamente"></button>`
                     : `<button class="boton boton-icono boton-secundario" type="button" data-archive-id="${idValue ?? ''}" data-archive-endpoint="${config.endpoint}" title="Archivar"><img src="../assets/img/ico eliminar.png" alt="Archivar"></button>`}`}
            </td>
          </tr>
        `;
      }).join('');
      bindEditButtons(table);
      bindLaborEditButtons(table);
      bindViewMaterialButtons(table);
      bindMaterialMobileMenus(table);
      bindDeleteButtons(table);
      bindArchiveButtons(table);
      bindUnarchiveButtons(table);
      refreshTableSearchCount(table);
      return;
    }

    if (page === 'usuarios.html') {
      table.querySelector('tbody').innerHTML = items.map((item) => {
        const record = JSON.stringify(item);
        const idValue = item.id_usuario ?? item.idUsuario ?? item.id ?? '';
        const nombre = item.nombre || item.usuario || item.name || 'Sin nombre';
        const correo = item.email || item.correo || '—';
        const rol = item.rol || '—';
        const estado = item.estado || 'Activo';
        return `
          <tr>
            <td>${nombre}</td>
            <td>${correo}</td>
            <td>${rol}</td>
            <td>${estado}</td>
            <td>
              <button class="boton boton-icono" type="button" data-edit-id="${idValue ?? ''}" data-edit-endpoint="${config.endpoint}" data-record='${escapeAttribute(record)}' title="Editar"><img src="../assets/img/ico editar.png" alt="Editar"></button>
              ${showArchived
                ? `<button class="boton boton-transparente" type="button" data-unarchive-id="${idValue ?? ''}" data-unarchive-endpoint="${config.endpoint}" title="Desarchivar">Desarchivar</button>`
                : `<button class="boton boton-icono boton-peligro" type="button" data-archive-id="${idValue ?? ''}" data-archive-endpoint="${config.endpoint}" title="Archivar"><img src="../assets/img/ico eliminar.png" alt="Archivar"></button>`}
            </td>
          </tr>
        `;
      }).join('');
      bindEditButtons(table);
      bindArchiveButtons(table);
      bindUnarchiveButtons(table);
      return;
    }

    table.querySelector('tbody').innerHTML = items.map((item) => {
      const record = JSON.stringify(item);
      const idValue = findRecordId(item);
      return `
        <tr>
          <td>${Object.values(item)[0] || 'Registro'}</td>
          <td>${Object.values(item)[1] || '—'}</td>
          <td>${Object.values(item)[2] || '—'}</td>
          <td>
            <button class="boton boton-transparente" type="button" data-edit-id="${idValue ?? ''}" data-edit-endpoint="${config.endpoint}" data-record='${escapeAttribute(record)}'>Editar</button>
            <button class="boton boton-transparente boton-peligro" type="button" data-delete-id="${idValue ?? ''}" data-delete-endpoint="${config.endpoint}">Eliminar</button>
          </td>
        </tr>
      `;
    }).join('');
    bindEditButtons(table);
    bindDeleteButtons(table);
  } catch (error) {
    renderEmptyTable(table, config.emptyMessage);
    console.warn(`${config.endpoint} no disponible:`, error.message);
  }
}

function bindEditButtons(table) {
  table.querySelectorAll('[data-edit-id]').forEach((boton) => {
    boton.onclick = async () => {
      const id = boton.dataset.editId;
      const endpoint = boton.dataset.editEndpoint;
      const fallbackItem = parseRecordData(boton.dataset.record);

      try {
        let item = fallbackItem;

        if (id && endpoint) {
          try {
            item = await apiRequest(`${endpoint}/${id}`);
          } catch (error) {
            item = fallbackItem;
          }
        }

        if (!item) {
          throw new Error('No se pudo cargar el registro para editar.');
        }

        // Abrir modal de edición en PC y móvil
        if (window.location.pathname.includes('clientes.html')) {
          openClienteEditModal(item, id, endpoint);
          return;
        }

        if (window.location.pathname.includes('materiales.html')) {
          openMaterialEditModal(item, id, endpoint);
          return;
        }

        if (window.location.pathname.includes('usuarios.html')) {
          openUsuarioModal(item, id, endpoint);
          return;
        }

        if (window.location.pathname.includes('proyectos.html')) {
          openProyectoModal(item, id, endpoint);
          return;
        }

        // Fallback para otros módulos
        const form = document.querySelector('form[data-form]');
        if (!form) return;

        const recordId = findRecordId(item) ?? id ?? '';
        const hiddenIdInput = ensureFormIdField(form);
        hiddenIdInput.value = recordId;
        form.dataset.editId = recordId;
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton && !form.dataset.originalSubmitText) {
          form.dataset.originalSubmitText = submitButton.textContent.trim();
        }
        if (submitButton) {
          submitButton.textContent = 'Actualizar registro';
        }

        for (const [key, value] of Object.entries(item)) {
          const field = form.elements.namedItem(key);
          if (field) {
            if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
              field.value = value ?? '';
            }
          }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast('Registro cargado para editar.', 'success');
      } catch (error) {
        showToast(error.message || 'No se pudo cargar el registro para editar.', 'error');
      }
    };
  });
}

function bindDeleteButtons(table) {
  table.querySelectorAll('[data-delete-id]').forEach((boton) => {
    boton.onclick = async () => {
      const id = boton.dataset.deleteId;
      const endpoint = boton.dataset.deleteEndpoint;
      if (!id || !endpoint) return;

      let deleteAction = 'cancel';
      if (endpoint === 'materiales') {
        deleteAction = await showMaterialDeleteModal();
        if (deleteAction === 'cancel') return;
      } else if (!await showConfirmationModal({
        title: 'Eliminar registro',
        message: '¿Deseas eliminar este registro?',
        confirmText: 'Eliminar',
        danger: true
      })) {
        return;
      }

      try {
        const targetEndpoint = deleteAction === 'archive'
          ? `${endpoint}/${id}/archivar`
          : `${endpoint}/${id}`;
        const response = await apiRequest(targetEndpoint, {
          method: deleteAction === 'archive' ? 'PATCH' : 'DELETE'
        });
        showToast(response?.message || 'Registro eliminado correctamente.', 'success');
        await loadCrudLists();
      } catch (error) {
        showToast(error.message || 'No se pudo eliminar el registro.', 'error');
      }
    };
  });
}

function bindArchiveButtons(table) {
  table.querySelectorAll('[data-archive-id]').forEach((button) => {
    button.onclick = async () => {
      const id = button.dataset.archiveId;
      const endpoint = button.dataset.archiveEndpoint;
      if (!id || !endpoint || !await showConfirmationModal({
        title: 'Archivar registro',
        message: '¿Deseas archivar este registro?',
        confirmText: 'Archivar'
      })) return;
      try {
        const response = await apiRequest(`${endpoint}/${id}/archivar`, { method: 'PATCH' });
        showToast(response?.message || 'Registro archivado correctamente.', 'success');
        await loadCrudLists();
      } catch (error) {
        showToast(error.message || 'No se pudo archivar el registro.', 'error');
      }
    };
  });
}

function showConfirmationModal({ title, message, confirmText = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal fade modal-confirmacion';
    modal.tabIndex = -1;
    modal.setAttribute('aria-labelledby', 'titulo-confirmacion');
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="titulo-confirmacion">${escapeHtml(title)}</h5>
            <button type="button" class="btn-close" data-confirm-action="cancel" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body">
            <p>${escapeHtml(message)}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="boton boton-transparente" data-confirm-action="cancel">Cancelar</button>
            <button type="button" class="boton ${danger ? 'boton-peligro' : 'boton-secundario'}" data-confirm-action="confirm">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const instance = new bootstrap.Modal(modal);
    let settled = false;
    const finish = (confirmed) => {
      if (settled) return;
      settled = true;
      resolve(confirmed);
      instance.hide();
    };

    modal.querySelectorAll('[data-confirm-action]').forEach((button) => {
      button.addEventListener('click', () => finish(button.dataset.confirmAction === 'confirm'));
    });
    modal.addEventListener('hidden.bs.modal', () => {
      if (!settled) resolve(false);
      modal.remove();
    }, { once: true });
    instance.show();
  });
}

function showMaterialDeleteModal() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal fade modal-eliminar-material';
    modal.tabIndex = -1;
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Eliminar material</h5>
            <button type="button" class="btn-close" data-action="cancel" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body">
            <p class="modal-eliminar-material__warning">Este material tiene movimientos asociados.</p>
            <p class="modal-eliminar-material__copy">Si archiva el registro, se conserva el historial de movimientos.</p>
          </div>
          <div class="modal-footer modal-eliminar-material__actions">
            <button type="button" class="boton boton-transparente" data-action="cancel">Cancelar</button>
            <button type="button" class="boton boton-secundario" data-action="archive">Archivar</button>
            <button type="button" class="boton boton-peligro" data-action="delete">Eliminar todo</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const instance = new bootstrap.Modal(modal);
    let settled = false;
    const finish = (action) => {
      if (settled) return;
      settled = true;
      resolve(action);
      instance.hide();
    };
    modal.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => finish(button.dataset.action));
    });
    modal.addEventListener('hidden.bs.modal', () => modal.remove(), { once: true });
    instance.show();
  });
}

function bindUnarchiveButtons(table) {
  table.querySelectorAll('[data-unarchive-id]').forEach((button) => {
    button.onclick = async () => {
      const id = button.dataset.unarchiveId;
      if (!id) return;
      try {
        const endpoint = button.dataset.unarchiveEndpoint || 'materiales';
        const response = await apiRequest(`${endpoint}/${id}/desarchivar`, { method: 'PATCH' });
        showToast(response?.message || 'Registro desarchivado correctamente.', 'success');
        await loadCrudLists();
      } catch (error) {
        showToast(error.message || 'No se pudo desarchivar el material.', 'error');
      }
    };
  });
}

function bindViewFichaButtons(table) {
  table.querySelectorAll('[data-view-ficha]').forEach((boton) => {
    boton.onclick = () => {
      const record = parseRecordData(boton.dataset.record);
      if (!record) return;
      showClienteFicha(record);
    };
  });
}

function bindViewMaterialButtons(table) {
  table.querySelectorAll('[data-view-material]').forEach((button) => {
    button.onclick = () => {
      const material = parseRecordData(button.dataset.record);
      if (material) showMaterialDetail(material);
    };
  });
}

function bindMaterialMobileMenus(table) {
  table.querySelectorAll('tbody tr:not(.empty-table)').forEach((row) => {
    row.onclick = (event) => {
      if (event.target.closest('button, a, [data-material-menu]')) return;
      row.querySelector('[data-view-material]')?.click();
    };
  });

  table.querySelectorAll('[data-material-menu-trigger]').forEach((trigger) => {
    const menu = trigger.parentElement.querySelector('[data-material-menu]');
    if (!menu) return;

    trigger.onclick = (event) => {
      event.stopPropagation();
      const shouldOpen = menu.hidden;
      table.querySelectorAll('[data-material-menu]').forEach((item) => { item.hidden = true; });
      table.querySelectorAll('[data-material-menu-trigger]').forEach((item) => { item.setAttribute('aria-expanded', 'false'); });
      menu.hidden = !shouldOpen;
      trigger.setAttribute('aria-expanded', String(shouldOpen));
    };

    menu.querySelectorAll('[data-material-menu-action]').forEach((option) => {
      option.onclick = () => {
        const action = option.dataset.materialMenuAction;
        const row = trigger.closest('tr');
        const target = action === 'edit'
          ? row?.querySelector('[data-edit-id], [data-edit-labor-id]')
          : row?.querySelector('[data-delete-id], [data-archive-id], [data-unarchive-id]');
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        target?.click();
      };
    });
  });
}

async function showMaterialDetail(material) {
  const modal = document.getElementById('modalDetalleMaterial');
  const content = document.getElementById('detalleMaterialContent');
  if (!modal || !content || typeof bootstrap === 'undefined') return;

  const nombre = material.nombre || 'Material sin nombre';
  const imagen = material.imagen
    ? `<img class="detalle-material__image" src="${escapeAttribute(material.imagen)}" alt="${escapeAttribute(nombre)}">`
    : '<div class="detalle-material__image detalle-material__image--empty">Sin imagen</div>';
  const rendimiento = material.rendimiento ?? material.rendimiento_m2_gal ?? '—';
  const costo = material.costo ?? material.precio_unitario;
  let variations = [material];
  try {
    const related = await apiRequest(`materiales/${material.id_material ?? material.id}/variaciones`);
    if (Array.isArray(related) && related.length) variations = related;
  } catch (_error) {
    // El detalle principal sigue disponible aunque no se carguen las variaciones.
  }
  const colorSwatches = variations
    .filter((variation) => variation.codigo_color)
    .map((variation) => `
      <div class="detalle-material__swatch" title="${escapeAttribute(variation.color || 'Color')}" aria-label="${escapeAttribute(variation.color || 'Color')}">
        <i style="background-color: ${escapeAttribute(variation.codigo_color)}"></i>
        <small>${escapeHtml(variation.color || 'Sin nombre')}</small>
      </div>
    `).join('');

  content.innerHTML = `
    <div class="detalle-material__visual">${imagen}</div>
    <div class="detalle-material__info">
      <div class="detalle-material__eyebrow">Código</div>
      <h2>${escapeHtml(material.codigo || 'Sin código')}</h2>
      <h3>${escapeHtml(nombre)}</h3>
      <span class="badge badge--success">Material activo</span>
      <div class="detalle-material__datos">
        <div><span>Categoría</span><strong>${escapeHtml(material.categoria || material.tipo || '—')}</strong></div>
        <div><span>Marca</span><strong>${escapeHtml(material.marca || '—')}</strong></div>
        <div><span>Color</span><strong>${escapeHtml(material.color || '—')}</strong></div>
        <div><span>Código RGB/HEX</span><strong class="detalle-material__color"><i style="background-color: ${escapeAttribute(material.codigo_color || '#ffffff')}"></i>${escapeHtml(material.codigo_color ? formatColorCode(material.codigo_color) : '—')}</strong></div>
        <div><span>Unidad</span><strong>${escapeHtml(material.unidad || material.unidad_medida || '—')}</strong></div>
        <div><span>Rendimiento</span><strong>${escapeHtml(String(rendimiento))} m²</strong></div>
        <div><span>Costo unitario</span><strong>${costo === undefined || costo === null ? '—' : `Q ${Number(costo).toFixed(2)}`}</strong></div>
        <div><span>Stock mínimo</span><strong>${escapeHtml(String(material.stock_minimo ?? '0'))}</strong></div>
      </div>
      <div class="detalle-material__descripcion">
        <h4>Descripción</h4>
        <div class="rich-text-content">${sanitizeRichText(material.descripcion || 'Sin descripción registrada.')}</div>
      </div>
      ${colorSwatches ? `<div class="detalle-material__colores"><h4>Colores disponibles</h4><div class="detalle-material__swatches">${colorSwatches}</div></div>` : ''}
    </div>
  `;

  bootstrap.Modal.getOrCreateInstance(modal).show();
}

function bindViewProyectoButtons(table) {
  table.querySelectorAll('[data-view-proyecto-id]').forEach((boton) => {
    boton.onclick = () => {
      const record = parseRecordData(boton.dataset.record);
      if (!record) return;
      showProyectoDetalle(record);
    };
  });
}

async function showProyectoDetalle(proyecto) {
  const modal = document.getElementById('modalDetalleProyecto');
  const content = document.getElementById('detalleProyectoContent');
  if (!modal || !content) return;

  const nombre = proyecto.nombre || proyecto.nombre_proyecto || 'Sin nombre';
  const cliente = proyecto.cliente_nombre || proyecto.cliente || proyecto.nombre_cliente || 'Sin cliente';
  const estado = proyecto.estado || 'Pendiente';
  const fechaInicio = formatDateValue(proyecto.fecha_inicio || proyecto.fechaInicio || '—');
  const area = proyecto.area_m2 ?? proyecto.largo ?? proyecto.area ?? '—';
  const tipo = proyecto.tipo || '—';
  const manoObraNombre = proyecto.mano_obra_nombre || (proyecto.id_mano_obra ? 'Trabajo de mano de obra seleccionado' : 'Sin mano de obra seleccionada');
  const laborPriceM2 = Number(proyecto.mano_obra_precio_m2 ?? 0);
  const laborArea = Number(proyecto.area_m2 ?? 0);
  const calculatedLaborCost = Number((laborArea * laborPriceM2).toFixed(2));
  const storedLaborCost = Number(proyecto.costo_mano_obra ?? 0);
  const storedLaborPrice = Number(proyecto.precio_mano_obra ?? 0);
  const costoManoObra = storedLaborCost > 0 ? storedLaborCost : calculatedLaborCost;
  const precioManoObra = storedLaborPrice > 0 ? storedLaborPrice : calculatedLaborCost;
  const costoTotal = Number(proyecto.costo_total ?? 0);
  const precioCotizacionRegistrada = Number(proyecto.precio_cotizacion ?? proyecto.presupuesto ?? proyecto.costo_estimado ?? 0);
  const descripcion = proyecto.descripcion || 'Sin observaciones';
  const projectId = proyecto.id_proyecto ?? proyecto.id ?? proyecto.idProyecto ?? '';

  let materiales = Array.isArray(proyecto.materiales) ? proyecto.materiales : [];

  if (projectId && materiales.length === 0) {
    try {
      materiales = await apiRequest(`proyectos/${projectId}/materiales`);
    } catch (_error) {
      materiales = [];
    }
  }

  const totalMateriales = materiales.reduce((sum, item) => sum + Number(item.costo_subtotal ?? 0), 0);
  const costoTotalCalculado = costoTotal || totalMateriales + costoManoObra;
  const precioCotizacion = totalMateriales + precioManoObra || precioCotizacionRegistrada;
  const utilidad = precioCotizacion - costoTotalCalculado;

  const materialesHtml = materiales.length
    ? `
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Materiales:</label>
        <div class="valor-ficha-cliente">
          <div class="tabla-materiales-detalle">
            <div class="tabla-materiales-detalle__header">
              <span>Material</span>
              <span>Cantidad</span>
              <span>Precio</span>
              <span>Subtotal</span>
              <span>Detalle</span>
            </div>
            ${materiales.map((item) => {
              const nombreMaterial = item.material_nombre || item.nombre || 'Material';
              const cantidad = Math.trunc(Number(item.cantidad_calculada ?? item.cantidad ?? 0));
              const precioUnitario = Number(item.precio_unitario ?? 0);
              const subtotal = Number(item.costo_subtotal ?? 0).toFixed(2);
              let detallePeps = [];
              try {
                detallePeps = typeof item.detalle_peps === 'string' ? JSON.parse(item.detalle_peps) : (item.detalle_peps || []);
              } catch (_error) {
                detallePeps = [];
              }
              const detalleTexto = detallePeps.length
                ? detallePeps.map((lote) => `Lote #${lote.id_lote}: ${lote.cantidad} x Q ${Number(lote.costo_unitario).toFixed(2)}`).join('\n')
                : 'No hay desglose de lote disponible para este consumo.';
              return `
                <div class="tabla-materiales-detalle__row">
                  <span>${escapeHtml(nombreMaterial)}</span>
                  <span>${cantidad}</span>
                  <span>Q ${precioUnitario.toFixed(2)}</span>
                  <span>Q ${subtotal}</span>
                  <button class="boton boton-transparente boton-peps" type="button" data-peps-detail="${escapeAttribute(detalleTexto)}" title="Ver detalle del lote">Detalle lote</button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Materiales:</label>
        <div class="valor-ficha-cliente">Q ${totalMateriales.toFixed(2)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Tipo de mano de obra:</label>
        <div class="valor-ficha-cliente">${escapeHtml(manoObraNombre)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Costo mano de obra interna:</label>
        <div class="valor-ficha-cliente">Q ${costoManoObra.toFixed(2)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Mano de obra cobrada:</label>
        <div class="valor-ficha-cliente">Q ${precioManoObra.toFixed(2)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Costo interno total:</label>
        <div class="valor-ficha-cliente">Q ${costoTotalCalculado.toFixed(2)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Cotización al cliente:</label>
        <div class="valor-ficha-cliente">Q ${precioCotizacion.toFixed(2)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Utilidad estimada:</label>
        <div class="valor-ficha-cliente">Q ${utilidad.toFixed(2)}</div>
      </div>
    `
    : `
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Materiales:</label>
        <div class="valor-ficha-cliente">Sin materiales asignados</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Tipo de mano de obra:</label>
        <div class="valor-ficha-cliente">${escapeHtml(manoObraNombre)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Costo mano de obra interna:</label>
        <div class="valor-ficha-cliente">Q ${costoManoObra.toFixed(2)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Mano de obra cobrada:</label>
        <div class="valor-ficha-cliente">Q ${precioManoObra.toFixed(2)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Costo interno total:</label>
        <div class="valor-ficha-cliente">Q ${costoTotalCalculado.toFixed(2)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Cotización al cliente:</label>
        <div class="valor-ficha-cliente">Q ${precioCotizacion.toFixed(2)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Utilidad estimada:</label>
        <div class="valor-ficha-cliente">Q ${utilidad.toFixed(2)}</div>
      </div>
    `;

  content.innerHTML = `
    <div class="contenido-ficha-cliente">
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Proyecto:</label>
        <div class="valor-ficha-cliente">${escapeHtml(nombre)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Cliente:</label>
        <div class="valor-ficha-cliente">${escapeHtml(cliente)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Estado:</label>
        <div class="valor-ficha-cliente">${escapeHtml(estado)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Fecha de inicio:</label>
        <div class="valor-ficha-cliente">${escapeHtml(fechaInicio)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Área:</label>
        <div class="valor-ficha-cliente">${escapeHtml(String(area))} m²</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Tipo:</label>
        <div class="valor-ficha-cliente">${escapeHtml(tipo)}</div>
      </div>
      ${materialesHtml}
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Descripción:</label>
        <div class="valor-ficha-cliente rich-text-content">${sanitizeRichText(descripcion)}</div>
      </div>
    </div>
  `;

  content.querySelectorAll('[data-peps-detail]').forEach((button) => {
    button.onclick = () => showPepsDetailModal(button.dataset.pepsDetail || 'Sin detalle');
  });

  const bootstrapModal = new bootstrap.Modal(modal);
  bootstrapModal.show();
}

function showPepsDetailModal(detail) {
  const previousModal = document.querySelector('[data-peps-modal]');
  if (previousModal) previousModal.remove();

  const modal = document.createElement('div');
  modal.className = 'modal fade modal-peps-detalle';
  modal.dataset.pepsModal = 'true';
  modal.tabIndex = -1;
  modal.setAttribute('aria-labelledby', 'modalPepsDetalleLabel');
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal-dialog modal-dialog-centered modal-sm">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="modalPepsDetalleLabel">Detalle del lote</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
        </div>
        <div class="modal-body">
          <p class="modal-peps-detalle__intro">Información de los lotes utilizados:</p>
          <pre class="modal-peps-detalle__contenido"></pre>
        </div>
        <div class="modal-footer">
          <button type="button" class="boton boton-principal" data-bs-dismiss="modal">Cerrar</button>
        </div>
      </div>
    </div>
  `;
  modal.querySelector('.modal-peps-detalle__contenido').textContent = detail;
  modal.addEventListener('hidden.bs.modal', () => modal.remove(), { once: true });
  document.body.appendChild(modal);
  new bootstrap.Modal(modal).show();
}

function showClienteFicha(cliente) {
  const modal = document.getElementById('modalFichaCliente');
  const content = document.getElementById('fichaClienteContent');
  if (!modal || !content) return;

  const fieldsHTML = `
    <div class="contenido-ficha-cliente">
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Nombre o razón social:</label>
        <div class="valor-ficha-cliente">${cliente.nombre || cliente.razonSocial || '—'}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">DPI/NIT:</label>
        <div class="valor-ficha-cliente">${cliente.identificacion || '—'}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Teléfono:</label>
        <div class="valor-ficha-cliente">${cliente.telefono || '—'}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Correo electrónico:</label>
        <div class="valor-ficha-cliente">${cliente.correo || '—'}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Dirección:</label>
        <div class="valor-ficha-cliente">${cliente.direccion || '—'}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Observaciones:</label>
        <div class="valor-ficha-cliente">${cliente.notas || '—'}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Estado:</label>
        <div class="valor-ficha-cliente">${cliente.estado || 'Activo'}</div>
      </div>
    </div>
  `;

  content.innerHTML = fieldsHTML;
  const bootstrapModal = new bootstrap.Modal(modal);
  bootstrapModal.show();
}

function setupMaterialModal() {
  const btnAgregar = document.getElementById('btnAgregarMaterial');
  const btnCategorias = document.getElementById('btnEditarCategorias');
  const btnActivos = document.getElementById('btnMaterialesActivos');
  const btnArchivados = document.getElementById('btnMaterialesArchivados');

  const setMaterialView = async (archived) => {
    mostrarMaterialesArchivados = archived;
    btnActivos?.classList.toggle('activa', !archived);
    btnArchivados?.classList.toggle('activa', archived);
    btnActivos?.setAttribute('aria-selected', String(!archived));
    btnArchivados?.setAttribute('aria-selected', String(archived));
    await loadCrudLists();
  };

  btnActivos?.addEventListener('click', () => setMaterialView(false));
  btnArchivados?.addEventListener('click', () => setMaterialView(true));

  if (btnAgregar) btnAgregar.addEventListener('click', () => {
    openMaterialModal();
  });

  if (btnCategorias) btnCategorias.addEventListener('click', () => {
    openMaterialCategoriesModal();
  });

  loadMaterialCategories();
}

function setupLaborModal() {
  const button = document.getElementById('btnAgregarManoObra');
  const modal = document.getElementById('modalAgregarManoObra');
  const form = document.getElementById('formAgregarManoObra');
  const saveButton = document.getElementById('btnGuardarManoObra');
  if (!button || !modal || !form || !saveButton || typeof bootstrap === 'undefined') return;

  button.addEventListener('click', () => {
    openLaborModal();
  });

  saveButton.onclick = async () => {
    try {
      clearFormErrors();
      if (!form.checkValidity()) {
        displayValidationErrors(form);
        return;
      }

      const currentUser = await getCurrentUser();
      const laborId = form.dataset.editId || '';
      const response = await apiRequest(laborId ? `materiales/${laborId}` : 'materiales', {
        method: laborId ? 'PUT' : 'POST',
        body: {
          nombre: form.querySelector('[name="nombre"]').value.trim(),
          categoria: 'Mano de obra',
          unidad: 'm²',
          rendimiento: 0,
          costo: Number(form.querySelector('[name="costo"]').value),
          precio_venta: Number(form.querySelector('[name="precio_venta"]').value),
          stock_minimo: 0,
          descripcion: form.querySelector('[name="descripcion"]').value.trim(),
          id_usuario: currentUser?.id_usuario ?? currentUser?.id ?? ''
        }
      });

      showToast(response?.message || (laborId ? 'Tipo de mano de obra actualizado correctamente.' : 'Tipo de mano de obra guardado correctamente.'), 'success');
      bootstrap.Modal.getInstance(modal)?.hide();
      await loadCrudLists();
    } catch (error) {
      handleFormError(error, form);
    }
  };
}

function openLaborModal(material = null, id = '') {
  const modal = document.getElementById('modalAgregarManoObra');
  const form = document.getElementById('formAgregarManoObra');
  const title = document.getElementById('modalAgregarManoObraLabel');
  if (!modal || !form || typeof bootstrap === 'undefined') return;

  form.reset();
  form.dataset.editId = id || '';
  clearFormErrors();
  if (title) title.textContent = material ? 'Editar tipo de mano de obra' : 'Nuevo tipo de mano de obra';
  if (material) {
    form.querySelector('[name="nombre"]').value = material.nombre || '';
    form.querySelector('[name="costo"]').value = material.costo ?? material.precio_unitario ?? '';
    form.querySelector('[name="precio_venta"]').value = material.precio_venta ?? material.costo ?? material.precio_unitario ?? '';
    form.querySelector('[name="descripcion"]').value = material.descripcion || '';
  }
  new bootstrap.Modal(modal).show();
}

function bindLaborEditButtons(table) {
  table.querySelectorAll('[data-edit-labor-id]').forEach((button) => {
    button.onclick = async () => {
      const id = button.dataset.editLaborId;
      const fallback = parseRecordData(button.dataset.record);
      let material = fallback;
      try {
        if (id) material = await apiRequest(`materiales/${id}`);
      } catch (_error) {
        material = fallback;
      }
      if (material) openLaborModal(material, id);
    };
  });
}

function openMaterialEditModal(material, id, endpoint) {
  openMaterialModal(material, id, endpoint);
}

async function generateMaterialCodeForCategory(categoryId, categoryName = '') {
  try {
    const categories = await apiRequest('materiales/categorias');
    const selectedCategory = categories.find((category) => {
      const categoryIdentifier = String(category.id ?? category.id_categoria ?? '');
      return categoryIdentifier === String(categoryId) || String(category.nombre) === String(categoryName || '');
    });

    const rawPrefix = selectedCategory?.prefijo_codigo || selectedCategory?.nombre || categoryName || 'MAT';
    const prefix = String(rawPrefix).replace(/[^A-Za-z]/g, '').slice(0, 10).toUpperCase() || 'MAT';
    const materials = await apiRequest('materiales');
    const escapePattern = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escapePattern}-(\\d+)$`, 'i');

    let maxNumber = 0;
    for (const material of materials) {
      const match = String(material.codigo || '').match(pattern);
      if (match) {
        const numericCode = Number(match[1] || 0);
        if (numericCode > maxNumber) maxNumber = numericCode;
      }
    }

    return `${prefix}-${String(maxNumber + 1).padStart(3, '0')}`;
  } catch (_error) {
    return 'MAT-001';
  }
}

async function openMaterialModal(material = null, id = '', endpoint = 'materiales') {
  const modal = document.getElementById('modalEditarMaterial');
  const form = document.getElementById('formEditarMaterial');
  if (!modal || !form) return;

  form.reset();
  setRichTextValue('modalMaterial-descripcion');
  form.querySelector('input[name="id"]').value = id || '';
  clearFormErrors();

  const titleModal = document.getElementById('modalEditarMaterialLabel');
  if (titleModal) titleModal.textContent = material ? 'Editar material' : 'Agregar nuevo material';

  const imageInput = form.querySelector('#modalMaterial-imagen');
  const imageValue = form.querySelector('input[name="imagen"]');
  const imagePreview = form.querySelector('#modalMaterial-imagenVista');
  const setImagePreview = (source) => {
    if (!imagePreview) return;
    imagePreview.src = source || '';
    imagePreview.hidden = !source;
  };
  if (imageInput) imageInput.value = '';
  if (imageValue) imageValue.value = '';
  setImagePreview('');
  if (imageInput) {
    imageInput.onchange = () => {
      const file = imageInput.files?.[0];
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MATERIAL_IMAGE_MAX_MB * 1024 * 1024) {
        imageInput.value = '';
        showToast(`Seleccione una imagen JPG, PNG o WebP de máximo ${MATERIAL_IMAGE_MAX_MB} MB.`, 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const imageData = String(reader.result || '');
        if (imageValue) imageValue.value = imageData;
        setImagePreview(imageData);
      };
      reader.readAsDataURL(file);
    };
  }

  setupMaterialInitialInventory(form, !material);
  await loadMaterialCategories(material ? material.categoria : '');

  const categorySelect = form.querySelector('#modalMaterial-categoria');
  const codeInput = form.querySelector('#modalMaterial-codigo');
  const colorVariationsGroup = form.querySelector('[data-color-variations]');
  const addColorVariationButton = form.querySelector('[data-add-color-variation]');
  const paintingCheckbox = form.querySelector('#modalMaterial-esPintura');
  const paintingGroup = paintingCheckbox?.closest('.grupo-formulario');
  const colorVariationList = form.querySelector('[data-color-variation-list]');
  if (colorVariationList) colorVariationList.innerHTML = '';
  const initialQuantity = form.querySelector('#modalMaterial-stockInicial');
  const initialQuantityGroup = initialQuantity?.closest('.grupo-formulario');

  const syncColorVariationFields = () => {
    const canRegisterInventory = form.dataset.canRegisterInventory === 'true';
    const usesVariations = !material && Boolean(paintingCheckbox?.checked)
      && !colorVariationsGroup?.hidden;
    const minimumLabel = form.querySelector('label[for="modalMaterial-minimo"]');
    if (minimumLabel) minimumLabel.textContent = usesVariations ? 'Stock mínimo (todas las variaciones)' : 'Stock mínimo';
    if (initialQuantityGroup) initialQuantityGroup.hidden = !canRegisterInventory || usesVariations;
    if (initialQuantity) {
      initialQuantity.disabled = !canRegisterInventory || usesVariations;
      initialQuantity.required = canRegisterInventory && !usesVariations;
    }
    colorVariationList?.querySelectorAll('[data-variation-name], [data-variation-quantity]').forEach((input) => {
      input.required = usesVariations;
      input.disabled = !usesVariations;
    });
  };

  addColorVariationButton.onclick = () => {
    colorVariationList.insertAdjacentHTML('beforeend', `<div class="fila-codigo-color" data-color-row>
      <label class="campo-variacion">Color
        <input type="text" data-variation-name maxlength="60" placeholder="Ej. Blanco">
      </label>
      <label class="campo-variacion campo-variacion--codigo">Código HEX
        <span class="selector-variacion-color">
          <input type="color" data-variation-color value="#ffffff" aria-label="Seleccionar código de color">
          <output data-variation-output>#FFFFFF</output>
        </span>
      </label>
      <label class="campo-variacion">Cantidad inicial
        <input type="number" data-variation-quantity min="0.01" step="0.01" placeholder="0.00">
      </label>
      <button type="button" class="boton-quitar-variacion" data-remove-color-variation title="Quitar variación" aria-label="Quitar variación">×</button>
    </div>`);
    syncColorVariationFields();
    colorVariationList.lastElementChild.querySelector('[data-variation-name]').focus();
  };

  const getColorVariations = () => [...(colorVariationList?.querySelectorAll('[data-color-row]') || [])]
    .map((row) => ({
      color: row.querySelector('[data-variation-name]').value.trim(),
      codigo_color: row.querySelector('[data-variation-color]').value,
      stock_inicial: row.querySelector('[data-variation-quantity]')?.value
    }));
  const updateLaborFields = () => {
    const selectedCategoryName = categorySelect?.selectedOptions[0]?.textContent || categorySelect?.value || '';
    const normalizedCategory = normalizeErrorText(selectedCategoryName);
    const isLabor = normalizedCategory === 'mano de obra';
    const supportsColorVariants = Boolean(paintingCheckbox?.checked) && !isLabor;
    const laborPriceLabel = form.querySelector('label[for="modalMaterial-costo"]');
    if (laborPriceLabel) laborPriceLabel.textContent = isLabor ? 'Precio por m² (Q)' : 'Costo unitario (Q)';
    if (paintingGroup) paintingGroup.hidden = Boolean(material);
    if (colorVariationsGroup) colorVariationsGroup.hidden = Boolean(material) || !supportsColorVariants;
    if (paintingCheckbox) {
      paintingCheckbox.disabled = isLabor;
      if (isLabor) paintingCheckbox.checked = false;
    }
    setupMaterialInitialInventory(form, !material && !isLabor);
    syncColorVariationFields();
  };
  paintingCheckbox?.addEventListener('change', updateLaborFields);
  colorVariationList.onclick = (event) => {
    if (!event.target.closest('[data-remove-color-variation]')) return;
    event.target.closest('[data-color-row]').remove();
    syncColorVariationFields();
  };
  colorVariationList.oninput = (event) => {
    const input = event.target.closest('[data-variation-color]');
    const output = input?.closest('[data-color-row]').querySelector('[data-variation-output]');
    if (input && output) output.textContent = formatColorCode(input.value);
  };
  categorySelect?.addEventListener('change', updateLaborFields);
  updateLaborFields();
  if (codeInput) {
    codeInput.readOnly = true;
    codeInput.dataset.generated = '1';
  }

  const updateGeneratedCode = async () => {
    if (!categorySelect || !codeInput) return;
    const selectedOption = categorySelect.selectedOptions[0];
    if (!selectedOption || !categorySelect.value) return;
    codeInput.value = await generateMaterialCodeForCategory(categorySelect.value, selectedOption.textContent || '');
    codeInput.dataset.generated = '1';
  };

  if (categorySelect && !material) {
    categorySelect.onchange = updateGeneratedCode;
  }

  if (material) {
    if (categorySelect) {
      const categoriaValue = material.id_categoria ?? material.categoria_id ?? material.categoria ?? '';
      if (categoriaValue) {
        const normalizedValue = String(categoriaValue);
        const exists = [...categorySelect.options].some((option) => String(option.value) === normalizedValue);
        if (exists) {
          categorySelect.value = normalizedValue;
        } else {
          const categoryName = String(material.categoria || '').trim();
          if (categoryName) {
            const matchingOption = [...categorySelect.options].find((option) => option.textContent.trim() === categoryName);
            if (matchingOption) categorySelect.value = matchingOption.value;
          }
        }
      }
    }

    if (codeInput) {
      codeInput.value = material.codigo || '';
    }

    form.querySelector('#modalMaterial-nombre').value = material.nombre || '';
    form.querySelector('#modalMaterial-marca').value = material.marca || '';
    form.querySelector('#modalMaterial-unidad').value = material.unidad || '';
    form.querySelector('#modalMaterial-rendimiento').value = material.rendimiento ?? '';
    form.querySelector('#modalMaterial-costo').value = material.costo ?? '';
    form.querySelector('#modalMaterial-minimo').value = material.stock_minimo ?? material.stockMinimo ?? '';
    if (paintingCheckbox) paintingCheckbox.checked = Boolean(material.color || material.codigo_color);
    setRichTextValue('modalMaterial-descripcion', material.descripcion || '');
    if (imageValue) imageValue.value = material.imagen || '';
    setImagePreview(material.imagen || '');
  } else if (categorySelect) {
    categorySelect.onchange = updateGeneratedCode;
    if (categorySelect.value) {
      await updateGeneratedCode();
    }
  }

  updateLaborFields();
  syncColorVariationFields();

  form.dataset.endpoint = endpoint;

  const btnGuardar = document.getElementById('btnGuardarMaterial');
  btnGuardar.onclick = async () => {
    try {
      clearFormErrors();

      if (!form.checkValidity()) {
        displayValidationErrors(form);
        form.querySelector(':invalid')?.reportValidity();
        return;
      }

      syncRichTextEditors();
      const materialId = form.querySelector('input[name="id"]').value;
      const payload = {};
      const formData = new FormData(form);
      for (const [key, value] of formData.entries()) {
        if (key !== 'id' && key !== 'codigo' && key !== 'imagen_archivo') payload[key] = value;
      }

      const categorySelect = form.querySelector('#modalMaterial-categoria');
      if (categorySelect && categorySelect.value) {
        payload.id_categoria = categorySelect.value;
        const selectedOption = categorySelect.selectedOptions[0];
        if (selectedOption && selectedOption.textContent) {
          payload.categoria = selectedOption.textContent.trim();
        }
      }

      const colorVariations = getColorVariations();
      delete payload.codigo_color;
      payload.codigo = (form.querySelector('#modalMaterial-codigo')?.value || '').trim();

      const isCreating = !materialId;

      const currentUser = await getCurrentUser();
      if (currentUser) {
        payload.id_usuario = currentUser.id_usuario ?? currentUser.id ?? '';
      }

      if (!isCreating) {
        delete payload.stock_inicial;
        delete payload.referencia_inventario;
        payload.color = material.color || null;
        payload.codigo_color = material.codigo_color || null;
      }

      const requestUrl = isCreating ? endpoint : `${endpoint}/${materialId}`;
      const method = isCreating ? 'POST' : 'PUT';

      const categoryName = normalizeErrorText(payload.categoria || payload.tipo || '');
      const supportsColorVariants = Boolean(form.querySelector('#modalMaterial-esPintura')?.checked)
        && categoryName !== 'mano de obra';
      if (isCreating && !supportsColorVariants) {
        delete payload.color;
        delete payload.codigo_color;
      }
      const colors = isCreating && supportsColorVariants
        ? colorVariations
        : [];
      if (isCreating && supportsColorVariants && !colors.length) {
        showToast('Agregue al menos una variación de color.', 'error');
        return;
      }
      const seenColors = new Set();
      const duplicateColor = colors.find((variation) => {
        const normalized = variation.color.toLocaleLowerCase();
        if (seenColors.has(normalized)) return true;
        seenColors.add(normalized);
        return false;
      });
      if (duplicateColor) {
        showToast(`El color ${duplicateColor.color} está repetido.`, 'error');
        return;
      }
      if (colors.length) delete payload.stock_inicial;
      let responses = null;
      if (colors.length) {
        responses = await apiRequest(requestUrl, {
          method,
          body: { ...payload, variaciones: colors }
        });
      } else {
        responses = await apiRequest(requestUrl, { method, body: payload });
      }

      const successMessage = colors.length
        ? `${colors.length} variaciones de pintura creadas correctamente.`
        : (responses?.message || (isCreating ? 'Material registrado correctamente.' : 'Material actualizado correctamente.'));
      showToast(successMessage, 'success');

      const bootstrapModal = bootstrap.Modal.getInstance(modal);
      if (bootstrapModal) bootstrapModal.hide();

      setTimeout(() => {
        loadCrudLists();
      }, 300);
    } catch (error) {
      handleFormError(error, form);
    }
  };

  const bootstrapModal = new bootstrap.Modal(modal);
  bootstrapModal.show();
}

async function loadMaterialCategories(selectedValue = '') {
  const select = document.getElementById('modalMaterial-categoria');
  const categorySelect = document.getElementById('categoriaMaterial-lista');
  if (!select && !categorySelect) return [];

  try {
    const categories = await apiRequest('materiales/categorias');
    const materialCategories = categories.filter((category) => normalizeErrorText(category.nombre) !== 'mano de obra');
    const options = materialCategories.map((category) => `<option value="${escapeAttribute(String(category.id ?? category.id_categoria ?? ''))}" data-prefijo="${escapeAttribute(String(category.prefijo_codigo || ''))}" data-nombre="${escapeAttribute(category.nombre || '')}">${category.nombre}</option>`).join('');

    if (select) {
      const currentValue = selectedValue || select.value;
      select.innerHTML = `<option value="">Seleccione una categoría</option>${options}`;
      const targetValue = currentValue && categories.some((category) => String(category.id ?? category.id_categoria) === String(currentValue))
        ? String(currentValue)
        : categories.find((category) => String(category.nombre) === String(currentValue))
          ? String(categories.find((category) => String(category.nombre) === String(currentValue)).id ?? categories.find((category) => String(category.nombre) === String(currentValue)).id_categoria)
          : '';
      if (targetValue) select.value = targetValue;
    }

    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">Nueva categoría</option>' + categories
        .map((category) => `<option value="${category.id}" data-nombre="${escapeAttribute(category.nombre || '')}" data-prefijo="${escapeAttribute(String(category.prefijo_codigo || ''))}">${category.nombre}</option>`)
        .join('');
    }

    return categories;
  } catch (error) {
    showToast(error.message || 'No se pudieron cargar las categorías.', 'error');
    return [];
  }
}

function setupMaterialInitialInventory(form, canRegisterInventory) {
  const container = form.querySelector('[data-inventory-initial]');
  const fields = form.querySelector('[data-inventory-initial-fields]');
  const quantity = form.querySelector('#modalMaterial-stockInicial');
  if (!container || !fields || !quantity) return;

  form.dataset.canRegisterInventory = String(canRegisterInventory);
  container.hidden = false;
  quantity.closest('.grupo-formulario').hidden = !canRegisterInventory;
  quantity.disabled = !canRegisterInventory;
  quantity.required = canRegisterInventory;
  const reference = form.querySelector('#modalMaterial-referenciaInventario');
  if (reference) reference.closest('.grupo-formulario').hidden = !canRegisterInventory;
}

async function openMaterialCategoriesModal() {
  const modal = document.getElementById('modalCategoriasMaterial');
  const form = document.getElementById('formCategoriasMaterial');
  const select = document.getElementById('categoriaMaterial-lista');
  const input = document.getElementById('categoriaMaterial-nombre');
  const prefixInput = document.getElementById('categoriaMaterial-prefijo');
  const btnGuardar = document.getElementById('btnGuardarCategoria');
  const btnEliminar = document.getElementById('btnEliminarCategoria');
  if (!modal || !form || !select || !input || !prefixInput || !btnGuardar || !btnEliminar) return;

  const currentUser = await getCurrentUser();
  const isAdministrator = String(currentUser?.rol || '').trim().toLowerCase() === 'administrador';
  btnEliminar.hidden = !isAdministrator;

  clearFormErrors();
  form.reset();
  await loadMaterialCategories();

  select.onchange = () => {
    const selectedOption = select.selectedOptions[0];
    input.value = selectedOption && selectedOption.dataset.nombre ? selectedOption.dataset.nombre : '';
    prefixInput.value = selectedOption && selectedOption.dataset.prefijo ? selectedOption.dataset.prefijo : '';
    btnEliminar.disabled = !select.value;
  };
  btnEliminar.disabled = true;

  btnGuardar.onclick = async () => {
    try {
      clearFormErrors();
      const nombre = input.value.trim();
      const prefijoCodigo = prefixInput.value.trim();
      if (!nombre) {
        applyFieldError(form, 'categoria_nombre', 'El nombre de la categoría es obligatorio.');
        return;
      }
      if (!prefijoCodigo) {
        applyFieldError(form, 'categoria_prefijo', 'El prefijo del código es obligatorio.');
        return;
      }

      const id = select.value;
      const response = await apiRequest(id ? `materiales/categorias/${id}` : 'materiales/categorias', {
        method: id ? 'PUT' : 'POST',
        body: { nombre, prefijo_codigo: prefijoCodigo }
      });

      showToast(response?.message || 'Categoría guardada correctamente.', 'success');
      await loadMaterialCategories(nombre);
      await loadCrudLists();
      form.reset();
      btnEliminar.disabled = true;
    } catch (error) {
      handleFormError(error, form);
    }
  };

  btnEliminar.onclick = async () => {
    const id = select.value;
    if (!id) return;
    const confirmed = await showConfirmationModal({
      title: 'Eliminar categoría',
      message: '¿Deseas eliminar esta categoría?',
      confirmText: 'Eliminar',
      danger: true
    });
    if (!confirmed) return;

    try {
      const response = await apiRequest(`materiales/categorias/${id}`, { method: 'DELETE' });
      showToast(response?.message || 'Categoría eliminada correctamente.', 'success');
      await loadMaterialCategories();
      form.reset();
      btnEliminar.disabled = true;
    } catch (error) {
      handleFormError(error, form);
    }
  };

  const bootstrapModal = new bootstrap.Modal(modal);
  bootstrapModal.show();
}

function setupClienteModal() {
  const btnAgregar = document.getElementById('btnAgregarCliente');
  if (!btnAgregar) return;

  btnAgregar.addEventListener('click', () => {
    const modal = document.getElementById('modalEditarCliente');
    const form = document.getElementById('formEditarCliente');
    if (!modal || !form) return;

    // Limpiar formulario
    form.reset();
    form.querySelector('input[name="id"]').value = '';
    clearFormErrors();
    
    // Cambiar título del modal
    const titleModal = document.getElementById('modalEditarClienteLabel');
    if (titleModal) titleModal.textContent = 'Agregar nuevo cliente';

    // Establecer endpoint para crear nuevo cliente
    form.dataset.endpoint = 'clientes';

    // Manejar clic en botón guardar
    const btnGuardar = document.getElementById('btnGuardarCliente');
    btnGuardar.onclick = async () => {
      try {
        clearFormErrors();
        
        if (!form.checkValidity()) {
          displayValidationErrors(form);
          return;
        }

        const payload = new FormData(form);
        const data = {};
        for (const [key, value] of payload.entries()) {
          if (key !== 'id') data[key] = value;
        }

        const currentUser = await getCurrentUser();
        if (currentUser) {
          data.id_usuario = currentUser.id_usuario ?? currentUser.id ?? '';
        }

        const response = await apiRequest('clientes', {
          method: 'POST',
          body: data
        });

        showToast(response?.message || 'Cliente registrado correctamente.', 'success');
        
        // Cerrar modal y recargar tabla
        const bootstrapModal = bootstrap.Modal.getInstance(modal);
        if (bootstrapModal) bootstrapModal.hide();
        
        setTimeout(() => {
          loadCrudLists();
        }, 300);
      } catch (error) {
        handleFormError(error, form);
      }
    };

    // Mostrar modal
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
  });
}

function openClienteEditModal(cliente, id, endpoint) {
  const modal = document.getElementById('modalEditarCliente');
  const form = document.getElementById('formEditarCliente');
  if (!modal || !form) return;

  // Cambiar título del modal
  const titleModal = document.getElementById('modalEditarClienteLabel');
  if (titleModal) titleModal.textContent = 'Editar cliente';

  // Limpiar errores previos
  clearFormErrors();

  // Llenar el formulario modal con los datos del cliente
  form.querySelector('input[name="id"]').value = id || '';
  form.querySelector('#modalCliente-nombre').value = cliente.nombre || cliente.razonSocial || '';
  form.querySelector('#modalCliente-nit').value = cliente.identificacion || '';
  form.querySelector('#modalCliente-telefono').value = cliente.telefono || '';
  form.querySelector('#modalCliente-correo').value = cliente.correo || '';
  form.querySelector('#modalCliente-direccion').value = cliente.direccion || '';
  form.querySelector('#modalCliente-notas').value = cliente.notas || '';

  // Manejar clic en botón guardar
  const btnGuardar = document.getElementById('btnGuardarCliente');
  
  btnGuardar.onclick = async () => {
    try {
      clearFormErrors();
      
      if (!form.checkValidity()) {
        displayValidationErrors(form);
        return;
      }

      const clienteId = form.querySelector('input[name="id"]').value;
      const payload = new FormData(form);
      const data = {};
      for (const [key, value] of payload.entries()) {
        if (key !== 'id') data[key] = value;
      }

      const currentUser = await getCurrentUser();
      if (currentUser) {
        data.id_usuario = currentUser.id_usuario ?? currentUser.id ?? '';
      }

      // Determinar si es crear o actualizar
      const isCreating = !clienteId;
      const requestUrl = isCreating ? endpoint : `${endpoint}/${clienteId}`;
      const method = isCreating ? 'POST' : 'PUT';

      const response = await apiRequest(requestUrl, {
        method: method,
        body: data
      });

      const message = isCreating 
        ? (response?.message || 'Cliente registrado correctamente.') 
        : (response?.message || 'Cliente actualizado correctamente.');
      
      showToast(message, 'success');
      
      // Cerrar modal y recargar tabla
      const bootstrapModal = bootstrap.Modal.getInstance(modal);
      if (bootstrapModal) bootstrapModal.hide();
      
      setTimeout(() => {
        loadCrudLists();
      }, 300);
    } catch (error) {
      handleFormError(error, form);
    }
  };

  // Mostrar modal
  const bootstrapModal = new bootstrap.Modal(modal);
  bootstrapModal.show();
}

function findRecordId(item) {
  if (!item || typeof item !== 'object') return '';
  return item.id_proyecto ?? item.idProyecto ?? item.id_usuario ?? item.idUsuario ?? item.id_material ?? item.idMaterial ?? item.id_cliente ?? item.idCliente ?? item.id ?? '';
}

function parseRecordData(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    return null;
  }
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#039;');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ensureFormIdField(form) {
  let hiddenIdInput = form.querySelector('input[name="id"]');
  if (!hiddenIdInput) {
    hiddenIdInput = document.createElement('input');
    hiddenIdInput.type = 'hidden';
    hiddenIdInput.name = 'id';
    hiddenIdInput.value = '';
    form.appendChild(hiddenIdInput);
  }
  return hiddenIdInput;
}

function renderEmptyTable(table, message) {
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  const columnCount = table.querySelectorAll('thead th').length || 1;
  tbody.innerHTML = `<tr class="empty-table"><td colspan="${columnCount}">${message}</td></tr>`;
}

function updateResponsiveTableLabels(table) {
  const headers = [...table.querySelectorAll('thead th')].map((header) => header.textContent.trim());
  table.querySelectorAll('tbody tr:not(.empty-table)').forEach((row) => {
    [...row.children].forEach((cell, index) => {
      cell.dataset.label = headers[index] || '';
    });
  });
}

function setupResponsiveTables() {
  document.querySelectorAll('.contenedor-tabla table, .tabla-reporte table').forEach((table) => {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    updateResponsiveTableLabels(table);
    new MutationObserver(() => updateResponsiveTableLabels(table)).observe(tbody, { childList: true });
  });
}

async function setupProyectoModal() {
  const button = document.getElementById('btnAgregarProyecto');
  if (!button || typeof bootstrap === 'undefined') return;

  button.addEventListener('click', () => {
    openProyectoModal();
  });
}

async function openProyectoModal(proyecto = null, id = '', endpoint = 'proyectos') {
  const modal = document.getElementById('modalEditarProyecto');
  const form = document.getElementById('formEditarProyecto');
  if (!modal || !form || typeof bootstrap === 'undefined') return;

  form.reset();
  setRichTextValue('modalProyecto-descripcion');
  form.querySelector('input[name="id"]').value = id || '';
  form.dataset.projectUserId = proyecto ? (proyecto.id_usuario ?? proyecto.usuario_id ?? proyecto.idUsuario ?? proyecto.usuarioId ?? '') : '';
  clearFormErrors();

  const titleModal = document.getElementById('modalEditarProyectoLabel');
  if (titleModal) {
    titleModal.textContent = proyecto ? 'Editar proyecto' : 'Crear proyecto';
  }

  const estadoSelect = form.querySelector('select[name="estado"]');
  if (estadoSelect) {
    estadoSelect.disabled = true;
  }

  await bindProjectMaterialButtons(form);

  const projectMaterialsList = form.querySelector('#listaMaterialesProyecto');
  if (projectMaterialsList) {
    projectMaterialsList.innerHTML = '';
    ensureProjectMaterialTable(projectMaterialsList);
  }

  if (proyecto?.id_proyecto || proyecto?.id) {
    const projectId = proyecto.id_proyecto ?? proyecto.id ?? '';
    try {
      const materialRows = await apiRequest(`proyectos/${projectId}/materiales`);
      const rows = Array.isArray(materialRows) ? materialRows : [];
      const body = projectMaterialsList?.querySelector('.tabla-materiales-proyecto__body');
      rows.forEach((row) => {
        const item = document.createElement('div');
        item.className = 'tabla-materiales-proyecto__row';
        item.dataset.projectMaterialItem = 'true';
        item.dataset.materialId = String(row.id_material ?? '');
        item.dataset.cantidad = String(row.cantidad_calculada ?? 0);
        item.dataset.precioUnitario = String(row.precio_unitario ?? 0);
        item.innerHTML = `
          <span class="material-proyecto-nombre">${escapeHtml(row.material_nombre || 'Material')}</span>
          <span class="material-proyecto-cantidad">${Number(row.cantidad_calculada || 0).toFixed(2)} un.</span>
          <span class="material-proyecto-subtotal">Q ${Number(row.costo_subtotal || 0).toFixed(2)}</span>
          <button type="button" class="btn btn-sm btn-outline-danger btn-quitar-material">Quitar</button>
        `;
        item.querySelector('.btn-quitar-material').onclick = () => item.remove();
        if (body) body.appendChild(item);
      });
    } catch (_error) {
      console.warn('No se pudieron cargar los materiales del proyecto para editar:', _error.message);
    }
  }

  await loadProjectClients(proyecto ? (proyecto.cliente_id ?? proyecto.id_cliente ?? '') : '');

  if (proyecto) {
    form.querySelector('input[name="nombre"]').value = proyecto.nombre || proyecto.nombre_proyecto || '';
    form.querySelector('select[name="cliente_id"]').value = proyecto.cliente_id ?? proyecto.id_cliente ?? '';
    form.querySelector('select[name="estado"]').value = proyecto.estado || 'Pendiente';
    form.querySelector('input[name="fecha_inicio"]').value = normalizeDateValue(proyecto.fecha_inicio || proyecto.fechaInicio || '');
    form.querySelector('input[name="largo"]').value = proyecto.largo ?? proyecto.area_largo ?? '';
    form.querySelector('input[name="altura"]').value = proyecto.altura ?? '';
    form.querySelector('select[name="tipo"]').value = proyecto.tipo || '';
    form.querySelector('select[name="id_mano_obra"]').value = proyecto.id_mano_obra ?? '';
    const presupuestoInput = form.querySelector('input[name="presupuesto"]');
    if (presupuestoInput) {
      presupuestoInput.value = proyecto.presupuesto ?? proyecto.costo_estimado ?? '';
    }
    setRichTextValue('modalProyecto-descripcion', proyecto.descripcion ?? '');
  } else {
    form.querySelector('select[name="estado"]').value = 'Pendiente';
  }

  const btnGuardar = document.getElementById('btnGuardarProyecto');
  btnGuardar.onclick = async () => {
    try {
      clearFormErrors();
      if (!form.checkValidity()) {
        displayValidationErrors(form);
        return;
      }

      syncRichTextEditors();
      const projectId = form.querySelector('input[name="id"]').value;
      const payload = normalizeProjectPayload(objectFromForm(form));
      const materialesSeleccionados = obtenerMaterialesProyecto(form);
      if (materialesSeleccionados.length) {
        payload.materiales = materialesSeleccionados;
      }

      if (!projectId) {
        payload.estado = 'Pendiente';
      }

      const isCreating = !projectId;
      const formUserId = form.dataset.projectUserId;
      const currentUser = await getCurrentUser();
      const resolvedUserId = payload.id_usuario ?? payload.usuario_id ?? formUserId ?? (currentUser ? (currentUser.id_usuario ?? currentUser.id ?? '') : '');

      if (resolvedUserId) {
        payload.id_usuario = resolvedUserId;
        delete payload.usuario_id;
      }

      if (!resolvedUserId && !isCreating) {
        throw new Error('No se pudo identificar el usuario responsable del proyecto.');
      }

      const requestUrl = isCreating ? endpoint : `${endpoint}/${projectId}`;
      const method = isCreating ? 'POST' : 'PUT';

      const response = await apiRequest(requestUrl, {
        method,
        body: payload
      });

      showToast(response?.message || (isCreating ? 'Proyecto creado correctamente.' : 'Proyecto actualizado correctamente.'), 'success');
      const bootstrapModal = bootstrap.Modal.getInstance(modal);
      if (bootstrapModal) bootstrapModal.hide();
      setTimeout(() => loadCrudLists(), 300);
    } catch (error) {
      handleFormError(error, form);
    }
  };

  const bootstrapModal = new bootstrap.Modal(modal);
  bootstrapModal.show();
}

async function setupProyectoModule() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (page !== 'proyectos.html') return;

  const form = document.querySelector('form[data-form]');
  if (form) {
    const inputCliente = form.querySelector('[name="cliente_id"]');
    if (inputCliente) {
      await loadProjectClients(inputCliente.value || '');
    }
  }
}

async function loadProjectClients(selectedValue = '') {
  const select = document.getElementById('proyecto-cliente') || document.getElementById('modalProyecto-cliente');
  if (!select) return;

  try {
    const response = await apiRequest('clientes');
    const items = Array.isArray(response) ? response : (response && Array.isArray(response.data) ? response.data : []);
    select.innerHTML = '<option value="">Seleccione un cliente</option>' + items.map((client) => {
      const id = client.id_cliente ?? client.idCliente ?? client.id ?? '';
      const name = client.nombre || client.razonSocial || 'Cliente sin nombre';
      return `<option value="${escapeAttribute(id)}">${escapeHtml(name)}</option>`;
    }).join('');

    if (selectedValue) {
      select.value = String(selectedValue);
    }
  } catch (error) {
    console.warn('No se pudieron cargar los clientes para proyectos:', error.message);
  }
}

async function setupUsuariosModule() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (page !== 'usuarios.html') return;

  const btnAgregar = document.getElementById('btnAgregarUsuario');
  if (btnAgregar) {
    btnAgregar.addEventListener('click', () => {
      openUsuarioModal();
    });
  }

  const form = document.getElementById('formEditarUsuario');
  if (!form) return;

  const passwordField = form.querySelector('input[name="contrasena"]');
  if (passwordField) {
    passwordField.required = false;
    passwordField.placeholder = 'Dejar vacío para mantener contraseña actual';
  }
}

function openUsuarioModal(usuario = null, id = '', endpoint = 'usuarios') {
  const modal = document.getElementById('modalEditarUsuario');
  const form = document.getElementById('formEditarUsuario');
  if (!modal || !form) return;

  form.reset();
  form.querySelector('input[name="id"]').value = id || '';
  clearFormErrors();

  const titleModal = document.getElementById('modalEditarUsuarioLabel');
  if (titleModal) {
    titleModal.textContent = usuario ? 'Editar usuario' : 'Agregar nuevo usuario';
  }

  if (usuario) {
    const nombreValor = usuario.nombre || usuario.name || '';
    form.querySelector('input[name="nombre"]').value = nombreValor;
    form.querySelector('input[name="correo"]').value = usuario.correo || usuario.email || '';
    form.querySelector('select[name="rol"]').value = usuario.rol || '';
    form.querySelector('select[name="estado"]').value = usuario.estado || 'Activo';
    form.querySelector('textarea[name="observacion"]').value = usuario.observacion || '';
    const passwordField = form.querySelector('input[name="contrasena"]');
    if (passwordField) {
      passwordField.value = '';
      passwordField.required = false;
      passwordField.placeholder = 'Dejar vacío para mantener contraseña actual';
    }
  } else {
    const passwordField = form.querySelector('input[name="contrasena"]');
    if (passwordField) {
      passwordField.required = true;
      passwordField.placeholder = 'Mínimo 8 caracteres';
    }
  }

  form.dataset.endpoint = endpoint;

  const btnGuardar = document.getElementById('btnGuardarUsuario');
  btnGuardar.onclick = async () => {
    try {
      clearFormErrors();
      if (!form.checkValidity()) {
        displayValidationErrors(form);
        return;
      }

      const userId = form.querySelector('input[name="id"]').value;
      const nombreInput = form.querySelector('input[name="nombre"]');
      const correoInput = form.querySelector('input[name="correo"]');
      const rolInput = form.querySelector('select[name="rol"]');
      const estadoInput = form.querySelector('select[name="estado"]');
      const passwordInput = form.querySelector('input[name="contrasena"]');

      const emailValue = correoInput ? correoInput.value.trim() : '';
      const passwordValue = passwordInput ? String(passwordInput.value || '').trim() : '';

      const payload = {
        nombre: nombreInput ? nombreInput.value.trim() : '',
        usuario: emailValue,
        email: emailValue,
        rol: rolInput ? rolInput.value : 'Operador',
        estado: estadoInput ? estadoInput.value : 'Activo'
      };

      if (userId) {
        payload.id = userId;
        payload.id_usuario = userId;
      }

      if (passwordValue) {
        payload.contrasena = passwordValue;
        payload.password_hash = passwordValue;
      }

      if (!payload.nombre) {
        throw new Error('El nombre del usuario es obligatorio.');
      }

      if (!payload.email) {
        throw new Error('El correo electrónico es obligatorio.');
      }

      if (!userId && !payload.contrasena) {
        throw new Error('La contraseña es obligatoria para crear un usuario.');
      }

      const isCreating = !userId;
      const requestUrl = isCreating ? endpoint : `${endpoint}/${userId}`;
      const method = isCreating ? 'POST' : 'PUT';

      const response = await apiRequest(requestUrl, {
        method,
        body: payload
      });

      const currentUser = await getCurrentUser();
      const currentUserId = currentUser && (currentUser.id_usuario ?? currentUser.id ?? '');
      if (!isCreating && currentUserId && String(currentUserId) === String(userId)) {
        const updatedUser = {
          ...currentUser,
          nombre: payload.nombre,
          email: payload.email,
          usuario: payload.email,
          rol: payload.rol,
          estado: payload.estado
        };
        usuarioActual = updatedUser;
        sessionStorage.setItem('usuarioActual', JSON.stringify(updatedUser));
        await loadCurrentUserDisplay();
      }

      showToast(response?.message || (isCreating ? 'Usuario registrado correctamente.' : 'Usuario actualizado correctamente.'), 'success');

      const bootstrapModal = bootstrap.Modal.getInstance(modal);
      if (bootstrapModal) bootstrapModal.hide();

      setTimeout(() => {
        loadCrudLists();
      }, 300);
    } catch (error) {
      handleFormError(error, form);
    }
  };

  const bootstrapModal = new bootstrap.Modal(modal);
  bootstrapModal.show();
}

async function setupInventoryModule() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (page !== 'inventario.html') return;

  /* Cargar y mapear usuarios para completar nombres en movimientos */
  await loadAndMapUsers();

  const btnNuevoMovimiento = document.getElementById('btnNuevoMovimiento');
  const btnGuardarMovimiento = document.getElementById('btnGuardarMovimiento');
  const form = document.getElementById('formMovimientoInventario');

  if (btnNuevoMovimiento) {
    btnNuevoMovimiento.addEventListener('click', () => {
      openInventoryMovementModal();
    });
  }

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveInventoryMovement();
    });
  }

  if (btnGuardarMovimiento) {
    btnGuardarMovimiento.addEventListener('click', () => {
      saveInventoryMovement();
    });
  }

  await loadInventoryMaterials();
  await loadInventoryUsers();
  await loadInventoryMovements();
}

async function openInventoryMovementModal() {
  const modal = document.getElementById('modalMovimientoInventario');
  const form = document.getElementById('formMovimientoInventario');
  if (!modal || !form || typeof bootstrap === 'undefined') return;

  form.reset();
  setRichTextValue('movimiento-observacion');
  clearFormErrors();
  setDefaultDate();
  await loadInventoryMaterials();
  await loadInventoryUsers();

  const bootstrapModal = new bootstrap.Modal(modal);
  bootstrapModal.show();
}

async function saveInventoryMovement() {
  const modal = document.getElementById('modalMovimientoInventario');
  const form = document.getElementById('formMovimientoInventario');
  if (!form) return;

  const typeSelect = form.querySelector('#movimiento-tipo');
  const costInput = form.querySelector('#movimiento-costo');
  if (typeSelect && costInput) {
    const updateCostRequirement = () => {
      costInput.required = typeSelect.value === 'Entrada';
    };
    typeSelect.addEventListener('change', updateCostRequirement);
    updateCostRequirement();
  }

  try {
    clearFormErrors();

    if (!form.checkValidity()) {
      displayValidationErrors(form);
      return;
    }

    syncRichTextEditors();
    const payload = objectFromForm(form);
    /* Remover el nombre del usuario, solo enviar el id */
    delete payload.usuario_nombre;
    
    const response = await apiRequest('inventario/movimientos', {
      method: 'POST',
      body: payload
    });

    showToast(response?.message || 'Movimiento guardado correctamente.', 'success');

    if (modal && typeof bootstrap !== 'undefined') {
      const bootstrapModal = bootstrap.Modal.getInstance(modal);
      if (bootstrapModal) bootstrapModal.hide();
    }

    form.reset();
    setRichTextValue('movimiento-observacion');
    setDefaultDate();
    await loadCrudLists();
    await loadInventoryMaterials();
    await loadInventoryUsers();
    await loadInventoryMovements();
  } catch (error) {
    handleFormError(error, form);
  }
}

async function loadInventoryMaterials() {
  const select = document.getElementById('movimiento-material');
  if (!select) return;

  try {
    const response = await apiRequest('materiales');
    const materials = (Array.isArray(response) ? response : (response && Array.isArray(response.data) ? response.data : []))
      .filter((material) => normalizeErrorText(material.categoria || material.tipo) !== 'mano de obra');
    select.innerHTML = '<option value="">Seleccione un material</option>' + materials.map((material) => {
      const id = material.id_material ?? material.id ?? '';
      const code = material.codigo ? `${material.codigo} - ` : '';
      const name = material.nombre || 'Material sin nombre';
      const unit = material.unidad || material.unidad_medida || '';
      const label = unit ? `${code}${name} (${unit})` : `${code}${name}`;
      return `<option value="${escapeAttribute(id)}">${label}</option>`;
    }).join('');
  } catch (error) {
    showToast(error.message || 'No se pudieron cargar los materiales.', 'error');
  }
}

async function getCurrentUser() {
  if (usuarioActual) return usuarioActual;
  
  /* Intentar recuperar del sessionStorage primero */
  try {
    const stored = sessionStorage.getItem('usuarioActual');
    if (stored) {
      usuarioActual = JSON.parse(stored);
      return usuarioActual;
    }
  } catch (error) {
    console.warn('Error recuperando usuario de sessionStorage:', error.message);
  }
  
  /* Fallback a llamada API si no está en sessionStorage */
  try {
    const response = await apiRequest('auth/me');
    if (response && (response.id_usuario || response.id)) {
      usuarioActual = response;
      sessionStorage.setItem('usuarioActual', JSON.stringify(response));
      return response;
    }
  } catch (error) {
    console.warn('No se pudo obtener el usuario actual:', error.message);
  }
  
  return null;
}

async function loadAndMapUsers() {
  try {
    const response = await apiRequest('usuarios');
    const users = Array.isArray(response) ? response : (response && Array.isArray(response.data) ? response.data : []);
    
    users.forEach((user) => {
      const id = user.id_usuario ?? user.id ?? '';
      let name = getDisplayUserName(user, 'Usuario sin nombre');
      
      /* Agregar rol si existe */
      if (user.rol) {
        name = `${name} (${user.rol})`;
      }
      
      if (id) {
        usuariosMapeo[id] = name;
      }
    });
  } catch (error) {
    console.warn('No se pudieron cargar los usuarios para mapeo:', error.message);
  }
}

async function loadInventoryUsers() {
  const inputUsuario = document.getElementById('movimiento-usuario');
  const inputUsuarioId = document.getElementById('movimiento-usuario-id');
  if (!inputUsuario) return;

  try {
    /* Obtener y auto-llenar el usuario actual */
    const currentUser = await getCurrentUser();
    if (currentUser) {
      const userId = currentUser.id_usuario ?? currentUser.id ?? '';
      let userName = getDisplayUserName(currentUser, 'Usuario sin nombre');
      
      /* Agregar rol si existe */
      if (currentUser.rol) {
        userName = `${userName} (${currentUser.rol})`;
      }
      
      if (inputUsuario) {
        inputUsuario.value = userName;
      }
      if (inputUsuarioId) {
        inputUsuarioId.value = userId;
      }
    } else {
      if (inputUsuario) {
        inputUsuario.value = 'Usuario no disponible';
      }
    }
  } catch (error) {
    console.warn('No se pudo cargar el usuario:', error.message);
    if (inputUsuario) {
      inputUsuario.value = 'Error al cargar usuario';
    }
  }
}

async function loadInventoryMovements() {
  const table = document.getElementById('tabla-movimientos');
  if (!table) return;

  try {
    const response = await apiRequest('inventario/movimientos');
    const movements = Array.isArray(response) ? response : (response && Array.isArray(response.data) ? response.data : []);
    renderInventoryMovementsTable(table, movements);
  } catch (error) {
    renderEmptyTable(table, 'No hay movimientos registrados.');
    console.warn('inventario/movimientos no disponible:', error.message);
  }
}

function renderInventoryMovementsTable(table, movements) {
  if (!movements.length) {
    renderEmptyTable(table, 'No hay movimientos registrados.');
    return;
  }

  table.querySelector('tbody').innerHTML = movements.map((movement) => {
    const record = JSON.stringify(movement);
    const idValue = movement.id_movimiento ?? movement.id ?? '';
    const type = movement.tipo || 'Movimiento';
    const badgeClass = normalizeErrorText(type).includes('salida') ? 'badge--danger' : 'badge--success';
    
    /* Usar el mapeo de usuarios si el backend no envía usuario_nombre */
    let usuarioNombre = movement.usuario_nombre;
    if (!usuarioNombre && movement.id_usuario) {
      usuarioNombre = usuariosMapeo[movement.id_usuario];
    }
    usuarioNombre = usuarioNombre || 'Sin usuario';

    return `
      <tr>
        <td>${formatDateValue(movement.fecha)}</td>
        <td>${escapeHtml(movement.material_nombre || 'Material sin nombre')}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(type)}</span></td>
        <td>${escapeHtml(usuarioNombre)}</td>
        <td>${formatInventoryNumber(movement.cantidad)}</td>
        <td>${escapeHtml(movement.referencia || '—')}</td>
        <td>
          <button class="boton boton-icono" type="button" data-view-movement="${idValue}" data-record='${escapeAttribute(record)}' title="Ver detalle"><img src="../assets/img/ico lupa.png" alt="Ver detalle"></button>
        </td>
      </tr>
    `;
  }).join('');

  bindMovementDetailButtons(table);
}

function bindMovementDetailButtons(table) {
  table.querySelectorAll('[data-view-movement]').forEach((boton) => {
    boton.onclick = async () => {
      const id = boton.dataset.viewMovement;
      const fallbackMovement = parseRecordData(boton.dataset.record);

      try {
        let movement = fallbackMovement;
        if (id) {
          try {
            movement = await apiRequest(`inventario/movimientos/${id}`);
          } catch (error) {
            movement = fallbackMovement;
          }
        }

        if (!movement) {
          throw new Error('No se pudo cargar el detalle del movimiento.');
        }

        showMovementDetail(movement);
      } catch (error) {
        showToast(error.message || 'No se pudo cargar el detalle del movimiento.', 'error');
      }
    };
  });
}

function showMovementDetail(movement) {
  const modal = document.getElementById('modalDetalleMovimiento');
  const content = document.getElementById('detalleMovimientoContent');
  if (!modal || !content || typeof bootstrap === 'undefined') return;

  const type = movement.tipo || 'Movimiento';
  const badgeClass = normalizeErrorText(type).includes('salida') ? 'badge--danger' : 'badge--success';
  content.innerHTML = `
    <div class="contenido-ficha-cliente">
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Movimiento:</label>
        <div class="valor-ficha-cliente">#${escapeHtml(movement.id_movimiento ?? movement.id ?? '—')}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Material:</label>
        <div class="valor-ficha-cliente">${escapeHtml(movement.material_nombre || 'Material sin nombre')}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Tipo:</label>
        <div class="valor-ficha-cliente"><span class="badge ${badgeClass}">${escapeHtml(type)}</span></div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Usuario:</label>
        <div class="valor-ficha-cliente">${escapeHtml((movement.usuario_nombre || usuariosMapeo[movement.id_usuario] || 'Sin usuario'))}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Fecha:</label>
        <div class="valor-ficha-cliente">${formatDateValue(movement.fecha)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Cantidad:</label>
        <div class="valor-ficha-cliente">${formatInventoryNumber(movement.cantidad)}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Referencia:</label>
        <div class="valor-ficha-cliente">${escapeHtml(movement.referencia || '—')}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Observación:</label>
        <div class="valor-ficha-cliente rich-text-content">${sanitizeRichText(movement.notas || movement.observacion || '—')}</div>
      </div>
      <div class="fila-ficha-cliente">
        <label class="etiqueta-ficha-cliente">Registrado:</label>
        <div class="valor-ficha-cliente">${formatDateValue(movement.fecha_registro)}</div>
      </div>
    </div>
  `;

  const bootstrapModal = new bootstrap.Modal(modal);
  bootstrapModal.show();
}

function renderInventorySummary(items) {
  const metricValues = document.querySelectorAll('.tarjeta-metrica strong');
  if (!metricValues.length) return;

  const normalStock = items.filter((item) => String(item.estado || '').toLowerCase().includes('normal')).length;
  const minimumStock = items.filter((item) => String(item.estado || '').toLowerCase().includes('mínimo') || String(item.estado || '').toLowerCase().includes('minimo')).length;

  const values = [items.length, normalStock, minimumStock];
  metricValues.forEach((element, index) => {
    if (index < values.length) element.textContent = values[index];
  });
}

function renderInventoryTable(table, items) {
  if (!items.length) {
    renderEmptyTable(table, 'No hay existencias registradas.');
    return;
  }

  table.querySelector('tbody').innerHTML = items.map((item) => {
    const materialName = item.material_nombre || item.nombre || 'Material sin nombre';
    const code = item.codigo ? `<small>${item.codigo}</small>` : '';
    const unit = item.unidad || item.unidad_medida || '—';
    const stock = Number(item.stock_actual ?? 0);
    const minimum = Number(item.stock_minimo ?? 0);
    const status = item.estado || (stock <= minimum ? 'Stock mínimo' : 'Existencia normal');
    const statusClass = normalizeErrorText(status).includes('minimo') ? 'badge--danger' : 'badge--success';

    return `
      <tr>
        <td><strong>${materialName}</strong>${code}</td>
        <td>${unit}</td>
        <td>${formatInventoryNumber(stock)}</td>
        <td>${formatInventoryNumber(minimum)}</td>
        <td><span class="badge ${statusClass}">${status}</span></td>
      </tr>
    `;
  }).join('');
}

function formatInventoryNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return new Intl.NumberFormat('es-GT', {
    minimumFractionDigits: number % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(number);
}

function formatDateValue(value) {
  if (!value) return '—';

  if (typeof value === 'string') {
    const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDate) {
      return `${isoDate[3]}-${isoDate[2]}-${isoDate[1]}`;
    }

    const europeanDate = value.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (europeanDate) {
      return `${europeanDate[1]}-${europeanDate[2]}-${europeanDate[3]}`;
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

