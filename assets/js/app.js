const API_CONFIG = {
  baseUrl: 'http://localhost:3000/api',
  tokenKey: 'recubrimientos_token'
};

window.API_CONFIG = API_CONFIG;

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
  const appShell = document.querySelector('.app-shell');
  const toggle = document.querySelector('[data-sidebar-toggle]');
  if (!sidebar || !toggle) return;

  // Toggle sidebar cuando se hace clic en el botón hamburguesa
  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('is-open');
    if (appShell) {
      appShell.classList.toggle('sidebar-active');
    }
  });

  // Cerrar sidebar cuando se hace clic en un enlace del menú
  document.querySelectorAll('.menu__link').forEach((link) => {
    link.addEventListener('click', () => {
      sidebar.classList.remove('is-open');
      if (appShell) {
        appShell.classList.remove('sidebar-active');
      }
    });
  });

  // Cerrar sidebar cuando se hace clic en el overlay
  if (appShell) {
    appShell.addEventListener('click', (e) => {
      if (e.target === appShell && sidebar.classList.contains('is-open') && window.innerWidth <= 820) {
        sidebar.classList.remove('is-open');
        appShell.classList.remove('sidebar-active');
      }
    });
  }

  // Cerrar sidebar al redimensionar la ventana a desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 820) {
      sidebar.classList.remove('is-open');
      if (appShell) {
        appShell.classList.remove('sidebar-active');
      }
    }
  });
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
          showToast(error.message || 'No se pudo conectar con la API.', 'error');
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
    output.innerHTML = `<div class="panel__header"><div><h2>Resultado estimado</h2><p>Revise el cálculo antes de guardarlo en el proyecto.</p></div></div><div class="calculation-summary"><div class="calculation-summary__main"><p>Material requerido</p><strong>${gallons.toFixed(2)} galones</strong></div><div class="calculation-list"><div><span>Área total</span><strong>${area.toFixed(2)} m²</strong></div><div><span>Material</span><strong>${material}</strong></div><div><span>Rendimiento</span><strong>${coverage.toFixed(2)} m²/galón</strong></div><div><span>Costo estimado</span><strong>Q ${(gallons * price).toFixed(2)}</strong></div></div><button type="button" class="button button--secondary" data-save-calculation>Guardar cálculo estimado</button></div>`;
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
    preview.innerHTML = `<div class="panel__header"><div><h2>Vista previa</h2><p>Resultado solicitado: ${type}.</p></div></div><div class="report-content"><h3>${type}</h3><p>Filtros aplicados: ${data.get('desde') || 'sin fecha inicial'} a ${data.get('hasta') || 'sin fecha final'}.</p><div class="empty-state"><span>▥</span><h3>Sin información para mostrar</h3><p>La vista previa utilizará los datos de la API cuando el backend responda con información real.</p><button class="button button--secondary" type="button" data-export-report>Preparar exportación ${format}</button></div></div>`;
    preview.querySelector('[data-export-report]').addEventListener('click', () => showToast(`La exportación a ${format} se realizará cuando el backend esté disponible.`, 'success'));
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

function resolveApiEndpoint(form) {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const endpoint = form.dataset.apiEndpoint || form.dataset.endpoint;
  if (endpoint) return endpoint;

  const pageMap = {
    'login.html': 'auth/login',
    'clientes.html': 'clientes',
    'proyectos.html': 'proyectos',
    'materiales.html': 'materiales',
    'inventario.html': 'inventario',
    'usuarios.html': 'usuarios'
  };

  return pageMap[page] || null;
}

