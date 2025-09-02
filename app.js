// ================== Supabase (tus credenciales) ==================
const SUPABASE_URL = "https://kxjldzcaeayguiqkqqyh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4amxkemNhZWF5Z3VpcWtxcXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NTQ5ODksImV4cCI6MjA3MjMzMDk4OX0.7c0s4zFimF4TH5_jyJbeTRUuxhGaSvVsCnamwxuKgbw";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ================== UI refs ==================
const selIndicador = document.getElementById("indicador");
const selAnioA = document.getElementById("anioA");
const selAnioB = document.getElementById("anioB");
const btnComparar = document.getElementById("btnComparar");
const canvas = document.getElementById("histograma");
let chart = null;

// ================== Util ==================
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function ensure12(valuesByMonth) {
  // Asegura 12 valores (1..12); si falta alguno, lo rellena con 0
  const arr = Array(12).fill(0);
  valuesByMonth.forEach(v => { if (v.mes >= 1 && v.mes <= 12) arr[v.mes - 1] = v.valor_num ?? 0; });
  return arr;
}

// ================== Cargar indicadores ==================
async function cargarIndicadores() {
  // Trae indicadores con su área (para mostrar "Área - Indicador")
  const { data, error } = await supabase
    .from("indicadores")
    .select("id, nombre, area_id, areas(nombre)")
    .order("area_id", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    console.error("Error cargando indicadores:", error);
    alert("No fue posible cargar los indicadores. Revisa la consola.");
    return;
  }

  selIndicador.innerHTML = "";
  data.forEach(ind => {
    const opt = document.createElement("option");
    opt.value = ind.id;
    opt.textContent = `${ind.areas?.nombre ?? "Área"} — ${ind.nombre}`;
    selIndicador.appendChild(opt);
  });
}

// ================== Consultar vista y graficar ==================
async function cargarHistograma() {
  const indicadorId = parseInt(selIndicador.value, 10);
  const anioA = parseInt(selAnioA.value, 10);
  const anioB = parseInt(selAnioB.value, 10);

  if (!indicadorId || !anioA || !anioB) {
    alert("Selecciona indicador y ambos años.");
    return;
  }

  const { data, error } = await supabase
    .from("vw_histograma_mensual")
    .select("anio, mes, valor_num")
    .eq("indicador_id", indicadorId)
    .in("anio", [anioA, anioB]);

  if (error) {
    console.error("Error consultando histograma:", error);
    alert("No fue posible obtener datos. Revisa la consola.");
    return;
  }

  // Separa por año y ordena por mes
  const a = data.filter(d => d.anio === anioA).sort((x,y) => x.mes - y.mes);
  const b = data.filter(d => d.anio === anioB).sort((x,y) => x.mes - y.mes);

  const valoresA = ensure12(a);
  const valoresB = ensure12(b);

  // Dibuja la gráfica
  const ctx = canvas.getContext("2d");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: MESES,
      datasets: [
        { label: `Año ${anioA}`, data: valoresA, backgroundColor: "rgba(54,162,235,0.6)" },
        { label: `Año ${anioB}`, data: valoresB, backgroundColor: "rgba(255,99,132,0.6)" }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}

// ================== Eventos ==================
btnComparar.addEventListener("click", cargarHistograma);
window.addEventListener("load", cargarIndicadores);
