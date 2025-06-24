// script.js

// --- Cấu hình Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyAv3UTIlN7DxfA0a6swQU8qN2mDkFuynJ0",
    authDomain: "data-ds18b20-e8360.firebaseapp.com",
    databaseURL: "https://data-ds18b20-e8360-default-rtdb.firebaseio.com",
    projectId: "data-ds18b20-e8360"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();
const dbRef = database.ref('esp32/status');   // Đọc trạng thái từ ESP32
const cmdRef = database.ref('esp32/commands');  // Gửi lệnh đến ESP32

// --- Lấy các phần tử DOM ---
const loginContainer = document.getElementById('loginContainer');
const controlPanel = document.getElementById('controlPanel');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const connectWifiBtn = document.getElementById('connectWifiBtn');
const wifiStatus = document.getElementById('wifiStatus');

const currentTemperatureSpan = document.getElementById('currentTemperature');
const systemStatusSpan = document.getElementById('systemStatus');
const modeStatusSpan = document.getElementById('modeStatus');

const toggleFanBtn = document.getElementById('toggleFanBtn');
const toggleRelayBtn = document.getElementById('toggleRelayBtn');
const toggleSystemBtn = document.getElementById('toggleSystemBtn');
const toggleModeBtn = document.getElementById('toggleModeBtn');

const changeWifiBtn = document.getElementById('changeWifiBtn');

// --- Biến trạng thái UI ---
let isSystemOn = false;
let isAutoMode = false;
let relay1Active = true;
let fanManuallyOn = false;
let isWifiConnected = false;
let isBLEConnected = false;

// --- BLE Connection Handling ---
let bluetoothDevice = null;
let bluetoothCharacteristic = null;

// Modal WiFi
const wifiModal = document.getElementById('wifiModal');
const closeWifiModal = document.getElementById('closeWifiModal');
const wifiSSIDInput = document.getElementById('wifiSSID');
const wifiPasswordInput = document.getElementById('wifiPassword');
const sendWifiBtn = document.getElementById('sendWifiBtn');
const wifiModalStatus = document.getElementById('wifiModalStatus');

// Kiểm tra kết nối Firebase
function checkFirebaseConnection() {
    return new Promise((resolve) => {
        const connectedRef = database.ref(".info/connected");
        connectedRef.on("value", (snap) => {
            if (snap.val() === true) {
                console.log("Firebase connected");
                resolve(true);
            } else {
                console.log("Firebase disconnected");
                resolve(false);
            }
        });
    });
}

// Kiểm tra trạng thái kết nối
async function checkConnectionStatus() {
    try {
        const isConnected = await checkFirebaseConnection();
        if (isConnected) {
            // Firebase đã kết nối, không cần BLE
            isWifiConnected = true;
            isBLEConnected = false;
            connectWifiBtn.style.display = 'none'; // Ẩn nút Connect WiFi
            wifiStatus.textContent = 'WiFi Connected';
            return true;
        } else {
            // Firebase không kết nối, hiển thị nút Connect WiFi
            isWifiConnected = false;
            isBLEConnected = false;
            connectWifiBtn.style.display = 'block';
            wifiStatus.textContent = 'WiFi Disconnected';
            return false;
        }
    } catch (error) {
        console.error('Error checking connection:', error);
        return false;
    }
}

