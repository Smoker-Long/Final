// !!! IMPORTANT: Replace with your actual Firebase Config !!!
const firebaseConfig = {
     apiKey: "AIzaSyAv3UTIlN7DxfA0a6swQU8qN2mDkFuynJ0", // Your API Key from ESP32 code
     databaseURL: "https://data-ds18b20-e8360-default-rtdb.firebaseio.com", // Your Database URL from ESP32 code
    // Add your Auth Domain and Project ID here if you have them
    // authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    // projectId: "YOUR_PROJECT_ID",
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // if already initialized, use that one
}

// Get Firebase Auth instance
const auth = firebase.auth();
const database = firebase.database();
const statusRef = database.ref('esp32/status');
const commandsRef = database.ref('esp32/commands'); // ESP32 code listens here

// *** ADDED: Variable to store the latest Firebase status data ***
let latestFirebaseStatusData = null;


// Get page elements
const loginPage = document.getElementById('login-page');
const controlPage = document.getElementById('control-page');
const createUserPage = document.getElementById('create-user-page'); // Added create user page

// Get login elements
const usernameInput = document.getElementById('username'); // Now used for Email
const passwordInput = document.getElementById('password'); // CORRECTED LINE
const loginArrowButton = document.getElementById('login-arrow-button');
const loginErrorDisplay = document.getElementById('login-error');
const createUserButton = document.getElementById('create-user-button'); // Button to show create user page

// Get control panel elements
const tempDisplay = document.getElementById('current-temperature');
const systemPowerButton = document.getElementById('system-power-button');
const operatingModeButton = document.getElementById('operating-mode-button');
const fanControlButton = document.getElementById('fan-control-button'); // Single Fan button
const heaterControlButton = document.getElementById('heater-control-button'); // Single Heater button

// Get create user elements
const createEmailInput = document.getElementById('create-email');
const createPasswordInput = document.getElementById('create-password');
const createUserArrowButton = document.getElementById('create-user-arrow-button');
const createUserMessage = document.getElementById('create-user-message');
const backToLoginButton = document.getElementById('back-to-login');


// --- Firebase Authentication Logic ---

// Handle user login
function attemptLogin() {
    const email = usernameInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
        loginErrorDisplay.textContent = "Vui lòng nhập email và mật khẩu.";
        loginErrorDisplay.style.color = 'red';
        return;
    }

    // Use Firebase Auth to sign in
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in successfully
            const user = userCredential.user;
            console.log("Firebase Auth Signed in as:", user.email);
            // onAuthStateChanged listener will handle page navigation
            loginErrorDisplay.textContent = ""; // Clear error
            // Clear password field after successful login for security
            passwordInput.value = '';
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error("Firebase Auth Sign in Error:", errorCode, errorMessage);
            // Display user-friendly error message
            if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
                 loginErrorDisplay.textContent = "Email hoặc mật khẩu không đúng.";
             } else if (errorCode === 'auth/invalid-email') {
                 loginErrorDisplay.textContent = "Địa chỉ email không hợp lệ.";
             } else {
                loginErrorDisplay.textContent = "Lỗi đăng nhập: " + errorMessage;
             }
            loginErrorDisplay.style.color = 'red';
        });
}

// Handle user creation (for initial admin setup or new users)
function createUser() {
    const email = createEmailInput.value;
    const password = createPasswordInput.value;

     if (!email || !password) {
         createUserMessage.textContent = "Vui lòng nhập email và mật khẩu.";
         createUserMessage.className = 'message error-message';
         return;
     }

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in (and created)
            const user = userCredential.user;
            console.log("Firebase Auth User created and signed in:", user.email);
            createUserMessage.textContent = "Tạo tài khoản thành công!";
            createUserMessage.className = 'message success-message';
            // Optionally navigate back to login or control page after creation
            // showLoginPage(); // or showControlPage();
             // Clear fields after creation
             createEmailInput.value = '';
             createPasswordInput.value = '';
        })
        .catch((error) => {
             const errorCode = error.code;
             const errorMessage = error.message;
             console.error("Firebase Auth Create User Error:", errorCode, errorMessage);
             if (errorCode === 'auth/email-already-in-use') {
                  createUserMessage.textContent = "Địa chỉ email này đã được sử dụng.";
             } else if (errorCode === 'auth/invalid-email') {
                  createUserMessage.textContent = "Địa chỉ email không hợp lệ.";
             } else if (errorCode === 'auth/weak-password') {
                  createUserMessage.textContent = "Mật khẩu quá yếu (ít nhất 6 ký tự).";
             }
             else {
                 createUserMessage.textContent = "Lỗi tạo tài khoản: " + errorMessage;
             }
             createUserMessage.className = 'message error-message';
        });
}