function clearFormErrors() {
  const errors = document.querySelectorAll('.form-error');
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
  const errorElement = document.getElementById(`error-${normalizedField}`) || document.getElementById(`error-${normalizedField.toLowerCase()}`);

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

    const toastMessage = mappedErrors.message || errorObject.message || fallbackMessage;
    if (toastMessage) {
      showToast(toastMessage, 'error');
    }
    return;
  }

  const responseMessage = typeof errorObject.message === 'string' ? errorObject.message : (
    typeof errorObject.error === 'string' ? errorObject.error : fallbackMessage
  );

  const normalizedMessage = String(responseMessage || fallbackMessage || 'Error desconocido');
  const lowerMessage = normalizeErrorText(normalizedMessage);

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

  const token = localStorage.getItem(API_CONFIG.tokenKey);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const requestOptions = {
    method: 'GET',
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
    const metricCards = document.querySelectorAll('.metric-card strong');
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

    const smallTexts = document.querySelectorAll('.metric-card small');
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
      emptyMessage: 'No hay movimientos registrados.'
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
              <button class="button button--icon" type="button" data-view-ficha="${idValue}" data-record='${escapeAttribute(record)}' title="Ver ficha completa"><img src="../assets/img/ico lupa.png" alt="Ver ficha"></button>
              <button class="button button--icon" type="button" data-edit-id="${idValue}" data-edit-endpoint="${config.endpoint}" data-record='${escapeAttribute(record)}' title="Editar"><img src="../assets/img/ico editar.png" alt="Editar"></button>
              <button class="button button--icon button--danger" type="button" data-delete-id="${idValue}" data-delete-endpoint="${config.endpoint}" title="Eliminar"><img src="../assets/img/ico eliminar.png" alt="Eliminar"></button>
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
              <button class="button button--ghost" type="button" data-edit-id="${idValue ?? ''}" data-edit-endpoint="${config.endpoint}" data-record='${escapeAttribute(record)}'>Editar</button>
              <button class="button button--ghost button--danger" type="button" data-delete-id="${idValue ?? ''}" data-delete-endpoint="${config.endpoint}">Eliminar</button>
            </td>
          </tr>
        `;
      }).join('');
      bindEditButtons(table);
      bindDeleteButtons(table);
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
        return `
          <tr>
            <td>${nombre}</td>
            <td>${categoria}</td>
            <td>${unidad}</td>
            <td>${rendimiento !== '—' ? `${Number(rendimiento).toFixed(2)} m²` : '—'}</td>
            <td>${costo}</td>
            <td>${stockMinimo}</td>
            <td>
              <button class="button button--icon" type="button" data-edit-id="${idValue ?? ''}" data-edit-endpoint="${config.endpoint}" data-record='${escapeAttribute(record)}' title="Editar"><img src="../assets/img/ico editar.png" alt="Editar"></button>
              <button class="button button--icon button--danger" type="button" data-delete-id="${idValue ?? ''}" data-delete-endpoint="${config.endpoint}" title="Eliminar"><img src="../assets/img/ico eliminar.png" alt="Eliminar"></button>
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
            <button class="button button--ghost" type="button" data-edit-id="${idValue ?? ''}" data-edit-endpoint="${config.endpoint}" data-record='${escapeAttribute(record)}'>Editar</button>
            <button class="button button--ghost button--danger" type="button" data-delete-id="${idValue ?? ''}" data-delete-endpoint="${config.endpoint}">Eliminar</button>
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
  table.querySelectorAll('[data-edit-id]').forEach((button) => {
    button.onclick = async () => {
      const id = button.dataset.editId;
      const endpoint = button.dataset.editEndpoint;
      const fallbackItem = parseRecordData(button.dataset.record);

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
  table.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.onclick = async () => {
      const id = button.dataset.deleteId;
      const endpoint = button.dataset.deleteEndpoint;
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
  table.querySelectorAll('[data-view-ficha]').forEach((button) => {
    button.onclick = () => {
      const record = parseRecordData(button.dataset.record);
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
    <div class="fichaCliente-content">
      <div class="fichaCliente-row">
        <label class="fichaCliente-label">Nombre o razón social:</label>
        <div class="fichaCliente-value">${cliente.nombre || cliente.razonSocial || '—'}</div>
      </div>
      <div class="fichaCliente-row">
        <label class="fichaCliente-label">DPI/NIT:</label>
        <div class="fichaCliente-value">${cliente.identificacion || '—'}</div>
      </div>
      <div class="fichaCliente-row">
        <label class="fichaCliente-label">Teléfono:</label>
        <div class="fichaCliente-value">${cliente.telefono || '—'}</div>
      </div>
      <div class="fichaCliente-row">
        <label class="fichaCliente-label">Correo electrónico:</label>
        <div class="fichaCliente-value">${cliente.correo || '—'}</div>
      </div>
      <div class="fichaCliente-row">
        <label class="fichaCliente-label">Dirección:</label>
        <div class="fichaCliente-value">${cliente.direccion || '—'}</div>
      </div>
      <div class="fichaCliente-row">
        <label class="fichaCliente-label">Observaciones:</label>
        <div class="fichaCliente-value">${cliente.notas || '—'}</div>
      </div>
      <div class="fichaCliente-row">
        <label class="fichaCliente-label">Estado:</label>
        <div class="fichaCliente-value">${cliente.estado || 'Activo'}</div>
      </div>
    </div>
  `;

  content.innerHTML = fieldsHTML;
  const bootstrapModal = new bootstrap.Modal(modal);
  bootstrapModal.show();
}

function setupMaterialModal() {
  const btnAgregar = document.getElementById('btnAgregarMaterial');
  if (!btnAgregar) return;

  btnAgregar.addEventListener('click', () => {
    openMaterialModal();
  });
}

function openMaterialEditModal(material, id, endpoint) {
  openMaterialModal(material, id, endpoint);
}

function openMaterialModal(material = null, id = '', endpoint = 'materiales') {
  const modal = document.getElementById('modalEditarMaterial');
  const form = document.getElementById('formEditarMaterial');
  if (!modal || !form) return;

  form.reset();
  form.querySelector('input[name="id"]').value = id || '';
  clearFormErrors();

  const titleModal = document.getElementById('modalEditarMaterialLabel');
  if (titleModal) titleModal.textContent = material ? 'Editar material' : 'Agregar nuevo material';

  if (material) {
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
  return item.id_material ?? item.idMaterial ?? item.id_cliente ?? item.idCliente ?? item.id ?? '';
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
  tbody.innerHTML = `<tr class="empty-table"><td colspan="5">${message}</td></tr>`;
}