async function connectToDevice() {
    try {
        // Request Bluetooth device with the specific service UUID
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [
                {
                    namePrefix: 'ESP_WIFI_CONFIG'
                }
            ],
            optionalServices: ['00001234-0000-1000-8000-00805f9b34fb']
        });

        console.log('Device selected:', bluetoothDevice.name);
        wifiStatus.textContent = 'Connecting to ' + bluetoothDevice.name + '...';

        // Connect to the device
        const server = await bluetoothDevice.gatt.connect();
        console.log('Connected to GATT server');
        
        // Get the service
        const service = await server.getPrimaryService('00001234-0000-1000-8000-00805f9b34fb');
        console.log('Service found');
        
        // Get the characteristic
        bluetoothCharacteristic = await service.getCharacteristic('00005678-0000-1000-8000-00805f9b34fb');
        console.log('Characteristic found');

        // Update UI
        isBLEConnected = true;
        connectWifiBtn.classList.add('connected');
        connectWifiBtn.querySelector('.button-state').textContent = 'Connected';
        wifiStatus.textContent = 'Connected to: ' + bluetoothDevice.name;

        // Listen for disconnection
        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

    } catch (error) {
        console.error('Error connecting to device:', error);
        if (error.name === 'NotFoundError') {
            wifiStatus.textContent = 'No device selected. Please try again.';
        } else if (error.name === 'NetworkError') {
            wifiStatus.textContent = 'Connection failed. Device may be out of range.';
        } else {
            wifiStatus.textContent = 'Connection failed: ' + error.message;
        }
        // Reset connection state
        isBLEConnected = false;
        connectWifiBtn.classList.remove('connected');
        connectWifiBtn.querySelector('.button-state').textContent = 'Disconnected';
        bluetoothDevice = null;
        bluetoothCharacteristic = null;
    }
}

function onDisconnected() {
    console.log('Device disconnected');
    isBLEConnected = false;
    connectWifiBtn.classList.remove('connected');
    connectWifiBtn.querySelector('.button-state').textContent = 'Disconnected';
    wifiStatus.textContent = 'Device disconnected';
    bluetoothDevice = null;
    bluetoothCharacteristic = null;
    
    // Kiểm tra lại kết nối Firebase
    checkConnectionStatus();
}

// Add click handler for WiFi connection button
connectWifiBtn.addEventListener('click', async () => {
    if (!isBLEConnected && !isWifiConnected) {
        wifiModal.style.display = 'block';
        wifiModalStatus.textContent = '';
        wifiSSIDInput.value = '';
        wifiPasswordInput.value = '';
    } else if (isBLEConnected) {
        if (bluetoothDevice && bluetoothDevice.gatt.connected) {
            bluetoothDevice.gatt.disconnect();
        }
    }
});

closeWifiModal.onclick = function() {
    wifiModal.style.display = 'none';
};
window.onclick = function(event) {
    if (event.target == wifiModal) wifiModal.style.display = 'none';
};

sendWifiBtn.addEventListener('click', async () => {
    const ssid = wifiSSIDInput.value.trim();
    const password = wifiPasswordInput.value.trim();
    if (!ssid || !password) {
        wifiModalStatus.textContent = 'Vui lòng nhập đầy đủ tên WiFi và mật khẩu!';
        return;
    }
    wifiModalStatus.textContent = 'Đang gửi thông tin WiFi...';
    try {
        if (!navigator.bluetooth) throw new Error('Web Bluetooth API is not available.');
        // Bắt đầu kết nối BLE
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'ESP_WIFI_CONFIG' }],
            optionalServices: ['00001234-0000-1000-8000-00805f9b34fb']
        });
        const server = await bluetoothDevice.gatt.connect();
        const service = await server.getPrimaryService('00001234-0000-1000-8000-00805f9b34fb');
        bluetoothCharacteristic = await service.getCharacteristic('00005678-0000-1000-8000-00805f9b34fb');
        // Gửi chuỗi SSID:password
        const wifiString = `${ssid}:${password}`;
        await bluetoothCharacteristic.writeValue(new TextEncoder().encode(wifiString));
        wifiModalStatus.textContent = 'Đã gửi thông tin WiFi, chờ ESP32 kết nối...';
        // Lưu trạng thái đã cấu hình WiFi
        localStorage.setItem('wifiConfigured', 'true');
        // Theo dõi trạng thái Firebase
        let checkCount = 0;
        const checkInterval = setInterval(async () => {
            const isConnected = await checkConnectionStatus();
            if (isConnected) {
                wifiModalStatus.textContent = 'Kết nối WiFi thành công!';
                setTimeout(() => { wifiModal.style.display = 'none'; }, 1000);
                clearInterval(checkInterval);
            } else if (++checkCount > 15) {
                wifiModalStatus.textContent = 'Kết nối thất bại. Vui lòng kiểm tra lại.';
                clearInterval(checkInterval);
            }
        }, 2000);
    } catch (error) {
        wifiModalStatus.textContent = 'Lỗi: ' + error.message;
    }
});

