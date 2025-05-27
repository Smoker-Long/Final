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
const dbRef = database.ref('esp32/status');   // Đường dẫn để đọc trạng thái từ ESP32
const cmdRef = database.ref('esp32/status');  // Đường dẫn để gửi lệnh đến ESP32

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
    if (!isBLEConnected) {
        try {
            if (!navigator.bluetooth) {
                throw new Error('Web Bluetooth API is not available in your browser. Please use Chrome, Edge, or Opera.');
            }
            await connectToDevice();
        } catch (error) {
            console.error('Error:', error);
            wifiStatus.textContent = error.message;
        }
    } else {
        if (bluetoothDevice && bluetoothDevice.gatt.connected) {
            bluetoothDevice.gatt.disconnect();
        }
    }
});

// --- Firebase Authentication ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        loginContainer.style.display = 'none';
        controlPanel.style.display = 'block';
        
        // Kiểm tra kết nối khi đăng nhập thành công
        const isConnected = await checkConnectionStatus();
        if (isConnected) {
            startFirebaseListeners();
        }
    } else {
        loginContainer.style.display = 'block';
        controlPanel.style.display = 'none';
        stopFirebaseListeners();
        loginEmail.value = '';
        loginPassword.value = '';
        loginError.textContent = '';
    }
});

// Kiểm tra kết nối định kỳ
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
    if (statusListener) return;

    statusListener = dbRef.on('value', snapshot => {
        const data = snapshot.val();
        if (data) {
            console.log("Received data from Firebase:", data);
            updateUI(data);
        } else {
            console.log("No data received from Firebase");
            currentTemperatureSpan.textContent = '--°C';
            systemStatusSpan.textContent = 'Không có dữ liệu';
            modeStatusSpan.textContent = 'Không có dữ liệu';
            toggleFanBtn.disabled = true;
            toggleRelayBtn.disabled = true;
            toggleSystemBtn.disabled = true;
            toggleModeBtn.disabled = true;
        }
    }, error => {
        console.error("Lỗi đọc Firebase Realtime Database:", error);
    });
}

function stopFirebaseListeners() {
    if (statusListener) {
        dbRef.off('value', statusListener);
        statusListener = null;
        console.log("Đã dừng lắng nghe Firebase stream.");
    }
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
    updateRelayButton(relay1Active);

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