// --- Page Navigation ---
function showLoginPage() {
    loginPage.classList.remove('hidden');
    controlPage.classList.add('hidden');
    createUserPage.classList.add('hidden'); // Hide create user page
    // Clear login fields on showing login page
    usernameInput.value = '';
    passwordInput.value = '';
    loginErrorDisplay.textContent = ''; // Clear login error
     // Stop Firebase Realtime Database listener when logged out
     statusRef.off();
     // Reset latest data when logged out
     latestFirebaseStatusData = null;
}

function showControlPage() {
    loginPage.classList.add('hidden');
    controlPage.classList.remove('hidden');
    createUserPage.classList.add('hidden'); // Hide create user page
     // Clear create user message
     createUserMessage.textContent = ''; // Clear create user message
     createUserMessage.className = 'message'; // Reset message class
     // Ensure Firebase listener is active when on control page
     startFirebaseListener();
}

function showCreateUserPage() {
    loginPage.classList.add('hidden');
    controlPage.classList.add('hidden');
    createUserPage.classList.remove('hidden');
    // Clear create user fields
    createEmailInput.value = '';
    createPasswordInput.value = '';
    createUserMessage.textContent = '';
    createUserMessage.className = 'message';
}


// --- Firebase Realtime Database Listener and UI Update ---
// This function is called when the user successfully logs in (via onAuthStateChanged)
function startFirebaseListener() {
     // Check if listener is already attached (basic check)
     if (!statusRef._events || !statusRef._events.value) { // Check if 'value' event listener exists
         console.log("Attaching Firebase listener.");
         statusRef.on('value', (snapshot) => {
             const data = snapshot.val();
             console.log("Firebase status updated:", data);
             // *** ADDED: Store the latest data ***
             latestFirebaseStatusData = data;
             updateUI(data);
         }, (errorObject) => {
             console.log("The read failed: " + errorObject.code);
             // Optionally update UI to show connection error
             tempDisplay.textContent = 'Error';
             // Disable all control buttons on error
             systemPowerButton.classList.add('disabled');
             systemPowerButton.disabled = true;
             operatingModeButton.classList.add('disabled');
             operatingModeButton.disabled = true;
             if (fanControlButton) {
                 fanControlButton.classList.add('disabled');
                 fanControlButton.disabled = true;
             }
             if (heaterControlButton) {
                 heaterControlButton.classList.add('disabled');
                 heaterControlButton.disabled = true;
             }
             // Decide what to do on connection error - maybe show a message or log out
             // auth.signOut(); // Might want to sign out on severe errors
         });
     } else {
         console.log("Firebase listener already attached.");
     }
}