// Khi tải lại trang, nếu đã cấu hình WiFi thì ẩn nút Connect WiFi
window.addEventListener('DOMContentLoaded', async () => {
    if (localStorage.getItem('wifiConfigured') === 'true') {
        await checkConnectionStatus();
        if (isWifiConnected) {
            connectWifiBtn.style.display = 'none';
            wifiStatus.textContent = 'WiFi Connected';
        } else {
            localStorage.removeItem('wifiConfigured');
            connectWifiBtn.style.display = 'block';
        }
    }
});

// --- Firebase Authentication ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log('User logged in:', user.uid);
        loginContainer.style.display = 'none';
        controlPanel.style.display = 'block';
        
        // Start Firebase listeners immediately if not already started
        startFirebaseListeners();
        
        // Check and update connection status display
        await checkConnectionStatus();

    } else {
        console.log('User logged out');
        loginContainer.style.display = 'block';
        controlPanel.style.display = 'none';
        stopFirebaseListeners();
        loginEmail.value = '';
        loginPassword.value = '';
        loginError.textContent = '';
        
        // Update UI to show disconnected state
        currentTemperatureSpan.textContent = '--°C';
        systemStatusSpan.textContent = 'Đăng xuất';
        modeStatusSpan.textContent = 'Đăng xuất';
        toggleFanBtn.disabled = true;
        toggleRelayBtn.disabled = true;
        toggleSystemBtn.disabled = true;
        toggleModeBtn.disabled = true;
        wifiStatus.textContent = 'Disconnected';
        connectWifiBtn.style.display = 'block'; // Show Connect WiFi button
    }
});

// Kiểm tra kết nối định kỳ - Keep this for ongoing monitoring
setInterval(async () => {
    if (auth.currentUser) {
        await checkConnectionStatus();
    }
}, 5000); // Kiểm tra mỗi 5 giây

loginBtn.addEventListener('click', () => {
    const email = loginEmail.value;
    const password = loginPassword.value;

    if (!email || !password) {
        loginError.textContent = 'Vui lòng nhập email và mật khẩu.';
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            loginError.textContent = '';
            console.log('Đăng nhập thành công!');
        })
        .catch(error => {
            loginError.textContent = `Lỗi đăng nhập: ${error.message}`;
            console.error('Lỗi đăng nhập Firebase:', error);
        });
});

logoutBtn.addEventListener('click', () => {
    auth.signOut()
        .then(() => {
            console.log('Đăng xuất thành công');
        })
        .catch(error => {
            console.error('Lỗi đăng xuất Firebase:', error);
        });
});

// --- Firebase Realtime Database Listeners ---
let statusListener = null;

function startFirebaseListeners() {
    if (statusListener) {
        console.log("Firebase listeners already started.");
        return;
    }
    console.log("Starting Firebase listeners...");

    // Listener for esp32/status changes
    statusListener = dbRef.on('value', snapshot => {
        const data = snapshot.val();
        if (data) {
            console.log("Received data from Firebase:", data);
            updateUI(data);
        } else {
            console.log("No data received from Firebase at", dbRef.toString());
            // It's possible the node is empty temporarily or deleted
            // You might want to reset UI elements here if data is expected to be always present
        }
    }, error => {
        console.error("Lỗi đọc Firebase Realtime Database tại /esp32/status:", error);
        // Depending on the error, you might want to stop listeners or try reconnecting
    });
    
    // Listener for .info/connected
    const connectedRef = database.ref(".info/connected");
    connectedRef.on("value", (snap) => {
        if (snap.val() === true) {
            console.log("Firebase .info/connected: CONNECTED");
            isWifiConnected = true;
            isBLEConnected = false; // Assuming WiFi connection means no BLE needed for config
            wifiStatus.textContent = 'WiFi Connected';
             connectWifiBtn.style.display = 'none'; // Hide Connect WiFi button when connected via Firebase
        } else {
            console.log("Firebase .info/connected: DISCONNECTED");
            isWifiConnected = false;
             wifiStatus.textContent = 'WiFi Disconnected';
             // Only show Connect WiFi if not trying BLE already
             if (!isBLEConnected) {
               connectWifiBtn.style.display = 'block';
             }
        }
    });
}

