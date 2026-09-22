# Front Proyecto G2

Frontend web del sistema de gestión de recubrimientos arquitectónicos.

## Funcionalidades

- Login y cierre de sesión
- Gestión de clientes
- Gestión de usuarios
- Gestión de materiales y categorías con imágenes, materiales activos y archivados
- Inventario con movimientos, costos por entrada y consumo automático PEPS
- Registro, edición y listado de proyectos
- Cálculo de materiales por proyecto
- Reportes y dashboard

## Roles y permisos

- `Administrador`: puede acceder a todos los módulos, incluido Usuarios.
- `Operador`: puede acceder al panel, Clientes, Proyectos, Cálculo de materiales, Inventario, Materiales y Reportes. El menú Usuarios se oculta y el acceso directo se redirige al panel.

## Librerías del frontend

El frontend utiliza HTML, CSS y JavaScript sin un framework adicional:

- `Bootstrap 5.3.3` (CDN): modal de generación de reportes y componentes de interfaz.
- `Quill 2.0.3` (CDN): editor enriquecido para descripciones y observaciones.
- `ExcelJS 4.4.0` (CDN): creación de archivos `.xlsx` con tablas estructuradas, estilos y filtros.
- `jsPDF 2.5.1` (CDN): generación de archivos PDF desde el navegador.
- `jsPDF-AutoTable 3.8.2` (CDN): renderizado de los datos del reporte como tabla dentro del PDF.

Las librerías se cargan desde `jsdelivr.net` en los módulos que las utilizan. Se requiere conexión a internet para cargar Bootstrap, Quill, ExcelJS y jsPDF.

## Estructura

```text
Front-ProyectoG2/
├── public/
│   ├── index.html
│   ├── login.html
│   ├── modulos/
│   │   ├── clientes.html
│   │   ├── proyectos.html
│   │   ├── materiales.html
│   │   ├── inventario.html
│   │   ├── calculo-materiales.html
│   │   ├── reportes.html
│   │   └── usuarios.html
│   └── assets/
│       ├── css/
│       ├── img/
│       └── js/
│           └── app.js
├── server.js
├── package.json
├── package-lock.json
├── README.md
└── .gitignore
```

## Cómo usarlo

1. Instala dependencias: `npm install`
2. Configura la URL del backend:
   - PowerShell:
     ```powershell
     $env:API_BASE_URL="https://api-recubrimientos-production.up.railway.app"
     ```
   - Linux/macOS:
     ```bash
     export API_BASE_URL="https://api-recubrimientos-production.up.railway.app"
     ```
3. Levanta el frontend:
   ```bash
   npm start
   ```
4. Abre la aplicación en el navegador en:
   ```text
   http://localhost:3000/login.html
   ```
5. Ingresa con las credenciales configuradas en la API.

## Materiales e inventario

En el módulo Materiales se puede cargar una imagen JPG, PNG o WebP de hasta 2 MB al crear o editar un material. El formulario muestra una vista previa antes de guardar y conserva la imagen anterior cuando se edita sin seleccionar un nuevo archivo.

El catálogo separa los materiales en las pestañas `Activos` y `Archivados`. Desde Activos se puede archivar un material para retirarlo del catálogo sin perder su historial. Desde Archivados se puede desarchivar o eliminar definitivamente; la eliminación borra movimientos, lotes, inventario y relaciones asociadas.

En Inventario, las entradas permiten indicar un `costo_unitario`. Un mismo material puede recibir varias entradas con costos diferentes. El sistema aplica PEPS automáticamente en las salidas y en el consumo de materiales de proyectos, por lo que siempre descuenta primero los lotes más antiguos disponibles.

En el detalle de proyectos aparece el botón `Detalle lote` cuando existe información PEPS. Ese modal muestra los lotes utilizados, la cantidad tomada y el costo unitario aplicado.

El catálogo de materiales incluye el botón `Ver detalle`, que abre una vista de solo lectura con la imagen, código, categoría, unidad, rendimiento, costo, stock mínimo y descripción del material. La vista se organiza en dos columnas en PC y en una columna en dispositivos móviles.

Los campos de descripción de proyectos, observación de movimientos y descripción de materiales utilizan un editor enriquecido con formato básico, listas, enlaces y limpieza de formato. Las tablas de inventario y movimientos se convierten en tarjetas etiquetadas en pantallas pequeñas para mantener sus datos legibles.

## Conexión con la API

La aplicación no tiene la URL del backend hardcodeada en el navegador. El frontend usa la ruta relativa `/api` y el servidor Node hace el proxy hacia la URL definida en la variable de entorno `API_BASE_URL`.

Configuración real del servidor:

```js
const API_BASE_URL = String(process.env.API_BASE_URL || '').replace(/\/$/, '');

if (req.url === '/api' || req.url.startsWith('/api/')) {
  proxy.web(req, res, { target: API_BASE_URL });
}
```

Esto significa que el valor del backend se configura por entorno, no en el código del frontend. Ejemplo:

```powershell
$env:API_BASE_URL="https://api-recubrimientos-production.up.railway.app"
```

La app queda disponible en `http://localhost:3000` y redirige automáticamente las peticiones `/api/*` hacia la API configurada en `API_BASE_URL`.

## Rutas que consume el frontend

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/clientes`
- `POST /api/clientes`
- `GET /api/materiales`
- `GET /api/materiales?estado=Archivado`
- `POST /api/materiales`
- `PATCH /api/materiales/:id/archivar`
- `PATCH /api/materiales/:id/desarchivar`
- `GET /api/proyectos`
- `POST /api/proyectos`
- `GET /api/inventario`
- `POST /api/inventario/movimientos`
- `GET /api/usuarios`
- `POST /api/usuarios`
- `GET /api/reportes?tipo=...&desde=...&hasta=...&estado=...`

## Nota importante

El frontend muestra los proyectos y otros listados solamente si la API está levantada y responde correctamente.

Si la API falla, se imprime un error y la pantalla no puede cargar la información del módulo.
