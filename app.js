// === CONFIGURA TUS CLAVES DE SUPABASE ===
const SUPABASE_URL = "https://<tu-proyecto>.supabase.co"; // cambia por el URL de tu proyecto
const SUPABASE_ANON_KEY = "<tu-anon-key>"; // cambia por tu anon key

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let chart; // referencia global para Chart.js

// Cargar lista de indicadores en el select
async function cargarIndicadores() {
  const { data, error } = await supabase
    .from("indicadores")
    .select("id, nombre, area_id, areas(nombre)");

  if (error) {
    console.error("Error cargando indicadores:", error);
    return;
  }

  const select = document.getElementById("indicador");
  select.innerHTML = "";
  data.forEach(ind => {
    const opt = document.createElement("option");
    opt.value = ind.id;
    opt.textContent = `${ind.areas.nombre} - ${ind.nombre}`;
    select.appendChild(opt);
  });
}

// Cargar histograma comparando dos años
async function cargarHistograma() {
  const indicadorId = document.getElementById("indicador").value;
  const anioA = parseInt(document.getElementById("anioA").value);
  const anioB = parseInt(document.getElementById("anioB").value);

  const { data, error } = await supabase
    .from("vw_histograma_mensual")
    .select("*")
    .eq("indicador_id", indicadorId)
    .in("anio", [anioA, anioB]);

  if (error) {
    console.error("Error consultando histograma:", error);
    return;
  }

  // Ordenar por mes
  data.sort((a, b) => a.mes - b.mes);

  // Separar por año
  const valoresA = data.filter(d => d.anio === anioA).map(d => d.valor_num);
  const valoresB = data.filter(d => d.anio === anioB).map(d => d.valor_num);

  const ctx = document.getElementById("histograma").getContext("2d");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
      datasets: [
        { label: `Año ${anioA}`, data: valoresA, backgroundColor: "rgba(54,162,235,0.6)" },
        { label: `Año ${anioB}`, data: valoresB, backgroundColor: "rgba(255,99,132,0.6)" }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// Inicializar al cargar la página
window.onload = cargarIndicadores;
