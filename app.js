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
const cmdRef = database.ref('esp32/commands'); // Đường dẫn để gửi lệnh đến ESP32

// --- Lấy các phần tử DOM ---
const loginContainer = document.getElementById('loginContainer');
const controlPanel = document.getElementById('controlPanel');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

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
let relay1Active = true; // Mặc định ban đầu là Sưởi 1 (cho phù hợp với code ESP32)
let fanManuallyOn = false;

// --- Firebase Authentication ---
// Lắng nghe trạng thái xác thực để hiển thị giao diện phù hợp
auth.onAuthStateChanged(user => {
    if (user) {
        // Người dùng đã đăng nhập
        loginContainer.style.display = 'none';
        controlPanel.style.display = 'block';
        startFirebaseListeners(); // Bắt đầu lắng nghe dữ liệu từ Firebase DB
    } else {
        // Người dùng chưa đăng nhập hoặc đã đăng xuất
        loginContainer.style.display = 'block';
        controlPanel.style.display = 'none';
        stopFirebaseListeners(); // Dừng lắng nghe dữ liệu từ Firebase DB
        // Đảm bảo xóa trường đăng nhập khi đăng xuất
        loginEmail.value = '';
        loginPassword.value = '';
        loginError.textContent = ''; // Xóa thông báo lỗi cũ
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

// Xử lý sự kiện nhấn nút Đăng xuất
logoutBtn.addEventListener('click', () => {
    auth.signOut()
        .then(() => {
            console.log('Đăng xuất thành công');
        })
        .catch(error => {
            console.error('Lỗi đăng xuất Firebase:', error);
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
        if (data && data.systemState) {
            updateUI(data.systemState, data.buttonState, data.relayStatus);
        } else {
            console.log("Không có dữ liệu systemState hoặc dữ liệu rỗng.");
            // Cập nhật UI về trạng thái mặc định hoặc "đang tải" nếu không có dữ liệu
            currentTemperatureSpan.textContent = '--°C';
            systemStatusSpan.textContent = 'Không có dữ liệu';
            modeStatusSpan.textContent = 'Không có dữ liệu';
            // Vô hiệu hóa tất cả các nút nếu không có dữ liệu trạng thái
            toggleFanBtn.disabled = true;
            toggleRelayBtn.disabled = true;
            toggleSystemBtn.disabled = true;
            toggleModeBtn.disabled = true;
        }
    }, error => {
        console.error("Lỗi đọc Firebase Realtime Database:", error);
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
function updateUI(systemState, buttonState, relayStatus) {
    // Đảm bảo các nút được kích hoạt trước khi cập nhật trạng thái disabled dựa trên logic
    toggleSystemBtn.disabled = false;
    toggleModeBtn.disabled = false;

    // Cập nhật nhiệt độ
    if (systemState.temperature !== -127.0 && systemState.temperature !== null) {
        currentTemperatureSpan.textContent = `${systemState.temperature.toFixed(2)}°C`;
    } else {
        currentTemperatureSpan.textContent = 'Đang đọc...';
    }

    // Cập nhật trạng thái hệ thống ON/OFF
    isSystemOn = systemState.on;
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

    // Cập nhật chế độ Auto/Manual
    // Lấy trạng thái isAutoMode từ Firebase (systemState.isAutoMode)
    isAutoMode = systemState.isAutoMode; 
    updateModeButton(isAutoMode);

    // Cập nhật trạng thái Fan
    // Lấy trạng thái fanManual từ Firebase (systemState.fanManual)
    fanManuallyOn = systemState.fanManual; 
    updateFanButton(fanManuallyOn);
    
    // Cập nhật trạng thái Sưởi (Relay)
    // Lấy trạng thái relay1Active và heater2State từ Firebase
    relay1Active = systemState.relay1Active;
    const heater2State = systemState.heater2State;
    updateRelayButton(relay1Active, heater2State);

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
function updateRelayButton(isRelay1Active, heater2State) {
    // Kiểm tra nếu cả hai sưởi đều tắt
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

// --- Xử lý sự kiện nhấn các nút điều khiển trên Web ---

// Nút Fan
toggleFanBtn.addEventListener('click', () => {
    // Chỉ gửi lệnh khi nút không bị disabled
    if (!toggleFanBtn.disabled) {
        fanManuallyOn = !fanManuallyOn;
        cmdRef.update({ buttonFan: fanManuallyOn })
            .catch(error => console.error("Lỗi cập nhật trạng thái Fan lên Firebase:", error));
    }
});

// Nút Sưởi (Relay)
toggleRelayBtn.addEventListener('click', () => {
    // Chỉ gửi lệnh khi nút không bị disabled
    if (!toggleRelayBtn.disabled) {
        relay1Active = !relay1Active;
        cmdRef.update({ buttonRelay: relay1Active })
            .catch(error => console.error("Lỗi cập nhật trạng thái Relay lên Firebase:", error));
    }
});

// Nút Hệ thống ON/OFF
toggleSystemBtn.addEventListener('click', () => {
    isSystemOn = !isSystemOn;
    // Tương ứng với biến `buttonReset` trong code ESP32 của bạn
    cmdRef.update({ buttonReset: isSystemOn })
        .catch(error => console.error("Lỗi cập nhật trạng thái Hệ thống lên Firebase:", error));
});

// Nút Chế độ Auto/Manual
toggleModeBtn.addEventListener('click', () => {
    isAutoMode = !isAutoMode;
    // Tương ứng với biến `buttonMode` trong code ESP32 của bạn
    cmdRef.update({ buttonMode: isAutoMode })
        .catch(error => console.error("Lỗi cập nhật Chế độ lên Firebase:", error));
});
