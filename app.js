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
const dbRef = database.ref('system_data');
const cmdRef = database.ref('commands');

// --- Lấy các phần tử DOM ---
const loginContainer = document.getElementById('loginContainer');
const wifiConfig = document.getElementById('wifiConfig');
const controlPanel = document.getElementById('controlPanel');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

// WiFi Configuration Elements
const bleStatus = document.getElementById('bleStatus');
const wifiSSID = document.getElementById('wifiSSID');
const wifiPassword = document.getElementById('wifiPassword');
const sendWifiBtn = document.getElementById('sendWifiBtn');
const wifiError = document.getElementById('wifiError');

// Control Panel Elements
const currentTemperatureSpan = document.getElementById('currentTemperature');
const systemStatusSpan = document.getElementById('systemStatus');
const modeStatusSpan = document.getElementById('modeStatus');
const toggleFanBtn = document.getElementById('toggleFanBtn');
const toggleRelayBtn = document.getElementById('toggleRelayBtn');
const toggleSystemBtn = document.getElementById('toggleSystemBtn');
const toggleModeBtn = document.getElementById('toggleModeBtn');

// BLE Variables
let device = null;
let characteristic = null;
const SERVICE_UUID = "00001234-0000-1000-8000-00805f9b34fb";
const CHARACTERISTIC_UUID = "00005678-0000-1000-8000-00805f9b34fb";

// --- Biến trạng thái UI ---
let isSystemOn = false;
let isAutoMode = false;
let relay1Active = true; // Mặc định ban đầu là Sưởi 1 (cho phù hợp với code ESP32)
let fanManuallyOn = false;

// BLE Functions
async function connectToDevice() {
    if (!navigator.bluetooth) {
        throw new Error('Trình duyệt không hỗ trợ Web Bluetooth API');
    }

    try {
        bleStatus.textContent = 'Đang tìm kiếm thiết bị...';
        sendWifiBtn.disabled = true;
        
        // Request device
        device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [SERVICE_UUID] }],
            optionalServices: [SERVICE_UUID]
        });
        
        bleStatus.textContent = 'Đã tìm thấy thiết bị, đang kết nối...';
        
        // Connect to GATT server
        const server = await device.gatt.connect();
        bleStatus.textContent = 'Đã kết nối GATT server, đang tìm service...';
        
        // Get the service
        const service = await server.getPrimaryService(SERVICE_UUID);
        bleStatus.textContent = 'Đã tìm thấy service, đang tìm characteristic...';
        
        // Get the characteristic
        characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
        
        bleStatus.textContent = 'Đã kết nối thành công với ESP32';
        sendWifiBtn.disabled = false;
        
        // Add disconnect listener
        device.addEventListener('gattserverdisconnected', onDisconnected);
        
        return true;
    } catch (error) {
        console.error('BLE Connection Error:', error);
        if (error.name === 'NotFoundError' && error.message.includes('cancelled')) {
            bleStatus.textContent = 'Vui lòng chọn thiết bị ESP32 từ danh sách';
        } else {
            bleStatus.textContent = 'Lỗi kết nối BLE: ' + error.message;
        }
        sendWifiBtn.disabled = true;
        return false;
    }
}

function onDisconnected() {
    bleStatus.textContent = 'Mất kết nối với ESP32';
    sendWifiBtn.disabled = true;
    characteristic = null;
    device = null;
}

// Add a connect button to the WiFi config section
const connectBLEBtn = document.createElement('button');
connectBLEBtn.id = 'connectBLEBtn';
connectBLEBtn.textContent = 'Kết nối với ESP32';
connectBLEBtn.className = 'control-button';
wifiConfig.insertBefore(connectBLEBtn, wifiSSID);

// Add event listener for the connect button
connectBLEBtn.addEventListener('click', function(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Reset status message
    bleStatus.textContent = 'Đang tìm kiếm thiết bị...';
    
    // Wrap the async operation in a Promise
    const connectPromise = new Promise(async (resolve, reject) => {
        try {
            const result = await connectToDevice();
            resolve(result);
        } catch (error) {
            reject(error);
        }
    });

    // Handle the Promise
    connectPromise
        .then(() => {
            console.log('BLE connection successful');
        })
        .catch((error) => {
            console.error('BLE Connection Error:', error);
            if (error.name === 'NotFoundError' && error.message.includes('cancelled')) {
                bleStatus.textContent = 'Vui lòng chọn thiết bị ESP32 từ danh sách';
            } else {
                bleStatus.textContent = 'Lỗi kết nối BLE: ' + error.message;
            }
        });
});

