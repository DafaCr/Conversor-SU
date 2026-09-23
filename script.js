// ============================================================
// SCRIPT.JS — Lógica del conversor
// No es necesario tocar este archivo para actualizar códigos.
// La lista de productos puede venir de dos lugares:
//   1. Google Sheets (si configuraste URL_APPS_SCRIPT abajo)
//   2. codigos.js, como respaldo si Sheets no responde
// ============================================================

(function () {
  "use strict";

  // URL_APPS_SCRIPT y CLAVE_SECRETA vienen de config.js, cargado
  // antes que este archivo en index.html.

  const input = document.getElementById("input-codigo");
  const resultado = document.getElementById("resultado");
  const resultadoNombre = document.getElementById("resultado-nombre");
  const listaCodigos = document.getElementById("lista-codigos");
  const mensajeError = document.getElementById("mensaje-error");
  const listaResultados = document.getElementById("lista-resultados");
  const listaItems = document.getElementById("lista-items");
  const resultadoAcciones = document.getElementById("resultado-acciones");
  const btnEditar = document.getElementById("btn-editar");
  const btnEliminar = document.getElementById("btn-eliminar");

  const btnAgregar = document.getElementById("btn-agregar");
  const modalFondo = document.getElementById("modal-fondo");
  const modalTitulo = document.getElementById("modal-titulo");
  const formAgregar = document.getElementById("form-agregar");
  const campoNombre = document.getElementById("campo-nombre");
  const campoReferencia = document.getElementById("campo-referencia");
  const campoCodigo = document.getElementById("campo-codigo");
  const modalMensaje = document.getElementById("modal-mensaje");
  const btnCancelar = document.getElementById("btn-cancelar");
  const btnGuardar = document.getElementById("btn-guardar");

  const accesosLista = document.getElementById("accesos-lista");
  const btnAgregarAcceso = document.getElementById("btn-agregar-acceso");
  const modalAccesoFondo = document.getElementById("modal-acceso-fondo");
  const formAcceso = document.getElementById("form-acceso");
  const campoAccesoNombre = document.getElementById("campo-acceso-nombre");
  const campoAccesoReferencias = document.getElementById("campo-acceso-referencias");
  const modalAccesoMensaje = document.getElementById("modal-acceso-mensaje");
  const btnAccesoCancelar = document.getElementById("btn-acceso-cancelar");
  const btnAccesoGuardar = document.getElementById("btn-acceso-guardar");

  let codigosActivos = typeof codigos === "object" ? codigos : {};

  let indiceSeleccionado = -1;
  let claveProductoActual = null; // código del producto mostrado en pantalla (para Editar/Eliminar)

  // Para el ciclo de "Enter copia el siguiente código" cuando hay un combo.
  let botonesCodigoActuales = [];
  let proximoIndiceCopia = 0;

  // Estado del modal: si estamos editando un producto existente, y
  // cuál era su código original (por si lo cambian durante la edición).
  let modoEdicion = false;
  let codigoOriginalEdicion = null;
  let confirmacionPendientePara = null; // evita re-mostrar la advertencia si no cambiaron los datos

  mostrarResultadoVacio();
  cargarProductosRemotos();
  cargarAccesosRemotos();

  document.addEventListener("click", function (evento) {
    const tocaBotonCopiar = evento.target.closest && evento.target.closest(".boton-copiar-codigo");
    const tocaItemDeLista = evento.target.closest && evento.target.closest(".lista-item");
    const tocaBotonAgregar = evento.target.closest && evento.target.closest(".btn-flotante");
    const tocaModal = evento.target.closest && evento.target.closest(".modal-fondo");
    const tocaAcciones = evento.target.closest && evento.target.closest(".resultado-acciones");
    if (!tocaBotonCopiar && !tocaItemDeLista && !tocaBotonAgregar && !tocaModal && !tocaAcciones) {
      input.focus();
    }
  });

  window.addEventListener("load", function () {
    input.focus();
  });

  // Permite copiar el nombre del producto tocándolo directamente.
  resultadoNombre.addEventListener("click", function () {
    if (!resultadoNombre.textContent) return;
    copiarAlPortapapeles(resultadoNombre.textContent, resultadoNombre);
  });

  input.addEventListener("input", function () {
    // Si el usuario escribe algo, ya no seguimos en modo "copiar
    // el siguiente código del combo": el próximo Enter debe buscar.
    proximoIndiceCopia = 0;
  });

  input.addEventListener("keydown", function (evento) {
    if (!listaResultados.hidden) {
      if (evento.key === "ArrowDown") {
        evento.preventDefault();
        moverSeleccion(1);
        return;
      }
      if (evento.key === "ArrowUp") {
        evento.preventDefault();
        moverSeleccion(-1);
        return;
      }
      if (evento.key === "Enter" && indiceSeleccionado >= 0) {
        evento.preventDefault();
        const items = listaItems.querySelectorAll(".lista-item");
        if (items[indiceSeleccionado]) {
          items[indiceSeleccionado].click();
        }
        return;
      }
    }

    if (evento.key === "Enter") {
      evento.preventDefault();

      // Si ya hay un combo mostrado y quedan códigos por copiar, el
      // siguiente Enter copia el siguiente código en vez de buscar de nuevo.
      if (proximoIndiceCopia > 0 && proximoIndiceCopia < botonesCodigoActuales.length) {
        copiarAlPortapapeles(botonesCodigoActuales[proximoIndiceCopia].codigo, botonesCodigoActuales[proximoIndiceCopia].boton);
        proximoIndiceCopia++;
        return;
      }

      buscarCodigo();
    }
  });

  function moverSeleccion(direccion) {
    const items = listaItems.querySelectorAll(".lista-item");
    if (items.length === 0) return;

    indiceSeleccionado = (indiceSeleccionado + direccion + items.length) % items.length;

    items.forEach(function (item, indice) {
      item.classList.toggle("lista-item--activa", indice === indiceSeleccionado);
    });

    items[indiceSeleccionado].scrollIntoView({ block: "nearest" });
  }

  function cargarProductosRemotos() {
    if (!URL_APPS_SCRIPT || URL_APPS_SCRIPT.indexOf("PEGA_AQUI") !== -1) {
      return;
    }

    fetch(URL_APPS_SCRIPT + "?clave=" + encodeURIComponent(CLAVE_SECRETA))
      .then(function (respuesta) {
        if (!respuesta.ok) throw new Error("Respuesta no válida");
        return respuesta.json();
      })
      .then(function (productosRemotos) {
        if (productosRemotos && Object.keys(productosRemotos).length > 0) {
          codigosActivos = productosRemotos;
        }
      })
      .catch(function () {
        // Sin internet, Google caído, o URL/clave mal configurada:
        // seguimos usando codigos.js normalmente.
      });
  }

  // ------------------------------------------------------------
  // ACCESOS RÁPIDOS (botones grandes que copian un código al instante)
  // ------------------------------------------------------------

  let accesosActuales = [];

  function cargarAccesosRemotos() {
    if (!URL_APPS_SCRIPT || URL_APPS_SCRIPT.indexOf("PEGA_AQUI") !== -1) {
      return;
    }

    fetch(URL_APPS_SCRIPT + "?clave=" + encodeURIComponent(CLAVE_SECRETA) + "&accion=accesos")
      .then(function (respuesta) {
        if (!respuesta.ok) throw new Error("Respuesta no válida");
        return respuesta.json();
      })
      .then(function (accesosRemotos) {
        if (Array.isArray(accesosRemotos)) {
          accesosActuales = accesosRemotos;
          renderizarAccesos();
        }
      })
      .catch(function () {
        // Sin internet o mal configurado: el panel queda vacío,
        // sin interrumpir el resto de la página.
      });
  }

  function renderizarAccesos() {
    if (!accesosLista) return;
    accesosLista.innerHTML = "";

    accesosActuales.forEach(function (acceso) {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "acceso-boton";

      const etiquetaTexto = document.createElement("span");
      etiquetaTexto.className = "acceso-boton-texto";
      etiquetaTexto.textContent = acceso.nombre;
      boton.appendChild(etiquetaTexto);

      const botonEliminar = document.createElement("button");
      botonEliminar.type = "button";
      botonEliminar.className = "acceso-eliminar";
      botonEliminar.textContent = "✕";
      botonEliminar.title = "Eliminar este acceso";
      botonEliminar.addEventListener("click", function (evento) {
        evento.stopPropagation();
        eliminarAcceso(acceso.nombre);
      });
      boton.appendChild(botonEliminar);

      boton.addEventListener("click", function () {
        const textoACopiar = acceso.skus.join(" + ");
        navigator.clipboard.writeText(textoACopiar).then(function () {
          boton.classList.add("copiado");
          etiquetaTexto.textContent = "¡Copiado!";
          setTimeout(function () {
            boton.classList.remove("copiado");
            etiquetaTexto.textContent = acceso.nombre;
          }, 1200);
        }).catch(function () {
          // Si falla el copiado automático, no rompemos nada.
        });
      });

      accesosLista.appendChild(boton);
    });
  }

  function eliminarAcceso(nombre) {
    if (!URL_APPS_SCRIPT || URL_APPS_SCRIPT.indexOf("PEGA_AQUI") !== -1) {
      alert("Falta configurar Google Sheets (URL_APPS_SCRIPT) para poder eliminar accesos.");
      return;
    }

    const confirmado = confirm('¿Eliminar el acceso rápido "' + nombre + '"?');
    if (!confirmado) return;

    fetch(URL_APPS_SCRIPT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ tipo: "eliminar_acceso", nombre: nombre, clave: CLAVE_SECRETA })
    }).then(function () {
      accesosActuales = accesosActuales.filter(function (a) { return a.nombre !== nombre; });
      renderizarAccesos();
    }).catch(function () {
      alert("No se pudo eliminar (revisa tu conexión a internet).");
    });
  }

  if (btnAgregarAcceso) {
    btnAgregarAcceso.addEventListener("click", function () {
      modalAccesoFondo.hidden = false;
      formAcceso.reset();
      modalAccesoMensaje.hidden = true;
      modalAccesoMensaje.classList.remove("exito");
      campoAccesoNombre.focus();
    });
  }

  if (btnAccesoCancelar) {
    btnAccesoCancelar.addEventListener("click", function () {
      modalAccesoFondo.hidden = true;
      input.focus();
    });
  }

  if (modalAccesoFondo) {
    modalAccesoFondo.addEventListener("click", function (evento) {
      if (evento.target === modalAccesoFondo) {
        modalAccesoFondo.hidden = true;
        input.focus();
      }
    });
  }

  if (formAcceso) {
    formAcceso.addEventListener("submit", function (evento) {
      evento.preventDefault();

      const nombre = campoAccesoNombre.value.trim();
      const textoCodigos = campoAccesoReferencias.value.trim();

      if (!nombre || !textoCodigos) {
        modalAccesoMensaje.textContent = "Completa los 2 campos.";
        modalAccesoMensaje.hidden = false;
        modalAccesoMensaje.classList.remove("exito");
        return;
      }

      if (!URL_APPS_SCRIPT || URL_APPS_SCRIPT.indexOf("PEGA_AQUI") !== -1) {
        modalAccesoMensaje.textContent = "Falta configurar Google Sheets (URL_APPS_SCRIPT) para poder guardar accesos.";
        modalAccesoMensaje.hidden = false;
        modalAccesoMensaje.classList.remove("exito");
        return;
      }

      btnAccesoGuardar.disabled = true;
      btnAccesoGuardar.textContent = "Guardando…";

      fetch(URL_APPS_SCRIPT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ tipo: "nuevo_acceso", nombre: nombre, skus: textoCodigos, clave: CLAVE_SECRETA })
      }).then(function () {
        const arrayCodigos = textoCodigos.split(",").map(function (s) { return s.trim(); }).filter(function (s) { return s !== ""; });

        const existente = accesosActuales.findIndex(function (a) { return a.nombre.toLowerCase() === nombre.toLowerCase(); });
        if (existente !== -1) {
          accesosActuales[existente] = { nombre: nombre, skus: arrayCodigos };
        } else {
          accesosActuales.push({ nombre: nombre, skus: arrayCodigos });
        }
        renderizarAccesos();

        modalAccesoMensaje.textContent = "Acceso guardado.";
        modalAccesoMensaje.hidden = false;
        modalAccesoMensaje.classList.add("exito");

        setTimeout(function () {
          modalAccesoFondo.hidden = true;
          modalAccesoMensaje.hidden = true;
          input.focus();
        }, 1000);
      }).catch(function () {
        modalAccesoMensaje.textContent = "No se pudo guardar (revisa tu conexión a internet).";
        modalAccesoMensaje.hidden = false;
        modalAccesoMensaje.classList.remove("exito");
      }).finally(function () {
        btnAccesoGuardar.disabled = false;
        btnAccesoGuardar.textContent = "Guardar";
      });
    });
  }

  // Devuelve la CLAVE real (tal como está guardada) que coincide con
  // la consulta, sin distinguir mayúsculas/minúsculas. Null si no hay.
  function buscarClaveExacta(consulta) {
    if (codigosActivos[consulta]) return consulta;

    const consultaMinuscula = consulta.toLowerCase();
    const claves = Object.keys(codigosActivos);
    for (let i = 0; i < claves.length; i++) {
      if (claves[i].toLowerCase() === consultaMinuscula) {
        return claves[i];
      }
    }
    return null;
  }

  // Busca si un código ya pertenece a OTRO producto (para avisar antes
  // de guardar). codigoExcluir permite ignorar el producto que se
  // está editando actualmente (no debe "chocar" contra sí mismo).
  function buscarProductoPorCodigo(codigo, codigoExcluir) {
    const codigoMinuscula = codigo.toLowerCase();
    const entradas = Object.entries(codigosActivos);

    for (let i = 0; i < entradas.length; i++) {
      const clave = entradas[i][0];
      const producto = entradas[i][1];

      if (codigoExcluir && clave.toLowerCase() === codigoExcluir.toLowerCase()) {
        continue;
      }

      const tieneCodigo = producto.skus.some(function (s) {
        return s.toLowerCase() === codigoMinuscula;
      });

      if (tieneCodigo) {
        return { clave: clave, producto: producto };
      }
    }

    return null;
  }

  function buscarCodigo() {
    const consulta = input.value.trim();

    if (consulta === "") {
      return;
    }

    const claveExacta = buscarClaveExacta(consulta);

    if (claveExacta) {
      const producto = codigosActivos[claveExacta];
      ocultarListaResultados();
      mostrarResultadoOk(claveExacta, producto.skus, producto.nombre);
    } else {
      const consultaMinuscula = consulta.toLowerCase();
      const coincidencias = Object.entries(codigosActivos).filter(function (entrada) {
        return entrada[1].nombre.toLowerCase().indexOf(consultaMinuscula) !== -1;
      });

      if (coincidencias.length === 1) {
        ocultarListaResultados();
        mostrarResultadoOk(coincidencias[0][0], coincidencias[0][1].skus, coincidencias[0][1].nombre);
      } else if (coincidencias.length > 1) {
        mostrarResultadoVacio();
        mostrarListaResultados(coincidencias);
      } else {
        ocultarListaResultados();
        mostrarResultadoError(consulta);
      }
    }

    input.select();
  }

  function mostrarResultadoOk(clave, codigosProducto, nombre) {
    resultado.classList.remove("resultado--vacio", "resultado--error");
    resultado.classList.add("resultado--ok");

    mensajeError.hidden = true;
    resultadoNombre.textContent = nombre || "";

    claveProductoActual = clave;
    resultadoAcciones.hidden = false;

    botonesCodigoActuales = renderizarCodigos(codigosProducto);

    // Se copia automático el primer código. Si hay más de uno (combo),
    // el próximo Enter (sin escribir nada nuevo) copia el siguiente.
    copiarAlPortapapeles(botonesCodigoActuales[0].codigo, botonesCodigoActuales[0].boton);
    proximoIndiceCopia = 1;
  }

  function mostrarResultadoError(consulta) {
    resultado.classList.remove("resultado--vacio", "resultado--ok");
    resultadoNombre.textContent = "";
    listaCodigos.innerHTML = "";
    mensajeError.hidden = false;
    resultadoAcciones.hidden = true;
    claveProductoActual = null;
    botonesCodigoActuales = [];
    proximoIndiceCopia = 0;

    resultado.classList.remove("resultado--error");
    void resultado.offsetWidth;
    resultado.classList.add("resultado--error");

    registrarCodigoNoEncontrado(consulta);
  }

  function mostrarResultadoVacio() {
    resultado.classList.remove("resultado--ok", "resultado--error");
    resultado.classList.add("resultado--vacio");
    resultadoNombre.textContent = "";
    mensajeError.hidden = true;
    resultadoAcciones.hidden = true;
    claveProductoActual = null;
    botonesCodigoActuales = [];
    proximoIndiceCopia = 0;

    listaCodigos.innerHTML = "";
    const filaVacia = document.createElement("div");
    filaVacia.className = "fila-codigo fila-codigo--vacia";

    const etiqueta = document.createElement("span");
    etiqueta.className = "etiqueta-codigo";
    etiqueta.textContent = "Código";

    const valor = document.createElement("span");
    valor.className = "valor-codigo";
    valor.textContent = "—";

    filaVacia.appendChild(etiqueta);
    filaVacia.appendChild(valor);
    listaCodigos.appendChild(filaVacia);
  }

  function renderizarCodigos(listaDeCodigos) {
    listaCodigos.innerHTML = "";
    const esCombo = listaDeCodigos.length > 1;
    const botones = [];

    listaDeCodigos.forEach(function (codigo, indice) {
      const fila = document.createElement("div");
      fila.className = "fila-codigo fila-codigo--clickeable";

      const etiqueta = document.createElement("span");
      etiqueta.className = "etiqueta-codigo";
      etiqueta.textContent = esCombo ? "Código " + (indice + 1) : "Código";

      const valor = document.createElement("span");
      valor.className = "valor-codigo";
      valor.textContent = codigo;

      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "boton-copiar-codigo";
      boton.textContent = "Copiar";
      boton.addEventListener("click", function () {
        copiarAlPortapapeles(codigo, boton);
      });

      fila.appendChild(etiqueta);
      fila.appendChild(valor);
      fila.appendChild(boton);

      // Permite copiar tocando cualquier parte de la fila, no solo
      // el botón pequeño "Copiar".
      fila.addEventListener("click", function (evento) {
        if (evento.target.closest(".boton-copiar-codigo")) return;
        copiarAlPortapapeles(codigo, boton);
      });

      listaCodigos.appendChild(fila);

      botones.push({ codigo: codigo, boton: boton });
    });

    return botones;
  }

  function mostrarListaResultados(coincidencias) {
    listaItems.innerHTML = "";
    indiceSeleccionado = -1;

    coincidencias.forEach(function (entrada) {
      const clave = entrada[0];
      const producto = entrada[1];

      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "lista-item";

      const nombreSpan = document.createElement("span");
      nombreSpan.className = "lista-item-nombre";
      nombreSpan.textContent = producto.nombre;

      const codigoSpan = document.createElement("span");
      codigoSpan.className = "lista-item-codigo";
      codigoSpan.textContent = producto.skus.join(" + ");

      boton.appendChild(nombreSpan);
      boton.appendChild(codigoSpan);

      boton.addEventListener("click", function () {
        ocultarListaResultados();
        mostrarResultadoOk(clave, producto.skus, producto.nombre);
        input.value = "";
        input.focus();
      });

      listaItems.appendChild(boton);
    });

    listaResultados.hidden = false;
  }

  function ocultarListaResultados() {
    listaResultados.hidden = true;
    listaItems.innerHTML = "";
    indiceSeleccionado = -1;
  }

  function copiarAlPortapapeles(valor, boton) {
    if (!boton) return;
    if (!navigator.clipboard) return;

    const textoOriginal = boton.textContent;

    navigator.clipboard.writeText(valor).then(function () {
      boton.textContent = "¡Copiado!";
      boton.classList.add("copiado");
      setTimeout(function () {
        boton.textContent = textoOriginal;
        boton.classList.remove("copiado");
      }, 1200);
    }).catch(function () {
      // El botón "Copiar" sigue funcionando manualmente.
    });
  }

  function registrarCodigoNoEncontrado(consulta) {
    if (!URL_APPS_SCRIPT || URL_APPS_SCRIPT.indexOf("PEGA_AQUI") !== -1) {
      return;
    }

    fetch(URL_APPS_SCRIPT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ tipo: "registro", codigo: consulta, clave: CLAVE_SECRETA })
    }).catch(function () {});
  }

  // ------------------------------------------------------------
  // BOTÓN "+" — Agregar producto nuevo
  // ------------------------------------------------------------

  btnAgregar.addEventListener("click", function () {
    abrirModalAgregar();
  });

  btnCancelar.addEventListener("click", function () {
    cerrarModal();
  });

  modalFondo.addEventListener("click", function (evento) {
    if (evento.target === modalFondo) {
      cerrarModal();
    }
  });

  formAgregar.addEventListener("submit", function (evento) {
    evento.preventDefault();
    guardarProducto();
  });

  [campoNombre, campoReferencia, campoCodigo].forEach(function (campo) {
    campo.addEventListener("input", function () {
      if (confirmacionPendientePara !== null) {
        confirmacionPendientePara = null;
        modalMensaje.hidden = true;
        btnGuardar.textContent = modoEdicion ? "Guardar cambios" : "Guardar";
      }
    });
  });

  function abrirModalAgregar() {
    modoEdicion = false;
    codigoOriginalEdicion = null;
    modalTitulo.textContent = "Agregar producto";
    btnGuardar.textContent = "Guardar";
    campoCodigo.disabled = false;

    modalFondo.hidden = false;
    formAgregar.reset();
    modalMensaje.hidden = true;
    modalMensaje.classList.remove("exito");
    confirmacionPendientePara = null;
    campoNombre.focus();
  }

  function abrirModalEditar() {
    if (!claveProductoActual) return;
    const producto = codigosActivos[claveProductoActual];

    modoEdicion = true;
    codigoOriginalEdicion = claveProductoActual;
    modalTitulo.textContent = "Editar producto";
    btnGuardar.textContent = "Guardar cambios";

    modalFondo.hidden = false;
    modalMensaje.hidden = true;
    modalMensaje.classList.remove("exito");
    confirmacionPendientePara = null;

    campoNombre.value = producto.nombre;
    campoReferencia.value = producto.skus.join(",");
    campoCodigo.value = claveProductoActual;
    campoNombre.focus();
  }

  function cerrarModal() {
    modalFondo.hidden = true;
    input.focus();
  }

  function guardarProducto() {
    const nombre = campoNombre.value.trim();
    const textoCodigos = campoReferencia.value.trim();
    const codigo = campoCodigo.value.trim();

    if (!nombre || !textoCodigos || !codigo) {
      mostrarMensajeModal("Completa los 3 campos.", false);
      return;
    }

    if (!URL_APPS_SCRIPT || URL_APPS_SCRIPT.indexOf("PEGA_AQUI") !== -1) {
      mostrarMensajeModal("Falta configurar Google Sheets (URL_APPS_SCRIPT) para poder guardar productos.", false);
      return;
    }

    const codigoAExcluir = modoEdicion ? codigoOriginalEdicion : null;
    const arrayCodigos = textoCodigos.split(",").map(function (s) { return s.trim(); }).filter(function (s) { return s !== ""; });

    // --- Verificar duplicados (código y cada referencia) ---
    const advertencias = [];

    const claveExistente = buscarClaveExacta(codigo);
    const esMismoCodigoOriginal = modoEdicion && claveExistente && claveExistente.toLowerCase() === codigoOriginalEdicion.toLowerCase();
    if (claveExistente && !esMismoCodigoOriginal) {
      const productoExistente = codigosActivos[claveExistente];
      advertencias.push('el código ya pertenece a "' + productoExistente.nombre + '"');
    }

    arrayCodigos.forEach(function (codigoIndividual) {
      const coincidenciaCodigo = buscarProductoPorCodigo(codigoIndividual, codigoAExcluir);
      if (coincidenciaCodigo) {
        advertencias.push('el código ' + codigoIndividual + ' ya pertenece a "' + coincidenciaCodigo.producto.nombre + '"');
      }
    });

    const claveConfirmacion = codigo.toLowerCase() + "|" + textoCodigos.toLowerCase();

    if (advertencias.length > 0 && confirmacionPendientePara !== claveConfirmacion) {
      confirmacionPendientePara = claveConfirmacion;
      mostrarMensajeModal("Atención: " + advertencias.join("; ") + ". Presiona de nuevo para guardar igualmente.", false);
      btnGuardar.textContent = "Confirmar de todas formas";
      return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = "Guardando…";

    const payload = modoEdicion
      ? { tipo: "editar_producto", codigoOriginal: codigoOriginalEdicion, codigo: codigo, skus: textoCodigos, nombre: nombre, clave: CLAVE_SECRETA }
      : { tipo: "nuevo_producto", codigo: codigo, skus: textoCodigos, nombre: nombre, clave: CLAVE_SECRETA };

    fetch(URL_APPS_SCRIPT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function () {
      if (modoEdicion && codigoOriginalEdicion.toLowerCase() !== codigo.toLowerCase()) {
        delete codigosActivos[codigoOriginalEdicion];
      }
      codigosActivos[codigo] = { skus: arrayCodigos, nombre: nombre };

      mostrarMensajeModal(modoEdicion ? "Cambios guardados." : "Producto guardado.", true);

      if (modoEdicion && claveProductoActual && claveProductoActual.toLowerCase() === codigoOriginalEdicion.toLowerCase()) {
        mostrarResultadoOk(codigo, arrayCodigos, nombre);
      }

      setTimeout(function () {
        cerrarModal();
      }, 1200);
    }).catch(function () {
      mostrarMensajeModal("No se pudo guardar (revisa tu conexión a internet).", false);
    }).finally(function () {
      btnGuardar.disabled = false;
      btnGuardar.textContent = modoEdicion ? "Guardar cambios" : "Guardar";
    });
  }

  function mostrarMensajeModal(texto, esExito) {
    modalMensaje.textContent = texto;
    modalMensaje.hidden = false;
    modalMensaje.classList.toggle("exito", !!esExito);
  }

  // ------------------------------------------------------------
  // EDITAR / ELIMINAR desde el resultado
  // ------------------------------------------------------------

  btnEditar.addEventListener("click", function () {
    if (!URL_APPS_SCRIPT || URL_APPS_SCRIPT.indexOf("PEGA_AQUI") !== -1) {
      alert("Falta configurar Google Sheets (URL_APPS_SCRIPT) para poder editar productos.");
      return;
    }
    abrirModalEditar();
  });

  btnEliminar.addEventListener("click", function () {
    if (!claveProductoActual) return;

    if (!URL_APPS_SCRIPT || URL_APPS_SCRIPT.indexOf("PEGA_AQUI") !== -1) {
      alert("Falta configurar Google Sheets (URL_APPS_SCRIPT) para poder eliminar productos.");
      return;
    }

    const producto = codigosActivos[claveProductoActual];
    const confirmado = confirm('¿Eliminar "' + producto.nombre + '"? Esta acción no se puede deshacer.');
    if (!confirmado) return;

    const codigoAEliminar = claveProductoActual;

    fetch(URL_APPS_SCRIPT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ tipo: "eliminar_producto", codigo: codigoAEliminar, clave: CLAVE_SECRETA })
    }).then(function () {
      delete codigosActivos[codigoAEliminar];
      mostrarResultadoVacio();
      input.value = "";
      input.focus();
    }).catch(function () {
      alert("No se pudo eliminar (revisa tu conexión a internet).");
    });
  });
})();