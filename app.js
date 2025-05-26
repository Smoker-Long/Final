// script.js

// --- Cấu hình Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyAv3UTIlN7DxfA0a6swQU8qN2mDkFuynJ0",
    authDomain: "data-ds18b20-e8360.firebaseapp.com",
    databaseURL: "https://data-ds18b20-e8360-default-rtdb.firebaseio.com",
    projectId: "data-ds18b20-e8360",
    storageBucket: "data-ds18b20-e8360.appspot.com",
    messagingSenderId: "your-messaging-sender-id",
    appId: "your-app-id"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();
const dbRef = database.ref('system_data');   // Đường dẫn để đọc trạng thái từ ESP32
const cmdRef = database.ref('system_data'); // Đường dẫn để gửi lệnh đến ESP32

// --- Lấy các phần tử DOM ---
const loginContainer = document.getElementById('loginContainer');
const controlPanel = document.getElementById('controlPanel');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const wifiConfig = document.getElementById('wifiConfig');
const bleStatus = document.getElementById('bleStatus');
const wifiSSID = document.getElementById('wifiSSID');
const wifiPassword = document.getElementById('wifiPassword');
const connectWifiBtn = document.getElementById('connectWifiBtn');
const wifiError = document.getElementById('wifiError');
const scanButton = document.getElementById('scanButton');

const currentTemperatureSpan = document.getElementById('currentTemperature');
const systemStatusSpan = document.getElementById('systemStatus');
const modeStatusSpan = document.getElementById('modeStatus');

const toggleFanBtn = document.getElementById('toggleFanBtn');
const toggleRelayBtn = document.getElementById('toggleRelayBtn');
const toggleSystemBtn = document.getElementById('toggleSystemBtn');
const toggleModeBtn = document.getElementById('toggleModeBtn');

// --- Biến trạng thái UI ---
let isSystemOn = false;
let isAutoMode = false;
let relay1Active = true;
let fanManuallyOn = false;
let bluetoothDevice = null;
let bluetoothCharacteristic = null;

// --- Bluetooth Configuration ---
const ESP32_SERVICE_UUID = '00001234-0000-1000-8000-00805f9b34fb';
const ESP32_CHARACTERISTIC_UUID = '00005678-0000-1000-8000-00805f9b34fb';

// Hàm kết nối Bluetooth
async function connectToESP32() {
    try {
        if (!navigator.bluetooth) {
            bleStatus.textContent = 'Trình duyệt không hỗ trợ Web Bluetooth';
            return;
        }

        bleStatus.textContent = 'Đang tìm thiết bị ESP32...';
        
        // Tìm thiết bị BLE
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'ESP_WIFI_CONFIG' }],
            optionalServices: [ESP32_SERVICE_UUID]
        });

        bleStatus.textContent = 'Đã tìm thấy ESP32, đang kết nối...';
        
        // Kết nối với thiết bị
        const server = await bluetoothDevice.gatt.connect();
        
        // Lấy service
        const service = await server.getPrimaryService(ESP32_SERVICE_UUID);
        
        // Lấy characteristic
        bluetoothCharacteristic = await service.getCharacteristic(ESP32_CHARACTERISTIC_UUID);
        
        bleStatus.textContent = 'Đã kết nối với ESP32';
        connectWifiBtn.disabled = false;
        
        // Lắng nghe sự kiện ngắt kết nối
        bluetoothDevice.addEventListener('gattserverdisconnected', () => {
            bleStatus.textContent = 'Mất kết nối với ESP32';
            connectWifiBtn.disabled = true;
            bluetoothDevice = null;
            bluetoothCharacteristic = null;
        });
    } catch (error) {
        bleStatus.textContent = 'Lỗi kết nối: ' + error.message;
        console.error('Bluetooth error:', error);
    }
}

// Hàm gửi thông tin WiFi qua Bluetooth
async function sendWiFiCredentials() {
    if (!bluetoothCharacteristic) {
        wifiError.textContent = 'Chưa kết nối với ESP32';
        return;
    }

    const ssid = wifiSSID.value;
    const password = wifiPassword.value;

    if (!ssid || !password) {
        wifiError.textContent = 'Vui lòng nhập đầy đủ thông tin WiFi';
        return;
    }

    try {
        const wifiData = `${ssid}:${password}`;
        const encoder = new TextEncoder();
        await bluetoothCharacteristic.writeValue(encoder.encode(wifiData));
        
        wifiError.textContent = '';
        bleStatus.textContent = 'Đã gửi thông tin WiFi, đang chờ ESP32 kết nối...';
        
        // Ẩn phần cấu hình WiFi sau khi gửi thành công
        setTimeout(() => {
            wifiConfig.style.display = 'none';
        }, 3000);
    } catch (error) {
        wifiError.textContent = 'Lỗi gửi thông tin WiFi: ' + error.message;
        console.error('Send WiFi error:', error);
    }
}