// WiFi Configuration
sendWifiBtn.addEventListener('click', async () => {
    if (!characteristic) {
        wifiError.textContent = 'Chưa kết nối với ESP32';
        return;
    }

    const ssid = wifiSSID.value.trim();
    const password = wifiPassword.value.trim();

    if (!ssid || !password) {
        wifiError.textContent = 'Vui lòng nhập SSID và mật khẩu WiFi';
        return;
    }

    try {
        const data = `${ssid}:${password}`;
        await characteristic.writeValue(new TextEncoder().encode(data));
        wifiError.textContent = '';
        bleStatus.textContent = 'Đã gửi cấu hình WiFi';
        
        // Wait for WiFi connection
        setTimeout(() => {
            wifiConfig.style.display = 'none';
            controlPanel.style.display = 'block';
            startFirebaseListeners();
        }, 5000);
    } catch (error) {
        wifiError.textContent = 'Lỗi gửi cấu hình: ' + error;
        console.error('Send Error:', error);
    }
});

// Xử lý sự kiện nhấn nút Đăng nhập
loginBtn.addEventListener('click', () => {
    const email = loginEmail.value;
    const password = loginPassword.value;

    if (!email || !password) {
        loginError.textContent = 'Vui lòng nhập email và mật khẩu.';
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            loginError.textContent = ''; // Xóa lỗi nếu đăng nhập thành công
            console.log('Đăng nhập thành công!');
        })
        .catch(error => {
            loginError.textContent = `Lỗi đăng nhập: ${error.message}`;
            console.error('Lỗi đăng nhập Firebase:', error);
        });
});

// Nút Sưởi (Relay)
toggleRelayBtn.addEventListener('click', () => {
    // Chỉ gửi lệnh khi nút không bị disabled
    if (!toggleRelayBtn.disabled) {
        // Lấy trạng thái hiện tại từ Firebase
        database.ref('system_data').once('value')
            .then((snapshot) => {
                const data = snapshot.val();
                // Nếu cả hai sưởi đều đang tắt, bật sưởi 1
                if (!data.heater1State && !data.heater2State) {
                    cmdRef.update({ 
                        heater1State: true,
                        heater2State: false
                    });
                }
                // Nếu sưởi 1 đang bật, chuyển sang sưởi 2
                else if (data.heater1State) {
                    cmdRef.update({ 
                        heater1State: false,
                        heater2State: true
                    });
                }
                // Nếu sưởi 2 đang bật, tắt cả hai
                else {
                    cmdRef.update({ 
                        heater1State: false,
                        heater2State: false
                    });
                }
            })
            .catch(error => {
                console.error('Lỗi đọc trạng thái sưởi:', error);
            });
    }
});