function stopFirebaseListeners() {
    if (statusListener) {
        dbRef.off('value', statusListener);
        statusListener = null;
        console.log("Đã dừng lắng nghe Firebase stream trên /esp32/status.");
    }
     // Also stop the .info/connected listener when logging out
    const connectedRef = database.ref(".info/connected");
    connectedRef.off('value');
    console.log("Đã dừng lắng nghe Firebase stream trên .info/connected.");
}

// --- UI Update Functions ---
function updateUI(data) {
    console.log("Updating UI with data:", data);
    toggleSystemBtn.disabled = false;
    toggleModeBtn.disabled = false;

    if (data.temperature !== -127.0 && data.temperature !== null) {
        currentTemperatureSpan.textContent = `${data.temperature.toFixed(2)}°C`;
    } else {
        currentTemperatureSpan.textContent = 'Đang đọc...';
    }

    isSystemOn = data.systemLocked === false;
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

    isAutoMode = !data.manualMode;
    updateModeButton(isAutoMode);

    fanManuallyOn = data.fanState;
    updateFanButton(fanManuallyOn);
    
    relay1Active = data.heater1State;
    const heater2State = data.heater2State;
    updateRelayButton(relay1Active, heater2State);

    if (isAutoMode || !isSystemOn) {
        toggleFanBtn.disabled = true;
        toggleRelayBtn.disabled = true;
    } else {
        toggleFanBtn.disabled = false;
        toggleRelayBtn.disabled = false;
    }
}

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

function updateRelayButton(isRelay1Active, heater2State) {
    if (!isRelay1Active && !heater2State) {
        toggleRelayBtn.classList.remove('relay1', 'relay2');
        toggleRelayBtn.classList.add('off');
        toggleRelayBtn.querySelector('.button-state').textContent = 'OFF';
    } else if (isRelay1Active) {
        toggleRelayBtn.classList.remove('relay2', 'off');
        toggleRelayBtn.classList.add('relay1');
        toggleRelayBtn.querySelector('.button-state').textContent = 'Sưởi 1';
    } else {
        toggleRelayBtn.classList.remove('relay1', 'off');
        toggleRelayBtn.classList.add('relay2');
        toggleRelayBtn.querySelector('.button-state').textContent = 'Sưởi 2';
    }
}

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

// --- Control Button Event Handlers ---
toggleFanBtn.addEventListener('click', () => {
    if (!toggleFanBtn.disabled) {
        fanManuallyOn = !fanManuallyOn;
        cmdRef.update({ fanState: fanManuallyOn })
            .then(() => console.log("Fan state updated successfully"))
            .catch(error => console.error("Lỗi cập nhật trạng thái Fan lên Firebase:", error));
    }
});

toggleRelayBtn.addEventListener('click', () => {
    if (!toggleRelayBtn.disabled) {
        relay1Active = !relay1Active;
        cmdRef.update({ 
            heater1State: relay1Active,
            heater2State: !relay1Active
        })
            .then(() => console.log("Heater state updated successfully"))
            .catch(error => console.error("Lỗi cập nhật trạng thái Relay lên Firebase:", error));
    }
});

toggleSystemBtn.addEventListener('click', () => {
    isSystemOn = !isSystemOn;
    cmdRef.update({ systemLocked: !isSystemOn })
        .then(() => console.log("System state updated successfully"))
        .catch(error => console.error("Lỗi cập nhật trạng thái Hệ thống lên Firebase:", error));
});

toggleModeBtn.addEventListener('click', () => {
    isAutoMode = !isAutoMode;
    cmdRef.update({ manualMode: !isAutoMode })
        .then(() => console.log("Mode updated successfully"))
        .catch(error => console.error("Lỗi cập nhật Chế độ lên Firebase:", error));
});

changeWifiBtn.addEventListener('click', () => {
    wifiModal.style.display = 'block';
    wifiModalStatus.textContent = '';
    wifiSSIDInput.value = '';
    wifiPasswordInput.value = '';
});
