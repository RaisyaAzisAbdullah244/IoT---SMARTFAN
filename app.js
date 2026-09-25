// ==========================================
// KONFIGURASI API MYSQL & BROKER HIVEMQ
// ==========================================
const MYSQL_API_URL = "http://iot-smartfan.42web.io/api.php?action=baca_log"; 

// Topik IoT Smartfan
const TOPIK_SENSOR  = "iot-smartfan/sensor";
const TOPIK_KONTROL = "iot-smartfan/kontrol";

// 1. JAM DIGITAL
function updateJam() {
    let jamNow = new Date().toLocaleTimeString('id-ID');
    let elemDesk = document.getElementById("jamDigital");
    let elemMob  = document.getElementById("jamDigitalMobile");
    
    if (elemDesk) elemDesk.innerHTML = jamNow;
    if (elemMob)  elemMob.innerHTML  = jamNow;
}
updateJam();
setInterval(updateJam, 1000);

// 2. INISIALISASI GRAFIK (CHART.JS) DENGAN TAMPILAN TANGGAL & WAKTU SENSOR
let grafikW = [], dataS = [], dataK = [], dataU = [];

function buatChart(ctx, dataArr, labelNama, color, bgColor) {
    let elem = document.getElementById(ctx);
    if (!elem) return null;
    return new Chart(elem.getContext('2d'), { 
        type: 'line', 
        data: { 
            labels: grafikW, 
            datasets: [{ 
                label: labelNama,
                data: dataArr, 
                borderColor: color, 
                backgroundColor: bgColor, 
                fill: true, 
                tension: 0.3,
                borderWidth: 3,
                pointRadius: 5,            // Menampilkan titik agar mudah diklik
                pointHoverRadius: 8,       // Membesar saat ditekan/di-hover
                pointBackgroundColor: color
            }] 
        }, 
        options: { 
            responsive: true,
            maintainAspectRatio: false, 
            interaction: {
                mode: 'nearest',
                intersect: false,
            },
            plugins: { 
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        title: function(tooltipItems) {
                            // Menampilkan Tanggal dan Waktu Data Diterima dari ESP
                            return '🕒 Waktu: ' + tooltipItems[0].label;
                        },
                        label: function(tooltipItem) {
                            return ` ${tooltipItem.dataset.label}: ${tooltipItem.raw}`;
                        }
                    }
                }
            }, 
            scales: { 
                x: { display: false },
                y: { display: true, beginAtZero: false } 
            } 
        } 
    });
}

let chartS = buatChart('chartSuhu', dataS, 'Suhu (°C)', '#e11d48', 'rgba(225, 29, 72, 0.15)');
let chartK = buatChart('chartKelembapan', dataK, 'Kelembapan (%)', '#0d9488', 'rgba(13, 148, 136, 0.15)');
let chartU = buatChart('chartUdara', dataU, 'Udara (PPM)', '#c026d3', 'rgba(192, 38, 211, 0.15)');

// 3. KONEKSI MQTT HIVEMQ VIA WEBSOCKET SSL (PORT 8884)
const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', { 
    clientId: 'web_raisya_' + Math.random().toString(16).substr(2, 6), 
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 30 * 1000
});

client.on('connect', () => {
    let badge = document.getElementById('status-koneksi');
    if (badge) {
        badge.className = "badge bg-success text-white px-3 py-2";
        badge.innerText = "✅ Terhubung ke HiveMQ";
    }
    client.subscribe(TOPIK_SENSOR);
});

client.on('error', (err) => {
    console.error("MQTT HiveMQ Error: ", err);
    let badge = document.getElementById('status-koneksi');
    if (badge) {
        badge.className = "badge bg-danger text-white px-3 py-2";
        badge.innerText = "❌ Gagal Koneksi HiveMQ";
    }
});

// MENERIMA DATA SENSOR DARI ESP8266 (TIAP 5 MENIT)
client.on('message', (topic, message) => {
    if (topic === TOPIK_SENSOR) {
        let d = JSON.parse(message.toString());
        
        // Update Ringkasan Nilai Kartu
        if (document.getElementById('suhu_val')) document.getElementById('suhu_val').innerText = d.suhu + "°";
        if (document.getElementById('kelembapan_val')) document.getElementById('kelembapan_val').innerText = d.kelembapan + "%";
        if (document.getElementById('udara_val')) document.getElementById('udara_val').innerText = d.kualitas_udara;
        if (document.getElementById('kipas_val')) document.getElementById('kipas_val').innerText = d.status_kipas;

        // Ambil Tanggal dan Jam Lengkap saat data tiba
        let waktuLengkap = new Date().toLocaleString('id-ID', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        grafikW.push(waktuLengkap);
        dataS.push(d.suhu); 
        dataK.push(d.kelembapan); 
        dataU.push(d.kualitas_udara);
        
        // Batasi grafik menyimpan maksimal 20 titik terakhir
        if (grafikW.length > 20) { 
            grafikW.shift(); dataS.shift(); dataK.shift(); dataU.shift(); 
        }
        
        if (chartS) chartS.update(); 
        if (chartK) chartK.update(); 
        if (chartU) chartU.update();
    }
});

// 4. KIRIM PERINTAH KONTROL KIPAS
function kirimPerintah() {
    let inputKipas = document.getElementById('input-kipas');
    if (!inputKipas) return;
    
    let cmd = inputKipas.value;
    if (client.connected) {
        client.publish(TOPIK_KONTROL, cmd);
        let notif = document.getElementById('notif-simpan');
        if (notif) {
            notif.innerHTML = `<div class='alert alert-success fw-bold text-center mt-2'>✨ Perintah <b>${cmd}</b> berhasil dikirim!</div>`;
            setTimeout(() => notif.innerHTML = '', 3000);
        }
    } else {
        alert("Gagal: Belum terhubung ke HiveMQ MQTT!");
    }
}

// 5. FETCH DATA LOG MYSQL DARI INFINITYFREE
let btnDatalog = document.getElementById('btn-tab-datalog');
if (btnDatalog) {
    btnDatalog.addEventListener('click', () => {
        fetch(MYSQL_API_URL)
        .then(res => res.json())
        .then(data => {
            let tbody = document.getElementById('isi-tabel-mysql');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            if (data.length > 0) {
                data.forEach(row => {
                    let badge = '';
                    if (row.status_kipas.includes('ON')) badge = 'badge-kipas-on';
                    else if (row.status_kipas.includes('OFF')) badge = 'badge-kipas-off';
                    else badge = 'bg-secondary text-white rounded-pill px-3 py-1 fw-bold';

                    tbody.innerHTML += `<tr>
                        <td class="text-secondary fw-bold">${row.waktu}</td>
                        <td class="fw-bold text-suhu">${row.suhu}°</td>
                        <td class="fw-bold text-kelembapan">${row.kelembapan}%</td>
                        <td class="fw-bold text-udara">${row.kualitas_udara}</td>
                        <td><span class="${badge}">${row.status_kipas}</span></td>
                    </tr>`;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-muted fw-bold">Belum ada histori data di MySQL.</td></tr>';
            }
        }).catch(err => console.error(err));
    });
}