
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/Uv2MbPsJG/";

let modeloIA = null;
let cargaModelo = null;
let urlImagenActual = null;
let numeroAnalisis = 0;

const entrada = document.getElementById("imagenInput");
const vista = document.getElementById("imagenSeleccionada");
const mensajeImagen = document.getElementById("mensajeImagen");
const estado = document.getElementById("estado");
const resultado = document.getElementById("resultado");
const predicciones = document.getElementById("predicciones");

// Registrar la PWA.
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .catch(error => {
                console.error("Error al registrar la PWA:", error);
            });
    });
}

// Inicializar el clasificador solamente en modelo.html.
if (entrada && vista && estado && resultado && predicciones) {
    entrada.addEventListener("change", analizarImagen);
    prepararModelo();
}

// Cargar el modelo entrenado.
async function cargarModelo() {
    if (modeloIA) return modeloIA;
    if (cargaModelo) return cargaModelo;

    cargaModelo = (async () => {
        if (!window.tmImage) {
            throw new Error(
                "No se cargó la biblioteca de Teachable Machine."
            );
        }

        const urlModelo = MODEL_URL + "model.json";
        const urlMetadata = MODEL_URL + "metadata.json";

        const modelo = await window.tmImage.load(
            urlModelo,
            urlMetadata
        );

        if (modelo.getTotalClasses() < 2) {
            throw new Error(
                "El modelo no contiene las dos categorías esperadas."
            );
        }

        modeloIA = modelo;
        console.log(
            "Categorías del modelo:",
            modelo.getClassLabels()
        );

        return modeloIA;
    })();

    try {
        return await cargaModelo;
    } catch (error) {
        modeloIA = null;
        throw error;
    } finally {
        cargaModelo = null;
    }
}

async function prepararModelo() {
    estado.textContent =
        "Conectando con tu modelo de Inteligencia Artificial...";

    try {
        const modelo = await cargarModelo();

        estado.textContent =
            `Modelo listo. Categorías detectadas: ${modelo.getTotalClasses()}. Selecciona una foto.`;
    } catch (error) {
        console.error(error);

        estado.textContent =
            "No se pudo cargar el modelo. Revisa tu conexión a Internet e inténtalo de nuevo.";
    }
}

// Normalizar los nombres para reconocer acentos y mayúsculas.
function normalizar(texto) {
    return String(texto)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// Reconocer las categorías por sus nombres.
function identificarCategoria(nombre) {
    const etiqueta = normalizar(nombre);

    const esNoMia =
        etiqueta.includes("no mia") ||
        etiqueta.includes("no soy yo") ||
        etiqueta.includes("otra persona") ||
        etiqueta.includes("ajena") ||
        etiqueta.includes("no pertenezco");

    if (esNoMia) {
        return "no-mia";
    }

    const esMia =
        etiqueta.includes("mia") ||
        etiqueta === "yo" ||
        etiqueta.includes("soy yo") ||
        etiqueta.includes("mi foto") ||
        etiqueta.includes("foto propia");

    if (esMia) {
        return "mia";
    }

    return "desconocida";
}

// Seleccionar y analizar la fotografía.
async function analizarImagen(evento) {
    const archivo = evento.target.files[0];

    if (!archivo) return;

    const miAnalisis = ++numeroAnalisis;

    if (!archivo.type.startsWith("image/")) {
        estado.textContent =
            "Selecciona un archivo de imagen válido.";
        entrada.value = "";
        return;
    }

    if (urlImagenActual) {
        URL.revokeObjectURL(urlImagenActual);
    }

    urlImagenActual = URL.createObjectURL(archivo);

    resultado.textContent = "";
    predicciones.replaceChildren();
    estado.textContent = "Preparando la fotografía...";

    vista.onload = async () => {
        if (miAnalisis !== numeroAnalisis) return;

        try {
            estado.textContent =
                "Analizando la imagen con el modelo entrenado...";

            const modelo = await cargarModelo();

            if (miAnalisis !== numeroAnalisis) return;

            // Predicciones reales del modelo, no porcentajes de ejemplo.
            const resultados = await modelo.predict(vista);

            if (miAnalisis !== numeroAnalisis) return;

            mostrarResultados(resultados);

            estado.textContent = "Análisis terminado.";
        } catch (error) {
            console.error("Error al analizar la foto:", error);

            estado.textContent =
                "No se pudo analizar la fotografía. Revisa tu conexión e inténtalo otra vez.";
        }
    };

    vista.onerror = () => {
        if (miAnalisis !== numeroAnalisis) return;

        estado.textContent =
            "No se pudo abrir la fotografía seleccionada.";
    };

    mensajeImagen.hidden = true;
    vista.hidden = false;
    vista.src = urlImagenActual;
}

// Mostrar todos los porcentajes devueltos por el modelo.
function mostrarResultados(resultados) {
    predicciones.replaceChildren();

    if (!Array.isArray(resultados) || resultados.length === 0) {
        resultado.textContent =
            "El modelo no devolvió resultados.";
        return;
    }

    const validos = resultados.filter(item =>
        Number.isFinite(item.probability)
    );

    if (validos.length === 0) {
        resultado.textContent =
            "No se recibieron porcentajes válidos.";
        return;
    }

    const mejor = validos.reduce((anterior, actual) =>
        actual.probability > anterior.probability
            ? actual
            : anterior
    );

    const porcentajeMayor = mejor.probability * 100;
    const categoria = identificarCategoria(mejor.className);

    if (categoria === "mia") {
        resultado.textContent =
            `Resultado: el modelo clasifica la foto como “Fotos mías” con ${porcentajeMayor.toFixed(2)}% de confianza.`;
    } else if (categoria === "no-mia") {
        resultado.textContent =
            `Resultado: el modelo clasifica la foto como “Fotos que no son mías” con ${porcentajeMayor.toFixed(2)}% de confianza.`;
    } else {
        resultado.textContent =
            `La categoría más probable es “${mejor.className}”, con ${porcentajeMayor.toFixed(2)}%. Revisa el nombre de las clases de tu modelo para mostrar la interpretación correcta.`;
    }

    const titulo = document.createElement("h3");
    titulo.textContent = "Porcentajes calculados por el modelo";
    predicciones.appendChild(titulo);

    validos.forEach(item => {
        const porcentaje = item.probability * 100;

        const fila = document.createElement("div");
        fila.className = "prediccion";

        const encabezado = document.createElement("div");
        encabezado.className = "prediccion-titulo";

        const nombre = document.createElement("strong");
        nombre.textContent = item.className;

        const valor = document.createElement("span");
        valor.textContent = `${porcentaje.toFixed(2)}%`;

        encabezado.append(nombre, valor);

        const fondo = document.createElement("div");
        fondo.className = "barra-fondo";

        const barra = document.createElement("div");
        barra.className = "barra-valor";
        barra.style.width =
            `${Math.max(0, Math.min(100, porcentaje))}%`;

        fondo.appendChild(barra);
        fila.append(encabezado, fondo);
        predicciones.appendChild(fila);
    });
}