function updateUI(data) {
    // Only update UI if we are on the control page
    if (controlPage.classList.contains('hidden')) {
        return;
    }

    if (!data || !data.systemState || !data.buttonState || !data.buttonState.web) {
        console.warn("Incomplete data received from Firebase", data);
        // Keep current state or show partial info if some data exists
        if (!data || !data.systemState) { // If systemState is missing, temperature and system ON/OFF state is unknown
             tempDisplay.textContent = 'N/A';
        }
         // Disable manual controls if webButtonState is missing
         if (!data || !data.buttonState || !data.buttonState.web) {
             operatingModeButton.classList.add('disabled'); operatingModeButton.disabled = true; // Mode also relies on webButtonState
              if (fanControlButton) { fanControlButton.classList.add('disabled'); fanControlButton.disabled = true; }
             if (heaterControlButton) { heaterControlButton.classList.add('disabled'); heaterControlButton.disabled = true; }
         }
        return; // Exit if critical data is missing
    }

    const systemState = data.systemState;
    const webButtonState = data.buttonState.web;

    // Update Temperature
    tempDisplay.textContent = systemState.temperature !== undefined ? systemState.temperature.toFixed(2) : '__'; // Use __ as in mockup

    // Update System Power Button (webButtonReset: true = ON (Blue), false = OFF (Yellow))
    if (webButtonState.buttonReset !== undefined) {
        systemPowerButton.textContent = webButtonState.buttonReset ? 'ON' : 'OFF'; // Text reflects state
        systemPowerButton.classList.toggle('blue', webButtonState.buttonReset); // ON is Blue
        systemPowerButton.classList.toggle('yellow', !webButtonState.buttonReset); // OFF is Yellow
        systemPowerButton.classList.remove('green', 'orange'); // Remove other colors
        systemPowerButton.disabled = false; // Always enabled
        systemPowerButton.classList.remove('disabled');
    }


    // Update Operating Mode Button (webButtonMode: true = Auto (Yellow), false = Manual (Blue))
     if (webButtonState.buttonMode !== undefined) {
        operatingModeButton.textContent = webButtonState.buttonMode ? 'AUTO' : 'MANUAL'; // Text reflects state
        operatingModeButton.classList.toggle('yellow', webButtonState.buttonMode); // Auto is Yellow
        operatingModeButton.classList.toggle('blue', !webButtonState.buttonMode); // Manual is Blue
        operatingModeButton.classList.remove('green', 'orange'); // Remove other colors
        // Disable if system is OFF
        operatingModeButton.disabled = !systemState.on;
        operatingModeButton.classList.toggle('disabled', !systemState.on);
     }

    // --- Update Fan and Heater Control Buttons (Manual Mode Only) ---
    const isManualMode = !webButtonState.buttonMode; // Manual is false in ESP32 code
    const isSystemOn = systemState.on;

     // Enable/Disable Fan and Heater buttons based on mode and system state
     const manualControlsEnabled = isManualMode && isSystemOn;
     if (fanControlButton) {
         fanControlButton.disabled = !manualControlsEnabled;
         fanControlButton.classList.toggle('disabled', !manualControlsEnabled);
     }
     if (heaterControlButton) {
         heaterControlButton.disabled = !manualControlsEnabled;
         heaterControlButton.classList.toggle('disabled', !manualControlsEnabled);
     }


     // Fan Control Button (Manual Mode Only)
    // fanManual: true = ON (Blue), false = OFF (Yellow)
    if (fanControlButton && systemState.fanManual !== undefined) {
         fanControlButton.textContent = systemState.fanManual ? 'Fan ON' : 'Fan OFF'; // Text reflects state
         // Apply colors only when enabled, otherwise keep disabled look
         if(manualControlsEnabled) {
             fanControlButton.classList.toggle('blue', systemState.fanManual); // Fan ON is Blue
             fanControlButton.classList.toggle('yellow', !systemState.fanManual); // Fan OFF is Yellow
              fanControlButton.classList.remove('green', 'orange'); // Remove other colors
         } else {
              // Ensure only disabled styling is active when disabled
             fanControlButton.classList.remove('blue', 'yellow', 'green', 'orange');
         }
    } else if (fanControlButton) {
         // Default state or loading state when data is incomplete
         fanControlButton.textContent = 'Fan ?';
          if(manualControlsEnabled) {
             fanControlButton.classList.add('yellow'); // Default to yellow
              fanControlButton.classList.remove('blue', 'green', 'orange');
         } else {
             fanControlButton.classList.remove('blue', 'yellow', 'green', 'orange'); // No state color when disabled
         }
    }


    // Heater Control Button (Manual Mode Only)
    // relay1Active: true = Heater 1 (Yellow), false = Heater 2 (Blue) - BASED ON LATEST REQUEST
    if (heaterControlButton && systemState.relay1Active !== undefined) {
        heaterControlButton.textContent = systemState.relay1Active ? 'Heater 1' : 'Heater 2'; // Text reflects state
         // Apply colors only when enabled, otherwise keep disabled look
         if(manualControlsEnabled) {
             heaterControlButton.classList.toggle('yellow', systemState.relay1Active); // Heater 1 is Yellow
             heaterControlButton.classList.toggle('blue', !systemState.relay1Active); // Heater 2 is Blue
             heaterControlButton.classList.remove('green', 'orange'); // Remove other colors
         } else {
              // Ensure only disabled styling is active when disabled
             heaterControlButton.classList.remove('blue', 'yellow', 'green', 'orange');
         }
    } else if (heaterControlButton) {
         // Default state or loading state when data is incomplete
         heaterControlButton.textContent = 'Heater ?';
          if(manualControlsEnabled) {
              heaterControlButton.classList.add('yellow'); // Default to yellow
               heaterControlButton.classList.remove('blue', 'green', 'orange');
         } else {
             heaterControlButton.classList.remove('blue', 'yellow', 'green', 'orange'); // No state color when disabled
         }
    }
}

