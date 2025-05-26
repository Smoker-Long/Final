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
const bleStatus = document.getElementById('wifiStatus'); // Renamed from wifiStatus
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

// --- Bluetooth Variables ---
let bluetoothDevice = null;
let bluetoothCharacteristic = null;

// --- Bluetooth Configuration (Update if needed) ---
const ESP32_SERVICE_UUID = '00001234-0000-1000-8000-00805f9b34fb'; // Make sure this matches ESP32
const ESP32_CHARACTERISTIC_UUID = '00005678-0000-1000-8000-00805f9b34fb'; // Make sure this matches ESP32

// Hàm kiểm tra hỗ trợ Bluetooth
function checkBluetoothSupport() {
    if (!navigator.bluetooth) {
        bleStatus.textContent = 'Trình duyệt không hỗ trợ Web Bluetooth. Vui lòng sử dụng Chrome hoặc Edge.';
        scanButton.disabled = true;
        return false;
    }
    return true;
}

// Hàm kết nối Bluetooth
async function connectToESP32() {
    try {
        if (!checkBluetoothSupport()) {
            return;
        }

        bleStatus.textContent = 'Đang tìm thiết bị ESP32...';
        
        // Tìm thiết bị BLE
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: [ESP32_SERVICE_UUID] }] // Filter by service UUID
        });

        bleStatus.textContent = 'Đã tìm thấy ESP32, đang kết nối...';
        
        // Kết nối với thiết bị GATT
        const server = await bluetoothDevice.gatt.connect();
        
        // Lấy service chính
        const service = await server.getPrimaryService(ESP32_SERVICE_UUID);
        
        // Lấy characteristic cho việc ghi (Write)
        bluetoothCharacteristic = await service.getCharacteristic(ESP32_CHARACTERISTIC_UUID);
        
        bleStatus.textContent = 'Đã kết nối với ESP32';
        connectWifiBtn.disabled = false;
        scanButton.style.display = 'none'; // Hide scan button after connecting
        
        // Lắng nghe sự kiện ngắt kết nối
        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
    } catch (error) {
        // Improve error reporting
         if (error.name === 'NotFoundError') {
            bleStatus.textContent = 'Không tìm thấy thiết bị ESP32. Vui lòng đảm bảo thiết bị đang bật và trong phạm vi quảng cáo BLE.';
        } else if (error.name === 'SecurityError') {
            bleStatus.textContent = 'Lỗi bảo mật: Vui lòng đảm bảo bạn đang sử dụng HTTPS/localhost và cho phép trình duyệt sử dụng Bluetooth.';
        } else if (error.name === 'NetworkError') {
            bleStatus.textContent = 'Lỗi mạng khi kết nối Bluetooth. Vui lòng thử lại.';
        } else if (error.message.includes("User cancelled")){
             bleStatus.textContent = 'Tìm kiếm bị hủy bởi người dùng.';
        }
         else {
            bleStatus.textContent = 'Lỗi kết nối Bluetooth: ' + error.message;
        }
        console.error('Bluetooth connection error:', error);
        scanButton.disabled = false; // Re-enable scan button on failure
    }
}

// Hàm xử lý khi mất kết nối Bluetooth GATT
function onDisconnected() {
    bleStatus.textContent = 'Mất kết nối với ESP32';
    connectWifiBtn.disabled = true;
    bluetoothDevice = null;
    bluetoothCharacteristic = null;
    scanButton.style.display = 'inline-block'; // Show scan button again
    console.log('Bluetooth GATT server disconnected.');
}

// Hàm gửi thông tin WiFi qua BLE
async function sendWiFiCredentials() {
    const ssid = wifiSSID.value;
    const password = wifiPassword.value;

    if (!ssid || !password) {
        wifiError.textContent = 'Vui lòng nhập đầy đủ thông tin WiFi';
        return;
    }

    try {
        if (!bluetoothCharacteristic || !bluetoothDevice || !bluetoothDevice.gatt.connected) {
            throw new Error('Chưa kết nối với ESP32 qua Bluetooth.');
        }

        // Gửi thông tin WiFi qua BLE Characteristic (format: SSID:password)
        const wifiData = `${ssid}:${password}`;
        const encoder = new TextEncoder(); // Use TextEncoder to convert string to ArrayBuffer
        await bluetoothCharacteristic.writeValue(encoder.encode(wifiData));
        
        wifiError.textContent = ''; // Clear previous errors
        bleStatus.textContent = 'Đã gửi thông tin WiFi. ESP32 đang kết nối...';
        connectWifiBtn.disabled = true; // Disable button after sending

        // Optional: Hide the WiFi config section after successful send
        // setTimeout(() => {
        //     wifiConfig.style.display = 'none';
        // }, 5000); // Hide after 5 seconds

    } catch (error) {
        wifiError.textContent = 'Lỗi gửi thông tin WiFi: ' + error.message;
        console.error('Send WiFi error:', error);
         connectWifiBtn.disabled = false; // Re-enable button on failure
    }
}

