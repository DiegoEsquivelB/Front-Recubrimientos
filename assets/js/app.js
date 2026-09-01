const API_CONFIG = {
  baseUrl: `${window.location.protocol}//${window.location.hostname}:3000/api`,
  legacyTokenKey: 'recubrimientos_token'
};

const browserWindow = typeof window !== 'undefined' ? window : globalThis;
if (browserWindow) {
  browserWindow.API_CONFIG = API_CONFIG;
}

/* Mapeo global de usuarios para rellenar nombres faltantes en movimientos */
const usuariosMapeo = {};

/* Cache del usuario actual para incluir en operaciones que lo requieren */
let usuarioActual = null;

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
    setSidebarControls();
    setPasswordToggle();
    setStandardForms();
    setTableSearches();
    setCalculator();
    setReportForm();
    setDefaultDate();
    loadDashboardData();
    loadCrudLists();
    setupClienteModal();
    setupMaterialModal();
    setupInventoryModule();
    loadCurrentUserDisplay();
    setupUsuariosModule();
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

  // Cerrar barra-lateral cuando se hace clic fuera del menú en móvil
  document.addEventListener('click', (event) => {
    if (window.innerWidth > 820 || !barraLateral.classList.contains('abierto')) return;
    if (event.target.closest('[data-barra-lateral]') || event.target.closest('[data-barra-lateral-toggle]')) return;
    closeSidebar();
  });

  // Cerrar barra-lateral cuando se hace clic en el overlay
  if (appShell) {
    appShell.addEventListener('click', (e) => {
      if (e.target === appShell && barraLateral.classList.contains('abierto') && window.innerWidth <= 820) {
        closeSidebar();
      }
    });
  }

  // Cerrar barra-lateral al redimensionar la ventana a desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 820) {
      closeSidebar();
    }
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

function setStandardForms() {
  document.querySelectorAll('form[data-form]').forEach((form) => {
    const submitButton = form.querySelector('boton[type="submit"]');
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
    });
  });
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
    const price = Number(data.get('costo'));
    const area = length * height;
    const gallons = area / coverage;
    const material = data.get('material');
    output.innerHTML = `<div class="encabezado-panel"><div><h2>Resultado estimado</h2><p>Revise el cálculo antes de guardarlo en el proyecto.</p></div></div><div class="resumen-calculo"><div class="resumen-calculo__main"><p>Material requerido</p><strong>${gallons.toFixed(2)} galones</strong></div><div class="lista-calculo"><div><span>Área total</span><strong>${area.toFixed(2)} m²</strong></div><div><span>Material</span><strong>${material}</strong></div><div><span>Rendimiento</span><strong>${coverage.toFixed(2)} m²/galón</strong></div><div><span>Costo estimado</span><strong>Q ${(gallons * price).toFixed(2)}</strong></div></div><button type="button" class="boton boton-secundario" data-save-calculation>Guardar cálculo estimado</button></div>`;
    output.querySelector('[data-save-calculation]').addEventListener('click', () => showToast('Cálculo preparado y listo para guardar mediante la API.', 'success'));
  });
}

function setReportForm() {
  const form = document.querySelector('[data-report-form]');
  const preview = document.querySelector('[data-report-preview]');
  if (!form || !preview) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearFormErrors();
    if (!form.checkValidity()) { displayValidationErrors(form); return; }
    const data = new FormData(form);
    const type = data.get('tipo');
    const format = data.get('formato');
    preview.innerHTML = `<div class="encabezado-panel"><div><h2>Vista previa</h2><p>Resultado solicitado: ${type}.</p></div></div><div class="contenido-reporte"><h3>${type}</h3><p>Filtros aplicados: ${data.get('desde') || 'sin fecha inicial'} a ${data.get('hasta') || 'sin fecha final'}.</p><div class="empty-state"><span>▥</span><h3>Sin información para mostrar</h3><p>La vista previa utilizará los datos de la API cuando el backend responda con información real.</p><button class="boton boton-secundario" type="button" data-export-report>Preparar exportación ${format}</button></div></div>`;
    preview.querySelector('[data-export-report]').addEventListener('click', () => showToast(`La exportación a ${format} se realizará cuando el backend esté disponible.`, 'success'));
  });
}