// --- Firebase Authentication State Listener ---
// This listener handles page navigation based on whether the user is logged in or out
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in, go to control page
        console.log("User signed in:", user.email);
        showControlPage();

    } else {
        // User is signed out, go to login page
        console.log("User signed out.");
        showLoginPage();
    }
});


// --- Event Listeners ---

// Login Arrow Button
loginArrowButton.addEventListener('click', attemptLogin);

// Allow pressing Enter key in password field to attempt login
passwordInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent default form submission if any
        attemptLogin();
    }
});

// Link to show Create User Page
if (createUserButton) {
     createUserButton.addEventListener('click', showCreateUserPage);
}


// Create User Arrow Button
if (createUserArrowButton) {
     createUserArrowButton.addEventListener('click', createUser);
}

// Back to Login Button (from Create User page)
if (backToLoginButton) {
    backToLoginButton.addEventListener('click', showLoginPage);
}


// System Power Button Click Handler
systemPowerButton.addEventListener('click', () => {
     if (systemPowerButton.disabled) return;
     // *** MODIFIED: Use stored latest data instead of statusRef.snapshot ***
     if (latestFirebaseStatusData && latestFirebaseStatusData.systemState && latestFirebaseStatusData.systemState.on !== undefined) {
          const currentStateIsOn = latestFirebaseStatusData.systemState.on;
          commandsRef.update({ buttonReset: !currentStateIsOn });
     } else {
         console.warn("Could not get current system power state from latest data.");
         // Fallback: infer from button color (less reliable)
          const currentStateIsOn = systemPowerButton.classList.contains('blue'); // Blue is ON
          commandsRef.update({ buttonReset: !currentStateIsOn });
     }
});

// Operating Mode Button Click Handler
operatingModeButton.addEventListener('click', () => {
    if (operatingModeButton.disabled) return;
    // *** MODIFIED: Use stored latest data instead of statusRef.snapshot ***
     if (latestFirebaseStatusData && latestFirebaseStatusData.buttonState && latestFirebaseStatusData.buttonState.web && latestFirebaseStatusData.buttonState.web.mode !== undefined) {
         const currentStateIsAuto = latestFirebaseStatusData.buttonState.web.mode;
         commandsRef.update({ buttonMode: !currentStateIsAuto });
     } else {
          console.warn("Could not get current mode state from latest data.");
           // Fallback: infer from button color (less reliable)
          const currentStateIsAuto = operatingModeButton.classList.contains('yellow'); // Yellow is AUTO
          commandsRef.update({ buttonMode: !currentStateIsAuto });
     }
});


// Fan Control Button Click Handler (Manual Mode Only)
fanControlButton.addEventListener('click', () => {
    if (fanControlButton.disabled) return;
     // *** MODIFIED: Use stored latest data instead of statusRef.snapshot ***
    if (latestFirebaseStatusData && latestFirebaseStatusData.systemState && latestFirebaseStatusData.systemState.fanManual !== undefined) {
         const currentStateIsFanOn = latestFirebaseStatusData.systemState.fanManual;
         commandsRef.update({ buttonFan: !currentStateIsFanOn });
     } else {
          console.warn("Could not get current fan state from latest data.");
          // Fallback: infer from button color (less reliable)
          const currentStateIsFanOn = fanControlButton.classList.contains('blue'); // Blue is ON
           commandsRef.update({ buttonFan: !currentStateIsFanOn });
     }
});

// Heater Control Button Click Handler (Manual Mode Only)
heaterControlButton.addEventListener('click', () => {
    if (heaterControlButton.disabled) return;
     // *** MODIFIED: Use stored latest data instead of statusRef.snapshot ***
    if (latestFirebaseStatusData && latestFirebaseStatusData.systemState && latestFirebaseStatusData.systemState.relay1Active !== undefined) {
         const currentStateIsHeater1 = latestFirebaseStatusData.systemState.relay1Active; // true means Relay 1
         // We want to toggle the relay1Active state
         commandsRef.update({ buttonRelay: !currentStateIsHeater1 });
     } else {
          console.warn("Could not get current heater state from latest data.");
          // Fallback: infer from button color (less reliable)
           const currentStateIsHeater2 = heaterControlButton.classList.contains('blue'); // Blue is Heater 2
           // If currently Heater 2 (Blue), clicking should go to Heater 1 (send true)
           // If currently Heater 1 (Yellow), clicking should go to Heater 2 (send false)
           commandsRef.update({ buttonRelay: currentStateIsHeater2 }); // Corrected logic based on state colors
     }
});