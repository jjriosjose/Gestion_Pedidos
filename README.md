# Gestión de Pedidos

## Configuración de la URL del CSV

La aplicación carga los pedidos desde un archivo CSV. La URL puede definirse de dos formas antes de llamar a `cargarDatos()`:

1. **Variable global**
   ```html
   <script>
     // Configuración para producción
     window.URL_CSV_PEDIDOS = 'https://ejemplo.com/produccion.csv';
   </script>
   ```

2. **Atributo HTML**
   ```html
   <body data-url-csv="https://ejemplo.com/pruebas.csv">
   ```

Al ejecutar `cargarDatos()` se lee primero la variable global, luego el atributo del `<body>` y por último una URL por defecto. Si ninguno de estos valores está presente, la aplicación mostrará un aviso.