// --- Firebase Authentication ---
auth.onAuthStateChanged(user => {
    if (user) {
        loginContainer.style.display = 'none';
        controlPanel.style.display = 'block';
        // Show WiFi config section when logged in
        wifiConfig.style.display = 'block';
        // Initialize BLE process when logged in
        // No need to call initializeBLE() here, scanButton click handles it
        startFirebaseListeners();
    } else {
        loginContainer.style.display = 'block';
        controlPanel.style.display = 'none';
        // Hide WiFi config section when logged out
        wifiConfig.style.display = 'none';
         // Disconnect BLE if connected
         if (bluetoothDevice && bluetoothDevice.gatt.connected) {
             bluetoothDevice.gatt.disconnect();
         }
        stopFirebaseListeners();
        loginEmail.value = '';
        loginPassword.value = '';
        loginError.textContent = '';
         // Ensure scan button is visible and enabled when logged out
         scanButton.style.display = 'inline-block';
         scanButton.disabled = false;
         bleStatus.textContent = 'Chưa kết nối Bluetooth.';
         connectWifiBtn.disabled = true;
         wifiError.textContent = '';
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
        // UI state handled by onAuthStateChanged
    } catch (error) {
        loginError.textContent = error.message;
    }
});

// Xử lý sự kiện nhấn nút Đăng xuất
logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        // UI state handled by onAuthStateChanged
    });
});

// --- Lắng nghe dữ liệu từ Firebase Realtime Database ---
let statusListener = null;

