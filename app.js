// ==========================================
// KONFIGURASI API MYSQL & MQTT MAQIATTO
// ==========================================
const MYSQL_API_URL = "http://iot-smartfan.42web.io/api.php?action=baca_log"; 

const MAQIATTO_USER = "azis.reno8@gmail.com"; 
const MAQIATTO_PASS = "abdullahazis8040"; 
const TOPIK_SENSOR  = "azis.reno8@gmail.com/Sensor";
const TOPIK_KONTROL = "azis.reno8@gmail.com/Kontrol";

// 1. JAM DIGITAL
function updateJam() {
    let elem = document.getElementById("jamDigital");
    if (elem) elem.innerHTML = new Date().toLocaleTimeString('id-ID');
}
updateJam();
setInterval(updateJam, 1000);

// 2. INISIALISASI GRAFIK (CHART.JS)
let grafikW = [], dataS = [], dataK = [], dataU = [];

function buatChart(ctx, dataArr, color, bgColor) {
    let elem = document.getElementById(ctx);
    if (!elem) return null;
    return new Chart(elem.getContext('2d'), { 
        type: 'line', 
        data: { 
            labels: grafikW, 
            datasets: [{ 
                data: dataArr, 
                borderColor: color, 
                backgroundColor: bgColor, 
                fill: true, 
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 0
            }] 
        }, 
        options: { 
            responsive: true,
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
                x: { display: false },
                y: { display: false, min: 0 } 
            } 
        } 
    });
}

let chartS = buatChart('chartSuhu', dataS, '#e11d48', 'rgba(225, 29, 72, 0.15)');
let chartK = buatChart('chartKelembapan', dataK, '#0d9488', 'rgba(13, 148, 136, 0.15)');
let chartU = buatChart('chartUdara', dataU, '#c026d3', 'rgba(192, 38, 211, 0.15)');

// 3. KONEKSI MQTT MAQIATTO VIA WEBSOCKET SSL
const client = mqtt.connect('wss://maqiatto.com:8883/mqtt', { 
    clientId: 'web_raisya_' + Math.random().toString(16).substr(2, 6), 
    username: MAQIATTO_USER, 
    password: MAQIATTO_PASS,
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 30 * 1000
});

client.on('connect', () => {
    let badge = document.getElementById('status-koneksi');
    if (badge) {
        badge.className = "badge bg-success text-white px-3 py-2";
        badge.innerText = "✅ Terhubung ke MQTT";
    }
    client.subscribe(TOPIK_SENSOR);
});

client.on('error', (err) => {
    console.error("MQTT Error: ", err);
});

client.on('message', (topic, message) => {
    if (topic === TOPIK_SENSOR) {
        let d = JSON.parse(message.toString());
        
        if (document.getElementById('suhu_val')) document.getElementById('suhu_val').innerText = d.suhu + "°";
        if (document.getElementById('kelembapan_val')) document.getElementById('kelembapan_val').innerText = d.kelembapan + "%";
        if (document.getElementById('udara_val')) document.getElementById('udara_val').innerText = d.kualitas_udara;
        if (document.getElementById('kipas_val')) document.getElementById('kipas_val').innerText = d.status_kipas;

        grafikW.push(new Date().toLocaleTimeString('id-ID'));
        dataS.push(d.suhu); 
        dataK.push(d.kelembapan); 
        dataU.push(d.kualitas_udara);
        
        if (grafikW.length > 15) { 
            grafikW.shift(); dataS.shift(); dataK.shift(); dataU.shift(); 
        }
        
        if (chartS) chartS.update(); 
        if (chartK) chartK.update(); 
        if (chartU) chartU.update();
    }
});

// 4. KIRIM PERINTAH MANUAL / AUTO
function kirimPerintah() {
    let inputKipas = document.getElementById('input-kipas');
    if (!inputKipas) return;
    
    let cmd = inputKipas.value;
    if (client.connected) {
        client.publish(TOPIK_KONTROL, cmd);
        let notif = document.getElementById('notif-simpan');
        if (notif) {
            notif.innerHTML = `<div class='alert alert-success fw-bold text-center'>✨ Perintah <b>${cmd}</b> berhasil dikirim!</div>`;
            setTimeout(() => notif.innerHTML = '', 3000);
        }
    } else {
        alert("Gagal: MQTT belum terhubung!");
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
                    if (row.status_kipas === 'ON') badge = 'badge-kipas-on';
                    else if (row.status_kipas === 'OFF') badge = 'badge-kipas-off';
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