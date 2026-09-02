# Front Proyecto G2

Frontend web del sistema de gestión de recubrimientos arquitectónicos.

## Funcionalidades

- Login y cierre de sesión
- Gestión de clientes
- Gestión de usuarios
- Gestión de materiales y categorías
- Inventario con movimientos
- Registro, edición y listado de proyectos
- Cálculo de materiales por proyecto
- Reportes y dashboard

## Estructura

```text
Front-ProyectoG2/
├── index.html
├── login.html
├── modulos/
│   ├── clientes.html
│   ├── proyectos.html
│   ├── materiales.html
│   ├── inventario.html
│   ├── calculo-materiales.html
│   ├── reportes.html
│   └── usuarios.html
├── assets/
│   ├── css/
│   ├── img/
│   └── js/
│       └── app.js
└── README.md
```

## Cómo usarlo

1. Inicia la API en `API-ProyectoG2`.
2. Abre `login.html` en el navegador.
3. Ingresa con:
   - Usuario: `admin@recubrimientos.com`
   - Contraseña: `admin123`

## Conexión con la API

El frontend usa esta base por defecto en `assets/js/app.js`:

```js
const API_CONFIG = {
  baseUrl: `${window.location.protocol}//${window.location.hostname}:3000/api`
};
```

Esto significa que, si el backend corre en `localhost:3000`, la UI se conecta automáticamente sin más configuración.

Si la API se ejecuta en otra máquina o puerto, debes ajustar `API_CONFIG.baseUrl`.

## Rutas que consume el frontend

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/clientes`
- `POST /api/clientes`
- `GET /api/materiales`
- `POST /api/materiales`
- `GET /api/proyectos`
- `POST /api/proyectos`
- `GET /api/inventario`
- `GET /api/usuarios`
- `POST /api/usuarios`

## Nota importante

El frontend muestra los proyectos y otros listados solamente si la API está levantada y responde correctamente.

Si la API falla, se imprime un error y la pantalla no puede cargar la información del módulo.