function setDefaultDate() {
  const field = document.getElementById('movimiento-fecha');
  if (!field || field.value) return;
  field.value = new Date().toISOString().slice(0, 10);
}

function showToast(message, type = '') {
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
}

function displayValidationErrors(form) {
  const fields = form.querySelectorAll('[required], [type="email"], [type="tel"], [type="number"], [type="date"]');
  
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
  /* Limpiar datos del usuario autenticado */
  sessionStorage.removeItem('usuarioActual');
  usuarioActual = null;
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

function objectFromForm(form) {
  const formData = new FormData(form);
  const payload = {};

  formData.forEach((value, key) => {
    payload[key] = value;
  });

  return payload;
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
    const response = await apiRequest(config.endpoint);
    const items = Array.isArray(response) ? response : (response && Array.isArray(response.data) ? response.data : []);

    if (!items.length) {
      renderEmptyTable(table, config.emptyMessage);
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
            <td>${item.estado || 'Activo'}</td>
            <td>
              <button class="boton boton-icono" type="button" data-view-ficha="${idValue}" data-record='${escapeAttribute(record)}' title="Ver ficha completa"><img src="../assets/img/ico lupa.png" alt="Ver ficha"></button>
              <button class="boton boton-icono" type="button" data-edit-id="${idValue}" data-edit-endpoint="${config.endpoint}" data-record='${escapeAttribute(record)}' title="Editar"><img src="../assets/img/ico editar.png" alt="Editar"></button>
              <button class="boton boton-icono boton-peligro" type="button" data-delete-id="${idValue}" data-delete-endpoint="${config.endpoint}" title="Eliminar"><img src="../assets/img/ico eliminar.png" alt="Eliminar"></button>
            </td>
          </tr>
        `;
      }).join('');
      bindViewFichaButtons(table);
      bindEditButtons(table);
      bindDeleteButtons(table);
      return;
    }

    if (page === 'proyectos.html') {
      table.querySelector('tbody').innerHTML = items.map((item) => {
        const record = JSON.stringify(item);
        const idValue = findRecordId(item);
        return `
          <tr>
            <td>${item.nombre || 'Sin nombre'}</td>
            <td>${item.cliente || 'Sin cliente'}</td>
            <td>${item.fecha_inicio || item.fechaInicio || '—'}</td>
            <td>${item.estado || 'Pendiente'}</td>
            <td>
              <button class="boton boton-transparente" type="button" data-edit-id="${idValue ?? ''}" data-edit-endpoint="${config.endpoint}" data-record='${escapeAttribute(record)}'>Editar</button>
              <button class="boton boton-transparente boton-peligro" type="button" data-delete-id="${idValue ?? ''}" data-delete-endpoint="${config.endpoint}">Eliminar</button>
            </td>
          </tr>
        `;
      }).join('');
      bindEditButtons(table);
      bindDeleteButtons(table);
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
        return `
          <tr>
            <td>${codigo}</td>
            <td>${nombre}</td>
            <td>${categoria}</td>
            <td>${unidad}</td>
            <td>${rendimiento !== '—' ? `${Number(rendimiento).toFixed(2)} m²` : '—'}</td>
            <td>${costo}</td>
            <td>${stockMinimo}</td>
            <td>
              <button class="boton boton-icono" type="button" data-edit-id="${idValue ?? ''}" data-edit-endpoint="${config.endpoint}" data-record='${escapeAttribute(record)}' title="Editar"><img src="../assets/img/ico editar.png" alt="Editar"></button>
              <button class="boton boton-icono boton-peligro" type="button" data-delete-id="${idValue ?? ''}" data-delete-endpoint="${config.endpoint}" title="Eliminar"><img src="../assets/img/ico eliminar.png" alt="Eliminar"></button>
            </td>
          </tr>
        `;
      }).join('');
      bindEditButtons(table);
      bindDeleteButtons(table);
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
              <button class="boton boton-icono boton-peligro" type="button" data-delete-id="${idValue ?? ''}" data-delete-endpoint="${config.endpoint}" title="Eliminar"><img src="../assets/img/ico eliminar.png" alt="Eliminar"></button>
            </td>
          </tr>
        `;
      }).join('');
      bindEditButtons(table);
      bindDeleteButtons(table);
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

        // Fallback para otros módulos
        const form = document.querySelector('form[data-form]');
        if (!form) return;

        const recordId = findRecordId(item) ?? id ?? '';
        const hiddenIdInput = ensureFormIdField(form);
        hiddenIdInput.value = recordId;
        form.dataset.editId = recordId;
        const submitButton = form.querySelector('boton[type="submit"]');
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

      const confirmed = window.confirm('¿Deseas eliminar este registro?');
      if (!confirmed) return;

      try {
        const response = await apiRequest(`${endpoint}/${id}`, {
          method: 'DELETE'
        });
        showToast(response?.message || 'Registro eliminado correctamente.', 'success');
        await loadCrudLists();
      } catch (error) {
        showToast(error.message || 'No se pudo eliminar el registro.', 'error');
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

  if (btnAgregar) btnAgregar.addEventListener('click', () => {
    openMaterialModal();
  });

  if (btnCategorias) btnCategorias.addEventListener('click', () => {
    openMaterialCategoriesModal();
  });

  loadMaterialCategories();
}

function openMaterialEditModal(material, id, endpoint) {
  openMaterialModal(material, id, endpoint);
}

async function openMaterialModal(material = null, id = '', endpoint = 'materiales') {
  const modal = document.getElementById('modalEditarMaterial');
  const form = document.getElementById('formEditarMaterial');
  if (!modal || !form) return;

  form.reset();
  form.querySelector('input[name="id"]').value = id || '';
  clearFormErrors();

  const titleModal = document.getElementById('modalEditarMaterialLabel');
  if (titleModal) titleModal.textContent = material ? 'Editar material' : 'Agregar nuevo material';

  setupMaterialInitialInventory(form, !material);
  await loadMaterialCategories(material ? material.categoria : '');

  if (material) {
    form.querySelector('#modalMaterial-codigo').value = material.codigo || '';
    form.querySelector('#modalMaterial-nombre').value = material.nombre || '';
    form.querySelector('#modalMaterial-categoria').value = material.categoria || '';
    form.querySelector('#modalMaterial-unidad').value = material.unidad || '';
    form.querySelector('#modalMaterial-rendimiento').value = material.rendimiento ?? '';
    form.querySelector('#modalMaterial-costo').value = material.costo ?? '';
    form.querySelector('#modalMaterial-minimo').value = material.stock_minimo ?? material.stockMinimo ?? '';
    form.querySelector('#modalMaterial-marca').value = material.marca || '';
    form.querySelector('#modalMaterial-descripcion').value = material.descripcion || '';
  }

  form.dataset.endpoint = endpoint;

  const btnGuardar = document.getElementById('btnGuardarMaterial');
  btnGuardar.onclick = async () => {
    try {
      clearFormErrors();

      if (!form.checkValidity()) {
        displayValidationErrors(form);
        return;
      }

      const materialId = form.querySelector('input[name="id"]').value;
      const payload = {};
      const formData = new FormData(form);
      for (const [key, value] of formData.entries()) {
        if (key !== 'id') payload[key] = value;
      }

      const isCreating = !materialId;
      const registrarInventario = payload.registrar_inventario === '1' || payload.registrar_inventario === true;
      
      if (!isCreating) {
        delete payload.registrar_inventario;
        delete payload.stock_inicial;
        delete payload.referencia_inventario;
      } else if (registrarInventario) {
        /* Incluir el ID del usuario actual cuando se crea un material con stock inicial */
        const currentUser = await getCurrentUser();
        if (currentUser) {
          payload.id_usuario = currentUser.id_usuario ?? currentUser.id ?? '';
        }
      }

      const requestUrl = isCreating ? endpoint : `${endpoint}/${materialId}`;
      const method = isCreating ? 'POST' : 'PUT';

      const response = await apiRequest(requestUrl, {
        method,
        body: payload
      });

      showToast(response?.message || (isCreating ? 'Material registrado correctamente.' : 'Material actualizado correctamente.'), 'success');

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
    const options = categories.map((category) => `<option value="${escapeAttribute(category.nombre)}">${category.nombre}</option>`).join('');

    if (select) {
      const currentValue = selectedValue || select.value;
      select.innerHTML = `<option value="">Seleccione una categoría</option>${options}`;
      if (currentValue) select.value = currentValue;
    }

    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">Nueva categoría</option>' + categories
        .map((category) => `<option value="${category.id}" data-nombre="${escapeAttribute(category.nombre)}">${category.nombre}</option>`)
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
  const checkbox = form.querySelector('#modalMaterial-registrarInventario');
  const quantity = form.querySelector('#modalMaterial-stockInicial');
  const reference = form.querySelector('#modalMaterial-referenciaInventario');
  if (!container || !fields || !checkbox || !quantity) return;

  container.hidden = !canRegisterInventory;
  checkbox.checked = false;
  quantity.value = '';
  quantity.required = false;
  fields.hidden = true;
  if (reference) reference.value = '';

  checkbox.onchange = () => {
    const enabled = checkbox.checked;
    fields.hidden = !enabled;
    quantity.required = enabled;
    if (!enabled) {
      quantity.value = '';
      if (reference) reference.value = '';
    }
  };
}

async function openMaterialCategoriesModal() {
  const modal = document.getElementById('modalCategoriasMaterial');
  const form = document.getElementById('formCategoriasMaterial');
  const select = document.getElementById('categoriaMaterial-lista');
  const input = document.getElementById('categoriaMaterial-nombre');
  const btnGuardar = document.getElementById('btnGuardarCategoria');
  const btnEliminar = document.getElementById('btnEliminarCategoria');
  if (!modal || !form || !select || !input || !btnGuardar || !btnEliminar) return;

  clearFormErrors();
  form.reset();
  await loadMaterialCategories();

  select.onchange = () => {
    const selectedOption = select.selectedOptions[0];
    input.value = selectedOption && selectedOption.dataset.nombre ? selectedOption.dataset.nombre : '';
    btnEliminar.disabled = !select.value;
  };
  btnEliminar.disabled = true;

  btnGuardar.onclick = async () => {
    try {
      clearFormErrors();
      const nombre = input.value.trim();
      if (!nombre) {
        applyFieldError(form, 'categoria_nombre', 'El nombre de la categoría es obligatorio.');
        return;
      }

      const id = select.value;
      const response = await apiRequest(id ? `materiales/categorias/${id}` : 'materiales/categorias', {
        method: id ? 'PUT' : 'POST',
        body: { nombre }
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
    const confirmed = window.confirm('¿Deseas eliminar esta categoría?');
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
  return item.id_usuario ?? item.idUsuario ?? item.id_material ?? item.idMaterial ?? item.id_cliente ?? item.idCliente ?? item.id ?? '';
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

  try {
    clearFormErrors();

    if (!form.checkValidity()) {
      displayValidationErrors(form);
      return;
    }

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
    const materials = Array.isArray(response) ? response : (response && Array.isArray(response.data) ? response.data : []);
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
        <div class="valor-ficha-cliente">${escapeHtml(movement.notas || movement.observacion || '—')}</div>
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
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-GT').format(date);
}