// Nút Đăng xuất
logoutBtn.addEventListener('click', () => {
    // Ngắt kết nối WiFi trước khi đăng xuất
    cmdRef.update({ wifiEnabled: false })
        .then(() => {
            // Đợi 1 giây để đảm bảo lệnh được gửi đi
            setTimeout(() => {
                auth.signOut()
                    .then(() => {
                        console.log('Đăng xuất thành công');
                    })
                    .catch(error => {
                        console.error('Lỗi đăng xuất Firebase:', error);
                    });
            }, 1000);
        })
        .catch(error => {
            console.error('Lỗi cập nhật trạng thái WiFi:', error);
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
            updateUI(data);
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
        currentTemperatureSpan.textContent = `${data.temperature.toFixed(1)}°C`;
    }

    // Cập nhật trạng thái hệ thống ON/OFF
    isSystemOn = !data.systemLocked;
    systemStatusSpan.textContent = isSystemOn ? 'Đang hoạt động' : 'Đã tắt';
    toggleSystemBtn.classList.toggle('system-on', isSystemOn);
    toggleSystemBtn.classList.toggle('system-off', !isSystemOn);
    toggleSystemBtn.querySelector('.button-state').textContent = isSystemOn ? 'ON' : 'OFF';

    // Cập nhật chế độ Auto/Manual
    isAutoMode = !data.manualMode;
    modeStatusSpan.textContent = isAutoMode ? 'Tự động' : 'Thủ công';
    toggleModeBtn.classList.toggle('mode-auto', isAutoMode);
    toggleModeBtn.classList.toggle('mode-manual', !isAutoMode);
    toggleModeBtn.querySelector('.button-state').textContent = isAutoMode ? 'Auto' : 'Manual';

    // Cập nhật trạng thái Fan
    fanManuallyOn = data.fanState;
    toggleFanBtn.classList.toggle('on', fanManuallyOn);
    toggleFanBtn.classList.toggle('off', !fanManuallyOn);
    toggleFanBtn.querySelector('.button-state').textContent = fanManuallyOn ? 'ON' : 'OFF';

    // Cập nhật trạng thái Sưởi (Relay)
    relay1Active = data.heater1State;
    let heaterText = 'OFF';
    let heaterClass = 'off';
    
    if (data.heater1State) {
        heaterText = 'Sưởi 1';
        heaterClass = 'relay1';
    } else if (data.heater2State) {
        heaterText = 'Sưởi 2';
        heaterClass = 'relay2';
    } else if (!data.heater1State && !data.heater2State) {
        heaterText = 'OFF';
        heaterClass = 'off';
    }
    
    toggleRelayBtn.className = `control-button ${heaterClass}`;
    toggleRelayBtn.querySelector('.button-state').textContent = heaterText;

    // Xử lý trạng thái disabled của các nút điều khiển (Fan, Sưởi)
    // Các nút này chỉ có thể nhấn khi hệ thống ON VÀ ở chế độ Manual
    if (isAutoMode || !isSystemOn) {
        toggleFanBtn.disabled = true;
        toggleRelayBtn.disabled = true;
    } else {
        toggleFanBtn.disabled = false;
        toggleRelayBtn.disabled = false;
    }
}

// --- Xử lý sự kiện nhấn các nút điều khiển trên Web ---

// Nút Fan
toggleFanBtn.addEventListener('click', () => {
    // Chỉ gửi lệnh khi nút không bị disabled
    if (!toggleFanBtn.disabled) {
        fanManuallyOn = !fanManuallyOn;
        cmdRef.update({ fanState: fanManuallyOn });
    }
});

// Nút Hệ thống ON/OFF
toggleSystemBtn.addEventListener('click', () => {
    isSystemOn = !isSystemOn;
    cmdRef.update({ systemLocked: !isSystemOn });
});

// Nút Chế độ Auto/Manual
toggleModeBtn.addEventListener('click', () => {
    isAutoMode = !isAutoMode;
    cmdRef.update({ manualMode: !isAutoMode });
});

// Update auth state change handler
auth.onAuthStateChanged(user => {
    if (user) {
        // Người dùng đã đăng nhập
        loginContainer.style.display = 'none';
        
        // Kiểm tra trạng thái kết nối WiFi từ Firebase
        database.ref('system_data').once('value')
            .then((snapshot) => {
                const data = snapshot.val();
                if (data && data.wifiConnected) {
                    // Nếu đã kết nối WiFi, chuyển thẳng đến bảng điều khiển
                    wifiConfig.style.display = 'none';
                    controlPanel.style.display = 'block';
                    startFirebaseListeners();
                } else {
                    // Nếu chưa kết nối WiFi, hiển thị màn hình cấu hình
                    wifiConfig.style.display = 'block';
                    controlPanel.style.display = 'none';
                    bleStatus.textContent = 'Nhấn nút "Kết nối với ESP32" để bắt đầu';
                    sendWifiBtn.disabled = true;
                }
            })
            .catch((error) => {
                console.error('Error checking WiFi status:', error);
                // Nếu có lỗi, hiển thị màn hình cấu hình
                wifiConfig.style.display = 'block';
                controlPanel.style.display = 'none';
                bleStatus.textContent = 'Nhấn nút "Kết nối với ESP32" để bắt đầu';
                sendWifiBtn.disabled = true;
            });
    } else {
        // Người dùng chưa đăng nhập hoặc đã đăng xuất
        loginContainer.style.display = 'block';
        wifiConfig.style.display = 'none';
        controlPanel.style.display = 'none';
        // Reset form
        loginEmail.value = '';
        loginPassword.value = '';
        loginError.textContent = '';
        // Reset BLE state
        if (device && device.gatt.connected) {
            device.gatt.disconnect();
        }
        device = null;
        characteristic = null;
    }
});
