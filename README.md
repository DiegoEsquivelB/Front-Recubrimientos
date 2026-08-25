# Sistema de Recubrimientos Arquitectónicos

Base visual del Sistema de Administración y Gestión de Recubrimientos Arquitectónicos.

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
    └── js/app.js              # Interacciones y validaciones iniciales
```

## Uso

Abra `login.html` en su navegador. Por ahora es un prototipo frontal: los
formularios validan los campos requeridos y muestran mensajes de confirmación,
pero aún no guardan información en una base de datos.