// --- Firebase Authentication ---
auth.onAuthStateChanged(user => {
    if (user) {
        loginContainer.style.display = 'none';
        controlPanel.style.display = 'block';
        startFirebaseListeners();
    } else {
        loginContainer.style.display = 'block';
        controlPanel.style.display = 'none';
        stopFirebaseListeners();
        loginEmail.value = '';
        loginPassword.value = '';
        loginError.textContent = '';
        
        // Hiển thị phần cấu hình WiFi khi chưa đăng nhập
        wifiConfig.style.display = 'block';
    }
});

// Xử lý sự kiện nhấn nút Đăng nhập
loginBtn.addEventListener('click', async () => {
    const email = loginEmail.value;
    const password = loginPassword.value;

    if (!email || !password) {
        loginError.textContent = 'Vui lòng nhập email và mật khẩu.';
        return;
    }

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        loginContainer.style.display = 'none';
        controlPanel.style.display = 'block';
        wifiConfig.style.display = 'block';
        
        // Chỉ khởi tạo BLE sau khi đăng nhập thành công
        if (navigator.bluetooth) {
            bleStatus.textContent = 'Nhấn nút "Tìm thiết bị ESP32" để kết nối';
        } else {
            bleStatus.textContent = 'Trình duyệt không hỗ trợ Web Bluetooth';
        }
    } catch (error) {
        loginError.textContent = error.message;
    }
});

// Xử lý sự kiện nhấn nút Đăng xuất
logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        loginContainer.style.display = 'block';
        controlPanel.style.display = 'none';
        wifiConfig.style.display = 'none';
        if (bluetoothDevice) {
            bluetoothDevice.gatt.disconnect();
        }
    });
});

// --- Lắng nghe dữ liệu từ Firebase Realtime Database ---
let statusListener = null;

// Hàm để bắt đầu lắng nghe Firebase Realtime Database
function startFirebaseListeners() {
    // Đảm bảo chỉ tạo một listener duy nhất
    if (statusListener) return;

    statusListener = dbRef.on('value', snapshot => {
        const data = snapshot.val();
        if (data) {
            // Cập nhật UI với dữ liệu từ Firebase
            updateUI({
                temperature: data.temperature,
                on: !data.systemLocked,
                isAutoMode: !data.manualMode,
                fanManual: data.fanState,
                relay1Active: data.heater1State
            });
        }
    });
}

// Hàm để dừng lắng nghe Firebase Realtime Database
function stopFirebaseListeners() {
    if (statusListener) {
        dbRef.off('value', statusListener);
        statusListener = null;
        console.log("Đã dừng lắng nghe Firebase stream.");
    }
}

// --- Cập nhật giao diện người dùng (UI) dựa trên dữ liệu Firebase ---
function updateUI(data) {
    // Đảm bảo các nút được kích hoạt trước khi cập nhật trạng thái disabled dựa trên logic
    toggleSystemBtn.disabled = false;
    toggleModeBtn.disabled = false;

    // Cập nhật nhiệt độ
    if (data.temperature !== undefined) {
        currentTemperatureSpan.textContent = `${data.temperature}°C`;
    }

    // Cập nhật trạng thái hệ thống
    isSystemOn = data.on;
    updateSystemButton(isSystemOn);

    // Cập nhật chế độ
    isAutoMode = data.isAutoMode;
    updateModeButton(isAutoMode);

    // Cập nhật trạng thái Fan
    fanManuallyOn = data.fanManual;
    updateFanButton(fanManuallyOn);

    // Cập nhật trạng thái Sưởi
    relay1Active = data.relay1Active;
    updateRelayButton(relay1Active);

    // Cập nhật trạng thái disabled của các nút
    updateButtonStates();
}

// Cập nhật giao diện nút Fan
function updateFanButton(isOn) {
    if (isOn) {
        toggleFanBtn.classList.remove('off');
        toggleFanBtn.classList.add('on');
        toggleFanBtn.querySelector('.button-state').textContent = 'ON';
    } else {
        toggleFanBtn.classList.remove('on');
        toggleFanBtn.classList.add('off');
        toggleFanBtn.querySelector('.button-state').textContent = 'OFF';
    }
}

// Cập nhật giao diện nút Sưởi
function updateRelayButton(isRelay1Active) {
    if (isRelay1Active) {
        toggleRelayBtn.classList.remove('relay2');
        toggleRelayBtn.classList.add('relay1');
        toggleRelayBtn.querySelector('.button-state').textContent = 'Sưởi 1';
    } else {
        toggleRelayBtn.classList.remove('relay1');
        toggleRelayBtn.classList.add('relay2');
        toggleRelayBtn.querySelector('.button-state').textContent = 'Sưởi 2';
    }
}

