# Sistema de Recubrimientos Arquitectónicos

Frontend del sistema de administración y gestión para recubrimientos arquitectónicos.

## Estructura

```
proyecto/
├── index.html                 # Panel principal
├── login.html                 # Inicio de sesión
├── modulos/                   # Vistas y formularios de cada módulo
│   ├── clientes.html
│   ├── proyectos.html
│   ├── calculo-materiales.html
│   ├── inventario.html
│   ├── materiales.html
│   ├── reportes.html
│   └── usuarios.html
└── assets/
    ├── css/estilos.css        # Estilos CSS3 compartidos
    └── js/app.js              # Interacciones, validaciones y conexión con la API
```

## Conexión con la API

El frontend ya está preparado para consumir el backend desde la URL base configurada en `assets/js/app.js`.

```js
const API_CONFIG = {
  baseUrl: 'http://localhost:3000/api',
  tokenKey: 'recubrimientos_token'
};
```

Ajusta esa URL si tu backend corre en otro puerto o dominio. Los módulos intentan consumir las rutas:

- `POST /api/auth/login`
- `GET /api/clientes`
- `POST /api/clientes`
- `GET /api/proyectos`
- `POST /api/proyectos`
- `GET /api/materiales`
- `POST /api/materiales`
- `GET /api/inventario`
- `POST /api/inventario`
- `GET /api/usuarios`
- `POST /api/usuarios`

## Rutas

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/usuarios`
- `GET|POST /api/clientes`
- `GET|PUT|DELETE /api/clientes/:id`
- `GET|POST /api/materiales`
- `GET|PUT|DELETE /api/materiales/:id`
- `GET|POST /api/proyectos`
- `GET|PUT|DELETE /api/proyectos/:id`
- `GET|POST /api/inventario/movimientos`
- `GET|PUT|DELETE /api/inventario/movimientos/:id`

## Uso

Abre `login.html` en tu navegador. El sistema intenta conectarse a la API en cuanto se cargan los formularios y las pantallas de listado. Si el backend no está ejecutándose, la aplicación mantiene el comportamiento visual del prototipo y muestra un aviso en pantalla.

## Usuario Predeterminado
Usuario: admin@recubrimientos.com
Contraseña: admin123