// Hàm để bắt đầu lắng nghe Firebase Realtime Database
function startFirebaseListeners() {
    // Đảm bảo chỉ tạo một listener duy nhất và chỉ khi đã kết nối WiFi/Firebase thành công trên ESP32
    // Việc này cần logic kiểm tra trạng thái từ ESP32 gửi lên Firebase (ví dụ: một cờ 'isFirebaseReady' trên Firebase)
    // Tạm thời, chúng ta sẽ bắt đầu lắng nghe ngay khi đăng nhập thành công
    if (statusListener) return;

    // Implement logic to check if ESP32 Firebase is ready before starting listeners
    // For now, assuming ESP32 connects and Firebase is ready shortly after WiFi config via BLE

    statusListener = dbRef.on('value', snapshot => {
        const data = snapshot.val();
        if (data) {
            console.log("Received data from Firebase:", data);
            // Cập nhật UI với dữ liệu từ Firebase
            // Adjust field names to match your Firebase structure (/system_data)
            updateUI({
                temperature: data.temperature,
                on: !data.systemLocked, // Assuming systemLocked == true means OFF
                isAutoMode: !data.manualMode, // Assuming manualMode == true means MANUAL
                fanManual: data.fanState, // Assuming fanState is boolean
                relay1Active: data.heater1State // Assuming heater1State is boolean
            });
        } else {
             console.log("No data received from /system_data");
        }
    }, (error) => { // Add error handler for listener
         console.error("Firebase listener error:", error);
         // Handle potential permission denied errors or network issues
    });
     console.log("Started listening to Firebase stream.");
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
     console.log("Updating UI with data:", data);
    // Đảm bảo các nút được kích hoạt trước khi cập nhật trạng thái disabled dựa trên logic
    // Các nút System và Mode luôn được kích hoạt (chỉ bị disabled nếu hệ thống khóa)
    toggleSystemBtn.disabled = false; // Assuming systemLocked state from firebase handles this
    toggleModeBtn.disabled = false; // Assuming manualMode state from firebase handles this

    // Cập nhật nhiệt độ
    if (data.temperature !== undefined) {
        currentTemperatureSpan.textContent = `${data.temperature}°C`;
    } else {
         currentTemperatureSpan.textContent = `--°C`;
    }

    // Cập nhật trạng thái hệ thống (ON/OFF dựa trên systemLocked)
    isSystemOn = !data.systemLocked; // Reverse logic as per assumption
    updateSystemButton(isSystemOn);

    // Cập nhật chế độ (Auto/Manual dựa trên manualMode)
    isAutoMode = !data.manualMode; // Reverse logic as per assumption
    updateModeButton(isAutoMode);

    // Cập nhật trạng thái Fan (dựa trên fanState)
    fanManuallyOn = data.fanState; // Direct state
    updateFanButton(fanManuallyOn);

    // Cập nhật trạng thái Sưởi (dựa trên heater1State)
    // Assuming heater1State == true means Heater 1 is active, and heater2State will be opposite on ESP32
    relay1Active = data.heater1State;
    updateRelayButton(relay1Active); // This function name might need adjustment based on desired UI text ('Sưởi 1'/'Sưởi 2')

    // Cập nhật trạng thái disabled của các nút Fan và Heater dựa trên chế độ (Manual/Auto) và trạng thái hệ thống (ON/OFF)
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
// Adjusted this function to display 'Sưởi 1' or 'Sưởi 2' based on relay1Active state
function updateRelayButton(isRelay1Active) {
    if (isRelay1Active) {
        toggleRelayBtn.classList.remove('relay2'); // Assuming you have relay2 class for styling OFF state
        toggleRelayBtn.classList.add('relay1'); // Assuming you have relay1 class for styling ON state
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
         // When system is OFF, Fan and Heater buttons should be disabled regardless of mode
    }
}

// Cập nhật trạng thái disabled của các nút điều khiển
function updateButtonStates() {
    // Disable Fan and Heater buttons if in Auto Mode OR System is OFF
    if (isAutoMode || !isSystemOn) {
        toggleFanBtn.disabled = true;
        toggleRelayBtn.disabled = true;
    } else {
        // Enable if in Manual Mode AND System is ON
        toggleFanBtn.disabled = false;
        toggleRelayBtn.disabled = false;
    }
     // Lock button should always be enabled? Assuming System button controls locking logic now.
     // toggleLockBtn.disabled = state.locked; // If there was a separate Lock button

     // System and Mode buttons should always be enabled? Unless systemLocked state affects them too.
     // toggleSystemBtn.disabled = false; // Assuming System button is the main ON/OFF switch
     // toggleModeBtn.disabled = false; // Assuming Mode button always works unless system is locked
}

// --- Event Listeners ---
// Nút Scan BLE
scanButton.addEventListener('click', async () => {
    // checkBluetoothSupport() is called inside connectToESP32()
    await connectToESP32();
});

// Xử lý sự kiện nhấn nút Kết nối WiFi (sau khi đã kết nối BLE)
connectWifiBtn.addEventListener('click', sendWiFiCredentials);

// Nút Fan
toggleFanBtn.addEventListener('click', () => {
    if (!toggleFanBtn.disabled) {
        // Toggle local state immediately for responsive UI, then update Firebase
        fanManuallyOn = !fanManuallyOn;
        // updateFanButton(fanManuallyOn); // Call if you want immediate UI feedback before Firebase confirms
        cmdRef.update({ fanState: fanManuallyOn })
            .catch(error => console.error("Lỗi cập nhật Fan:", error));
    }
});

// Nút Sưởi
toggleRelayBtn.addEventListener('click', () => {
    if (!toggleRelayBtn.disabled) {
        // Toggle local state immediately
        relay1Active = !relay1Active;
        // updateRelayButton(relay1Active); // Call if you want immediate UI feedback
        cmdRef.update({ 
            heater1State: relay1Active,
            // Assuming heater2State should be the opposite of heater1State
            heater2State: !relay1Active 
        }).catch(error => console.error("Lỗi cập nhật Sưởi:", error));
    }
});

// Nút Hệ thống (Assuming this controls systemLocked state)
// This button controls the 'systemLocked' state on Firebase
toggleSystemBtn.addEventListener('click', () => {
    // Toggle local state immediately
    isSystemOn = !isSystemOn;
    // updateSystemButton(isSystemOn); // Call if you want immediate UI feedback
    cmdRef.update({ systemLocked: !isSystemOn }) // systemLocked true means system is OFF (locked)
        .catch(error => console.error("Lỗi cập nhật Hệ thống:", error));
});

// Nút Chế độ (Assuming this controls manualMode state)
// This button controls the 'manualMode' state on Firebase
toggleModeBtn.addEventListener('click', () => {
    // Toggle local state immediately
    isAutoMode = !isAutoMode;
    // updateModeButton(isAutoMode); // Call if you want immediate UI feedback
    cmdRef.update({ manualMode: !isAutoMode }) // manualMode true means MANUAL mode
        .catch(error => console.error("Lỗi cập nhật Chế độ:", error));
});