// Cập nhật giao diện nút Chế độ (Auto/Manual)
function updateModeButton(isAuto) {
    if (isAuto) {
        toggleModeBtn.classList.remove('mode-manual');
        toggleModeBtn.classList.add('mode-auto');
        toggleModeBtn.querySelector('.button-state').textContent = 'Auto';
        modeStatusSpan.textContent = 'Tự động';
    } else {
        toggleModeBtn.classList.remove('mode-auto');
        toggleModeBtn.classList.add('mode-manual');
        toggleModeBtn.querySelector('.button-state').textContent = 'Manual';
        modeStatusSpan.textContent = 'Thủ công';
    }
}

// Cập nhật giao diện nút Hệ thống ON/OFF
function updateSystemButton(isSystemOn) {
    if (isSystemOn) {
        toggleSystemBtn.classList.remove('system-off');
        toggleSystemBtn.classList.add('system-on');
        toggleSystemBtn.querySelector('.button-state').textContent = 'ON';
        systemStatusSpan.textContent = 'Đang hoạt động';
    } else {
        toggleSystemBtn.classList.remove('system-on');
        toggleSystemBtn.classList.add('system-off');
        toggleSystemBtn.querySelector('.button-state').textContent = 'OFF';
        systemStatusSpan.textContent = 'Đã tắt';
    }
}

// Cập nhật trạng thái disabled của các nút điều khiển
function updateButtonStates() {
    if (isAutoMode || !isSystemOn) {
        toggleFanBtn.disabled = true;
        toggleRelayBtn.disabled = true;
    } else {
        toggleFanBtn.disabled = false;
        toggleRelayBtn.disabled = false;
    }
}

// --- Event Listeners ---
scanButton.addEventListener('click', async () => {
    try {
        await connectToESP32();
    } catch (error) {
        bleStatus.textContent = 'Lỗi: ' + error.message;
    }
});

connectWifiBtn.addEventListener('click', async () => {
    if (!bluetoothCharacteristic) {
        wifiError.textContent = 'Chưa kết nối với ESP32';
        return;
    }

    const ssid = wifiSSID.value;
    const password = wifiPassword.value;

    if (!ssid || !password) {
        wifiError.textContent = 'Vui lòng nhập đầy đủ thông tin WiFi';
        return;
    }

    try {
        const wifiData = `${ssid}:${password}`;
        const encoder = new TextEncoder();
        await bluetoothCharacteristic.writeValue(encoder.encode(wifiData));
        
        wifiError.textContent = '';
        bleStatus.textContent = 'Đã gửi thông tin WiFi, đang chờ ESP32 kết nối...';
        
        // Ẩn phần cấu hình WiFi sau khi gửi thành công
        setTimeout(() => {
            wifiConfig.style.display = 'none';
        }, 3000);
    } catch (error) {
        wifiError.textContent = 'Lỗi gửi thông tin WiFi: ' + error.message;
        console.error('Send WiFi error:', error);
    }
});

// Nút Fan
toggleFanBtn.addEventListener('click', () => {
    if (!toggleFanBtn.disabled) {
        fanManuallyOn = !fanManuallyOn;
        cmdRef.update({ fanState: fanManuallyOn })
            .catch(error => console.error("Lỗi cập nhật Fan:", error));
    }
});

// Nút Sưởi
toggleRelayBtn.addEventListener('click', () => {
    if (!toggleRelayBtn.disabled) {
        relay1Active = !relay1Active;
        cmdRef.update({ 
            heater1State: relay1Active,
            heater2State: !relay1Active
        }).catch(error => console.error("Lỗi cập nhật Sưởi:", error));
    }
});

// Nút Hệ thống
toggleSystemBtn.addEventListener('click', () => {
    isSystemOn = !isSystemOn;
    cmdRef.update({ systemLocked: !isSystemOn })
        .catch(error => console.error("Lỗi cập nhật Hệ thống:", error));
});

// Nút Chế độ
toggleModeBtn.addEventListener('click', () => {
    isAutoMode = !isAutoMode;
    cmdRef.update({ manualMode: !isAutoMode })
        .catch(error => console.error("Lỗi cập nhật Chế độ:", error));
});

// BLE Functions
async function initializeBLE() {
    try {
        bleStatus.textContent = 'Đang tìm thiết bị ESP32...';
        
        // Tìm thiết bị BLE
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: [ESP32_SERVICE_UUID] }]
        });
        bleStatus.textContent = 'Đã kết nối với ESP32';
        connectWifiBtn.disabled = false;
        
        const server = await bluetoothDevice.gatt.connect();
        const service = await server.getPrimaryService(ESP32_SERVICE_UUID);
        bluetoothCharacteristic = await service.getCharacteristic(ESP32_CHARACTERISTIC_UUID);
        
        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
    } catch (error) {
        bleStatus.textContent = 'Lỗi kết nối: ' + error;
    }
}

function onDisconnected() {
    bleStatus.textContent = 'Mất kết nối với ESP32';
    connectWifiBtn.disabled = true;
}

