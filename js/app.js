  // URL del CSV de Google Sheets
  const URL_CSV_PEDIDOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRw3e3ilkO_gfIij6UF8qFS28GDgudfT4ikIbdH5026_GiFyk9eCVDU1hLcBg-lI7fNgHUFGXysYBbv/pub?output=csv';

  // Datos globales
  let pedidos = [];
  let despachos = [];

  // Lista base de estatus para el almacén. Otros valores encontrados se añadirán automáticamente.
  const ESTATUS_ALMACEN_LIST = [
    'EN PREPARACION',
    'PREPARADO/PICKEADO',
    'LISTO PARA DESPACHO',
    'EN RUTA/DESPACHO',
    'ENTREGADO',
    'PARCIALMENTE ENTREGADO',
    'DEVUELTO/RECHAZADO',
    'REQUIERE REVISION'
  ];

  // Variables para el mapa
  let mapPedidos;
  let layerPedidos;

  /**
   * Inicializa el mapa de pedidos. Si ya existe, no hace nada.
   */
  function initMapPedidos() {
    if (mapPedidos) return;
    mapPedidos = L.map('mapPedidos').setView([18.7357, -70.1627], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(mapPedidos);
    layerPedidos = L.layerGroup().addTo(mapPedidos);
  }

  /**
   * Agrupa una lista de pedidos por zonas aproximadas (redondeando latitud y longitud a 0.1 grados).
   * Devuelve un array con latitud promedio, longitud promedio, cantidad de pedidos y total de bultos por zona.
   */
  function agruparPedidosPorZona(lista) {
    const grupos = {};
    lista.forEach(p => {
      const lat = p.latitud;
      const lon = p.longitud;
      if (!isNaN(lat) && !isNaN(lon)) {
        // Redondear a 1 decimal para agrupar por zona (~11 km)
        const keyLat = Math.round(lat * 10) / 10;
        const keyLon = Math.round(lon * 10) / 10;
        const key = keyLat + ',' + keyLon;
        if (!grupos[key]) {
          grupos[key] = { latSum: 0, lonSum: 0, count: 0, bultos: 0 };
        }
        grupos[key].latSum += lat;
        grupos[key].lonSum += lon;
        grupos[key].count += 1;
        grupos[key].bultos += p.cantidad || 0;
      }
    });
    const resultado = [];
    Object.keys(grupos).forEach(key => {
      const g = grupos[key];
      resultado.push({
        lat: g.latSum / g.count,
        lon: g.lonSum / g.count,
        pedidos: g.count,
        bultos: g.bultos
      });
    });
    return resultado;
  }

  /**
   * Renderiza el mapa con marcadores agregados por zona.
   * Cada marcador muestra un popup con la cantidad de pedidos y bultos de esa zona.
   */
  function renderMapPedidos(lista) {
    if (!mapPedidos) return;
    // Limpiar capa existente
    layerPedidos.clearLayers();
    const grupos = agruparPedidosPorZona(lista);
    const bounds = [];
    grupos.forEach(g => {
      const marker = L.marker([g.lat, g.lon]);
      marker.bindPopup(`<strong>Pedidos:</strong> ${g.pedidos}<br/><strong>Total bultos:</strong> ${g.bultos}`);
      marker.addTo(layerPedidos);
      bounds.push([g.lat, g.lon]);
    });
    // Ajustar el mapa al conjunto de marcadores
    if (bounds.length > 0) {
      const b = L.latLngBounds(bounds);
      mapPedidos.fitBounds(b, { padding: [30, 30] });
    }
  }

  /**
   * Renderiza la tabla de pedidos con la lista proporcionada.
   */
  function renderTablaPedidos(lista) {
    const tbody = document.getElementById('tablaPedidos');
    tbody.innerHTML = '';
    lista.forEach(p => {
      const fila = `<tr class="border-b">
        <td class="px-4 py-2">${p.id}</td>
        <td class="px-4 py-2">${p.cliente}</td>
        <td class="px-4 py-2">${p.fecha}</td>
        <td class="px-4 py-2">${p.estado}</td>
        <td class="px-4 py-2">${p.responsable}</td>
        <td class="px-4 py-2">${p.cantidad}</td>
      </tr>`;
      tbody.innerHTML += fila;
    });
  }

  /**
   * Crea los botones de filtro para los estados de pedidos.
   * Los botones tienen colores distintos según el nombre del estado para facilitar la visualización.
   */
  function crearFiltrosPedidos(estadoUnicos) {
    const cont = document.getElementById('filtrosPedidos');
    cont.innerHTML = '';
    // Insertar "Todos" al principio
    const estados = ['Todos', ...estadoUnicos];
    estados.forEach(est => {
      const btn = document.createElement('button');
      btn.textContent = est || 'Sin estado';
      btn.className = 'px-3 py-2 rounded text-white';
      // Colores para algunos estados comunes
      if (est === 'Todos') {
        btn.classList.add('bg-gray-700');
      } else if (/pend/i.test(est)) {
        btn.classList.add('bg-yellow-500');
      } else if (/fact/i.test(est)) {
        btn.classList.add('bg-blue-500');
      } else if (/entre/i.test(est)) {
        btn.classList.add('bg-green-600');
      } else {
        btn.classList.add('bg-gray-500');
      }
      btn.addEventListener('click', () => filtrarPedidos(est));
      cont.appendChild(btn);
    });
  }

  /**
   * Filtra la lista de pedidos según el estado dado y actualiza la tabla y el mapa.
   */
  function filtrarPedidos(estado) {
    const lista = estado === 'Todos' ? pedidos : pedidos.filter(p => (p.estado || '').toLowerCase() === estado.toLowerCase());
    renderTablaPedidos(lista);
    renderMapPedidos(lista);
  }

  /**
   * Crea los gráficos de barras para los estados y responsables de pedidos.
   */
  function crearGraficos() {
    // Contar ocurrencias de cada estado y responsable
    const estadoData = {};
    const responsableData = {};
    pedidos.forEach(p => {
      const est = p.estado || 'Sin estado';
      estadoData[est] = (estadoData[est] || 0) + 1;
      const resp = p.responsable || 'Sin responsable';
      responsableData[resp] = (responsableData[resp] || 0) + 1;
    });
    // Gráfico de estados
    new Chart(document.getElementById('graficoEstados'), {
      type: 'bar',
      data: {
        labels: Object.keys(estadoData),
        datasets: [{
          data: Object.values(estadoData),
          backgroundColor: [
            '#F59E0B', '#3B82F6', '#10B981', '#EC4899', '#F43F5E', '#84CC16', '#FBBF24', '#8B5CF6',
            '#F97316', '#22C55E', '#E879F9', '#2DD4BF'
          ]
        }]
      },
      options: { plugins: { legend: { display: false } } }
    });
    // Gráfico de responsables
    new Chart(document.getElementById('graficoResponsables'), {
      type: 'bar',
      data: {
        labels: Object.keys(responsableData),
        datasets: [{
          data: Object.values(responsableData),
          backgroundColor: [
            '#EF4444', '#6366F1', '#8B5CF6', '#F97316', '#10B981', '#3B82F6', '#14B8A6', '#E11D48',
            '#A855F7', '#FCD34D', '#4ADE80', '#60A5FA'
          ]
        }]
      },
      options: { plugins: { legend: { display: false } } }
    });
  }

  /**
   * Renderiza las filas de la tabla de despachos.
   */
  function renderDespachos(lista) {
    const tbody = document.getElementById('tablaDespachos');
    tbody.innerHTML = '';
    lista.forEach(d => {
      // Crear el desplegable de estatus para cada fila
      const opciones = ESTATUS_ALMACEN_LIST.map(opt => {
        const sel = (opt.toUpperCase() === (d.estadoAlmacen || '').toUpperCase()) ? 'selected' : '';
        return `<option value="${opt}" ${sel}>${opt}</option>`;
      }).join('');
      const selectHtml = `<select class="border rounded p-1 text-xs" onchange="actualizarEstatusDespacho('${d.id}', this)">${opciones}</select>`;
      const fila = `<tr class="border-b">
        <td class="px-4 py-2">${d.id}</td>
        <td class="px-4 py-2">${d.pedido}</td>
        <td class="px-4 py-2">${d.cliente}</td>
        <td class="px-4 py-2">${d.fecha}</td>
        <td class="px-4 py-2">${d.transportista}</td>
        <td class="px-4 py-2">${selectHtml}</td>
        <td class="px-4 py-2">${d.lastModified || ''}</td>
      </tr>`;
      tbody.innerHTML += fila;
    });
  }

  /**
   * Actualiza el estatus de un despacho tras confirmación y guarda la fecha de modificación.
   * Guarda los cambios en localStorage para que persistan al recargar la página.
   */
  function actualizarEstatusDespacho(id, selectEl) {
    const nuevoEstado = selectEl.value;
    // Buscar el despacho correspondiente
    const d = despachos.find(x => x.id === id);
    if (!d) return;
    // Preguntar confirmación
    const ok = window.confirm('¿Desea cambiar el estatus?');
    if (!ok) {
      // Restaurar select a su valor anterior
      selectEl.value = d.estadoAlmacen || '';
      return;
    }
    // Actualizar y persistir
    d.estadoAlmacen = nuevoEstado;
    const ahora = new Date().toLocaleString();
    d.lastModified = ahora;
    localStorage.setItem('despachoEstado_' + id, nuevoEstado);
    localStorage.setItem('despachoLastMod_' + id, ahora);
    // Volver a aplicar filtros para actualizar la tabla
    aplicarFiltrosDespachos();
  }

  /**
   * Carga los estatus de despachos almacenados en localStorage y los aplica.
   */
  function cargarEstatusDespachosDesdeLocal() {
    despachos.forEach(d => {
      const est = localStorage.getItem('despachoEstado_' + d.id);
      if (est) d.estadoAlmacen = est;
      const lm = localStorage.getItem('despachoLastMod_' + d.id);
      if (lm) d.lastModified = lm;
    });
  }

  /**
   * Crea los filtros de los despachos para los campos Estatus Almacén y Estado de Pedido.
   */
  function crearFiltrosDespachos() {
    // Filtro de estatus de almacén
    const estatusSelect = document.getElementById('filtroDespachoEstatus');
    // Lista de opciones con los estatus base más los que encuentren en los datos
    const uniqueEstatus = Array.from(new Set(despachos.map(d => d.estadoAlmacen || '')));
    const opcionesEstatus = ['Todos', ...ESTATUS_ALMACEN_LIST, ...uniqueEstatus.filter(x => !ESTATUS_ALMACEN_LIST.includes(x))];
    estatusSelect.innerHTML = '';
    opcionesEstatus.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      estatusSelect.appendChild(option);
    });
    // Filtro de estado de pedido
    const estadoSelect = document.getElementById('filtroDespachoEstado');
    const uniqueEstados = Array.from(new Set(despachos.map(d => d.estadoPedido || '')));
    estadoSelect.innerHTML = '';
    const optTodos = document.createElement('option');
    optTodos.value = 'Todos';
    optTodos.textContent = 'Todos';
    estadoSelect.appendChild(optTodos);
    uniqueEstados.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt || 'Sin estado';
      estadoSelect.appendChild(option);
    });
    // Asignar eventos
    estatusSelect.onchange = aplicarFiltrosDespachos;
    estadoSelect.onchange = aplicarFiltrosDespachos;
  }

  /**
   * Aplica los filtros seleccionados a los despachos y actualiza la tabla.
   */
  function aplicarFiltrosDespachos() {
    const estAlmacen = document.getElementById('filtroDespachoEstatus').value;
    const estPedido = document.getElementById('filtroDespachoEstado').value;
    let lista = despachos;
    if (estAlmacen && estAlmacen !== 'Todos') {
      lista = lista.filter(d => (d.estadoAlmacen || '').toUpperCase() === estAlmacen.toUpperCase());
    }
    if (estPedido && estPedido !== 'Todos') {
      lista = lista.filter(d => (d.estadoPedido || '').toUpperCase() === estPedido.toUpperCase());
    }
    renderDespachos(lista);
  }

  /**
   * Muestra la sección indicada ocultando las demás y asegura que el mapa se redibuje cuando se accede a pedidos.
   */
  function mostrarSeccion(id) {
    const secciones = ['moduloPedidos', 'moduloDespachos', 'moduloRecepcion', 'moduloInventario'];
    secciones.forEach(sec => {
      const el = document.getElementById(sec);
      if (el) el.classList.add('hidden');
    });
    const visible = document.getElementById(id);
    if (visible) visible.classList.remove('hidden');
    // Redimensionar mapa al mostrar pedidos
    if (id === 'moduloPedidos') {
      setTimeout(() => {
        if (mapPedidos) mapPedidos.invalidateSize();
      }, 200);
    }
  }

  /**
   * Lee el CSV de Google Sheets y construye las listas de pedidos y despachos.
   * También se encarga de crear filtros y gráficos una vez cargados los datos.
   */
  function cargarDatos() {
    Papa.parse(URL_CSV_PEDIDOS, {
      download: true,
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: function(results) {
        // Convertir cada fila a objetos de pedidos y despachos
        pedidos = results.data.map(row => {
          // Identificar los campos de interés de manera flexible
          const id = row['PEDIDO #'] || row['PEDIDO'] || row['Pedido'] || row.PEDIDO || row.Pedido || row.pedido || row.id || row.ID || '';
          const cliente = row['NOMBRE'] || row['Nombre'] || row.Nombre || row.cliente || row.Cliente || row.CLIENTE || '';
          const fecha = row['FECHA'] || row['Fecha'] || row.Fecha || row.fecha || '';
          const estado = row['ESTADO'] || row['Estado'] || row.Estado || row.estado || '';
          // Responsable puede estar en USUARIO APRUEBA, APROBADO, USUARIO, CHOFER, etc.
          let responsable = row['USUARIO APRUEBA'] || row['Usuario Aprueba'] || row['APROBADO'] || row.APROBADO || row.aprobado || '';
          if (!responsable) {
            responsable = row['CHOFER'] || row['Chofer'] || row.Chofer || row['RESPONSABLE'] || row.Responsable || '';
          }
          const cantidadStr = row['CANTIDAD'] || row['Cantidad'] || row.Cantidad || row.cantidad || '0';
          const cantidad = parseFloat(cantidadStr.toString().replace(/,/g, '').replace(/ /g, '')) || 0;
          const latStr = row['LATITUD'] || row['Latitud'] || row.latitud || row.LATITUD || '';
          const lonStr = row['LONGITUD'] || row['Longitud'] || row.longitud || row.LONGITUD || '';
          const lat = parseFloat(latStr.toString().replace(',', '.'));
          const lon = parseFloat(lonStr.toString().replace(',', '.'));
          return { id, cliente, fecha, estado, responsable, cantidad, latitud: lat, longitud: lon };
        }).filter(p => p.id && p.cliente);
        // Convertir a despachos
        despachos = results.data.map(row => {
          const id = row['COD.'] || row['COD'] || row['Cod.'] || row['Cod'] || row.cod || row.COD || '';
          const pedido = row['PEDIDO #'] || row['PEDIDO'] || row['Pedido'] || row.PEDIDO || row.Pedido || row.pedido || '';
          const cliente = row['NOMBRE'] || row['Nombre'] || row.Nombre || row.cliente || row.Cliente || row.CLIENTE || '';
          const fecha = row['FECHA'] || row['Fecha'] || row.Fecha || row.fecha || '';
          const transportista = row['CHOFER'] || row['Chofer'] || row.Chofer || row['TRANSPORTISTA'] || row.Transportista || '';
          let estadoAlmacen = row['ESTATUS ALMACEN'] || row['Estatus Almacen'] || row['Estatus Almacén'] || row['ESTADO'] || row.estado || '';
          // Some sheets might only specify "ESTADO" meaning the status of the order, not warehouse. We'll differentiate below.
          const estadoPedido = row['ESTADO'] || row['Estado'] || row.Estado || row.estado || '';
          const lastModified = row['FECHA APROBACION'] || row['Fecha Aprobacion'] || row['Fecha Aprobación'] || row['FECHA APROB'] || '';
          return { id, pedido, cliente, fecha, transportista, estadoAlmacen, estadoPedido, lastModified };
        }).filter(d => d.id && d.pedido);
        // Cargar estatus persistidos y sobrescribir en despachos
        cargarEstatusDespachosDesdeLocal();
        // Crear filtros y vistas iniciales
        const estadosUnicos = Array.from(new Set(pedidos.map(p => p.estado || '')));
        crearFiltrosPedidos(estadosUnicos);
        filtrarPedidos('Todos');
        crearGraficos();
        crearFiltrosDespachos();
        aplicarFiltrosDespachos();
      }
    });
  }

  // Cuando el documento esté listo, inicializar mapa y cargar datos
  document.addEventListener('DOMContentLoaded', () => {
    initMapPedidos();
    cargarDatos();
    // Mostrar por defecto la sección de pedidos
    mostrarSeccion('moduloPedidos');
  });

window.mostrarSeccion = mostrarSeccion;
window.actualizarEstatusDespacho = actualizarEstatusDespacho;
