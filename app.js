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


// Get page elements (assuming these are available in the initial HTML)
const loginPage = document.getElementById('login-page');
const controlPage = document.getElementById('control-page');
const createUserPage = document.getElementById('create-user-page'); // Added create user page

// Get login elements (assuming these are available in the initial HTML)
const usernameInput = document.getElementById('username'); // Now used for Email
const passwordInput = document.getElementById('password'); // CORRECTED LINE
const loginArrowButton = document.getElementById('login-arrow-button');
const loginErrorDisplay = document.getElementById('login-error');
const createUserButton = document.getElementById('create-user-button'); // Button to show create user page

// Get create user elements (assuming these are available in the initial HTML)
const createEmailInput = document.getElementById('create-email');
const createPasswordInput = document.getElementById('create-password');
const createUserArrowButton = document.getElementById('create-user-arrow-button');
const createUserMessage = document.getElementById('create-user-message');
const backToLoginButton = document.getElementById('back-to-login');

// --- Control Panel Elements (Declare globally, assign later) ---
let tempDisplay = null;
let systemPowerButton = null;
let operatingModeButton = null;
let fanControlButton = null;
let heaterControlButton = null;

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
                  createUserMessage.textContent = "Mật khẩu quá yếu (ít nhất 6 ký tự).\";\
             }\
             else {\
                 createUserMessage.textContent = \"Lỗi tạo tài khoản: \" + errorMessage;\
             }\
             createUserMessage.className = \'message error-message\';\
        });\
}\
\
\
// --- Page Navigation ---\
function showLoginPage() {\
    loginPage.classList.remove(\'hidden\');\
    controlPage.classList.add(\'hidden\');\
    createUserPage.classList.add(\'hidden\'); // Hide create user page\
    // Clear login fields on showing login page\
    usernameInput.value = \'\';\
    passwordInput.value = \'\';\
    loginErrorDisplay.textContent = \'\'; // Clear login error\
     // Stop Firebase Realtime Database listener when logged out\
     statusRef.off();\
     // Reset latest data when logged out\
     latestFirebaseStatusData = null;\
     console.log(\"Showing Login Page. Firebase listener stopped.\");\
}\
\
// Add a flag to ensure control panel listeners are only attached once\
let controlListenersAttached = false;\
\
function showControlPage() {\
    loginPage.classList.add(\'hidden\');\
    controlPage.classList.add(\'hidden\');\
    createUserPage.classList.remove(\'hidden\');\
    // Clear create user fields\
    createEmailInput.value = \'\';\
    createPasswordInput.value = \'\';\
    createUserMessage.textContent = \'\';\
    createUserMessage.className = \'message\';\
    console.log(\"Showing Create User Page.\");\
}\
\
// --- NEW FUNCTION TO SETUP CONTROL PANEL LISTENERS ---\
// This function finds the elements and attaches event listeners\
function setupControlPanelListeners() {\
    console.log(\"Executing setupControlPanelListeners...\");\
    // Get control panel elements NOW\
    tempDisplay = document.getElementById(\'current-temperature\');\
    systemPowerButton = document.getElementById(\'system-power-button\');\
    operatingModeButton = document.getElementById(\'operating-mode-button\');\
    fanControlButton = document.getElementById(\'fan-control-button\');\
    heaterControlButton = document.getElementById(\'heater-control-button\');\
\
    // Check if elements were found\
    if (!tempDisplay || !systemPowerButton || !operatingModeButton || !fanControlButton || !heaterControlButton) {\
        console.error(\"Failed to find one or more control panel buttons/displays in the DOM!\");\
        console.log(\"tempDisplay:\", tempDisplay);\
        console.log(\"systemPowerButton:\", systemPowerButton);\
        console.log(\"operatingModeButton:\", operatingModeButton);\
        console.log(\"fanControlButton:\", fanControlButton);\
        console.log(\"heaterControlButton:\", heaterControlButton);\
        // Optionally display a user-friendly error message on the page\
        return; // Exit if elements not found\
    }\
    console.log(\"Successfully found all control panel elements.\");\
\
\
    // --- Attach Event Listeners for Control Buttons ---\
    console.log(\"Attaching event listeners to control buttons.\");\
\
    // System Power Button Click Handler\
    systemPowerButton.addEventListener(\'click\', handleSystemPowerClick); // Use a named function\
\
    // Operating Mode Button Click Handler\
    operatingModeButton.addEventListener(\'click\', handleOperatingModeClick); // Use a named function\
\
    // Fan Control Button Click Handler (Manual Mode Only)\
    // Check if the element exists before adding listener (as it might be removed/added dynamically)\
    if (fanControlButton) {\
        fanControlButton.addEventListener(\'click\', handleFanControlClick); // Use a named function\
    } else {\
        console.warn(\"Fan control button not found, listener not attached.\");\
    }\
\
    // Heater Control Button Click Handler (Manual Mode Only)\
     // Check if the element exists before adding listener\
    if (heaterControlButton) {\
        heaterControlButton.addEventListener(\'click\', handleHeaterControlClick); // Use a named function\
    } else {\
         console.warn(\"Heater control button not found, listener not attached.\");\
    }\
\
    console.log(\"Control button event listeners setup complete.\");\
\
    // Keep other listeners (loginArrowButton, passwordInput, createUserButton, etc.)\
    // outside this function if they are on the login/create user pages\
    // which are likely present when the script initially loads.\
}\
\
\
// --- Move Button Click Logic into Named Functions ---\
\
function handleSystemPowerClick() {\
     console.log(\"System Power button clicked.\"); // <-- Add logging\
     if (systemPowerButton.disabled) {\
         console.log(\"System Power button is disabled.\");\
         return;\
     }\
     // Use stored latest data if available, otherwise infer from button color (less reliable)\
     const currentStateIsOn = latestFirebaseStatusData && latestFirebaseStatusData.systemState && latestFirebaseStatusData.systemState.on !== undefined\
        ? latestFirebaseStatusData.systemState.on\
        : systemPowerButton.classList.contains(\'blue\'); // Fallback inference\
\
     console.log(\"Current system state (inferred):\", currentStateIsOn);\
     const newStateIsOn = !currentStateIsOn;\
     console.log(\"Sending system power command (buttonReset):\", newStateIsOn); // <-- Add logging\
     commandsRef.update({ buttonReset: newStateIsOn })\
        .then(() => console.log(\"System power command sent successfully.\"))\
        .catch(error => console.error(\"Error sending system power command:\", error));\
\
}\
\
function handleOperatingModeClick() {\
    console.log(\"Operating Mode button clicked.\"); // <-- Add logging\
    if (operatingModeButton.disabled) {\
        console.log(\"Operating Mode button is disabled.\");\
        return;\
    }\
     // Use stored latest data if available, otherwise infer from button color\
     const currentStateIsAuto = latestFirebaseStatusData && latestFirebaseStatusData.buttonState && latestFirebaseStatusData.buttonState.web && latestFirebaseStatusData.buttonState.web.mode !== undefined\
        ? latestFirebaseStatusData.buttonState.web.mode\
        : operatingModeButton.classList.contains(\'yellow\'); // Fallback inference\
\
    console.log(\"Current mode state (inferred):\", currentStateIsAuto);\
    const newStateIsAuto = !currentStateIsAuto;\
    console.log(\"Sending mode command (buttonMode):\", newStateIsAuto); // <-- Add logging\
    commandsRef.update({ buttonMode: newStateIsAuto })\
        .then(() => console.log(\"Operating mode command sent successfully.\"))\
        .catch(error => console.error(\"Error sending operating mode command:\", error));\
}\
\
function handleFanControlClick() {\
    console.log(\"Fan Control button clicked.\"); // <-- Add logging\
    if (fanControlButton.disabled) {\
         console.log(\"Fan Control button is disabled.\");\
        return;\
    }\
     // Use stored latest data if available, otherwise infer from button color\
    const currentStateIsFanOn = latestFirebaseStatusData && latestFirebaseStatusData.systemState && latestFirebaseStatusData.systemState.fanManual !== undefined\
        ? latestFirebaseStatusData.systemState.fanManual\
        : fanControlButton.classList.contains(\'blue\'); // Fallback inference\
\
    console.log(\"Current fan state (inferred):\", currentStateIsFanOn);\
    const newStateIsFanOn = !currentStateIsFanOn;\
    console.log(\"Sending fan command (buttonFan):\", newStateIsFanOn); // <-- Add logging\
    commandsRef.update({ buttonFan: newStateIsFanOn })\
        .then(() => console.log(\"Fan control command sent successfully.\"))\
        .catch(error => console.error(\"Error sending fan control command:\", error));\
}\
\
function handleHeaterControlClick() {\
    console.log(\"Heater Control button clicked.\"); // <-- Add logging\
    if (heaterControlButton.disabled) {\
         console.log(\"Heater Control button is disabled.\");\
        return;\
    }\
     // Use stored latest data if available, otherwise infer from button color\
    const currentStateIsHeater1 = latestFirebaseStatusData && latestFirebaseStatusData.systemState && latestFirebaseStatusData.systemState.relay1Active !== undefined\
        ? latestFirebaseStatusData.systemState.relay1Active // true means Relay 1 is active\
        : heaterControlButton.classList.contains(\'yellow\'); // Fallback: Yellow is Heater 1\
\
    console.log(\"Current heater state (isHeater1 inferred):\", currentStateIsHeater1);\
     // We want to toggle which heater is active.\
     // If currently Heater 1 (currentStateIsHeater1 is true), send false for buttonRelay to activate Heater 2.\
     // If currently Heater 2 (currentStateIsHeater1 is false), send true for buttonRelay to activate Heater 1.\
    const newButtonRelayState = !currentStateIsHeater1;\
    console.log(\"Sending heater command (buttonRelay):\", newButtonRelayState); // <-- Add logging\
    commandsRef.update({ buttonRelay: newButtonRelayState })\
        .then(() => console.log(\"Heater control command sent successfully.\"))\
        .catch(error => console.error(\"Error sending heater control command:\", error));\
}\
\
\
// --- Firebase Realtime Database Listener and UI Update ---\
// This function is called when the user successfully logs in (via onAuthStateChanged)\
function startFirebaseListener() {\
     // Check if listener is already attached (basic check)\
     // _events is an internal property, safer check might involve a flag or checking snapshot existence\
     // For this example, checking _events.value is a quick way to see if the \'value\' listener is there\
     if (!statusRef._events || !statusRef._events.value) {\
         console.log(\"Attaching Firebase listener to esp32/status.\");\
         statusRef.on(\'value\', (snapshot) => {\
             const data = snapshot.val();\
             console.log(\"Firebase status updated:\", data);\
             // *** ADDED: Store the latest data ***\
             latestFirebaseStatusData = data;\
             updateUI(data);\
         }, (errorObject) => {\
             console.error(\"Firebase read failed: \" + errorObject.code, errorObject);\
             // Optionally update UI to show connection error\
             if (tempDisplay) {\
                tempDisplay.textContent = \'Error\';\
             }\
             // Disable all control buttons on error if they exist\
             if (systemPowerButton) { systemPowerButton.classList.add(\'disabled\'); systemPowerButton.disabled = true; }\
             if (operatingModeButton) { operatingModeButton.classList.add(\'disabled\'); operatingModeButton.disabled = true; }\
             if (fanControlButton) { fanControlButton.classList.add(\'disabled\'); fanControlButton.disabled = true; }\
             if (heaterControlButton) { heaterControlButton.classList.add(\'disabled\'); heaterControlButton.disabled = true; }\
\
             // Decide what to do on connection error - maybe show a message or log out\
             // auth.signOut(); // Might want to sign out on severe errors\
         });\
     } else {\
         console.log(\"Firebase listener already attached.\");\
     }\
}\
\
\
function updateUI(data) {\
    console.log(\"Updating UI with data:\", data);\
    // Only update UI if we are on the control page and elements are found\
    if (controlPage.classList.contains(\'hidden\') || !systemPowerButton) { // Check if systemPowerButton is found as proxy for other elements\
        console.log(\"Not on control page or elements not found, skipping UI update.\");\
        return;\
    }\
\
    if (!data || !data.systemState || !data.buttonState || !data.buttonState.web) {\
        console.warn(\"Incomplete data received from Firebase for UI update:\", data);\
        // Keep current state or show partial info if some data exists\
        if (tempDisplay) {\
             tempDisplay.textContent = (!data || !data.systemState) ? \'N/A\' : (data.systemState.temperature !== undefined ? data.systemState.temperature.toFixed(2) : \'__\'); // Use __ as in mockup\
        }\
\
         // Disable manual controls if webButtonState is missing or systemState is missing\
         const disableManualControls = (!data || !data.buttonState || !data.buttonState.web || !data.systemState || !data.systemState.on);\
\
         if (operatingModeButton) {\
            operatingModeButton.disabled = disableManualControls || !data.systemState.on; // Also disable mode if system is off\
            operatingModeButton.classList.toggle(\'disabled\', operatingModeButton.disabled);\
             console.log(\"Operating Mode Button disabled status set to:\", operatingModeButton.disabled);\
         }\
          if (fanControlButton) {\
              fanControlButton.disabled = disableManualControls;\
              fanControlButton.classList.toggle(\'disabled\', fanControlButton.disabled);\
               console.log(\"Fan Control Button disabled status set to:\", fanControlButton.disabled);\
          }\
         if (heaterControlButton) {\
              heaterControlButton.disabled = disableManualControls;\
              heaterControlButton.classList.toggle(\'disabled\', heaterControlButton.disabled);\
               console.log(\"Heater Control Button disabled status set to:\", heaterControlButton.disabled);\
         }\
         if (systemPowerButton) { // Also log System button status for completeness\
              systemPowerButton.disabled = !data || !data.systemState || !data.systemState.on; // Should only be disabled if critical data is missing\
              systemPowerButton.classList.toggle(\'disabled\', systemPowerButton.disabled);\
              console.log(\"System Power Button disabled status set to:\", systemPowerButton.disabled);\
         }\
\
\
        if (!data || !data.systemState || !data.buttonState || !data.buttonState.web) {\
             return; // Exit if critical data is missing\
        }\
    }\
\
    const systemState = data.systemState;\
    const webButtonState = data.buttonState.web;\
     const isSystemOn = systemState.on;\
\
    // Update Temperature (already handled above for partial data)\
     if (tempDisplay && systemState.temperature !== undefined) {\
        tempDisplay.textContent = systemState.temperature.toFixed(2);\
     } else if (tempDisplay) {\
         tempDisplay.textContent = \'__\'; // Default if temperature missing\
     }\
\
\
    // Update System Power Button (webButtonReset: true = ON (Blue), false = OFF (Yellow))\
    if (systemPowerButton && webButtonState.buttonReset !== undefined) {\
        systemPowerButton.textContent = webButtonState.buttonReset ? \'ON\' : \'OFF\'; // Text reflects state\
        systemPowerButton.classList.toggle(\'blue\', webButtonState.buttonReset); // ON is Blue\
        systemPowerButton.classList.toggle(\'yellow\', !webButtonState.buttonReset); // OFF is Yellow\
        systemPowerButton.classList.remove(\'green\', \'orange\'); // Remove other colors\
        // systemPowerButton.disabled = false; // No longer needed here, handled in initial checks\
        systemPowerButton.classList.remove(\'disabled\'); // Remove disabled class if enabled\
         console.log(\"Updated System Power Button style.\");\
    } else if (systemPowerButton) {\
        // Default state if data missing\
        systemPowerButton.textContent = \'N/A\';\
        systemPowerButton.classList.remove(\'blue\', \'yellow\', \'green\', \'orange\');\
         // systemPowerButton.classList.add(\'disabled\'); // No longer needed here\
         console.log(\"System Power Button data missing.\");\
    }\
     if (systemPowerButton) console.log(\"Final System Power Button disabled status:\", systemPowerButton.disabled);\
\
\
    // Update Operating Mode Button (webButtonMode: true = Auto (Yellow), false = Manual (Blue))\
     if (operatingModeButton && webButtonState.buttonMode !== undefined) {\
        operatingModeButton.textContent = webButtonState.buttonMode ? \'AUTO\' : \'MANUAL\'; // Text reflects state\
        operatingModeButton.classList.toggle(\'yellow\', webButtonState.buttonMode); // Auto is Yellow\
        operatingModeButton.classList.toggle(\'blue\', !webButtonState.buttonMode); // Manual is Blue\
        operatingModeButton.classList.remove(\'green\', \'orange\'); // Remove other colors\
        // Disable if system is OFF\
        // operatingModeButton.disabled = !isSystemOn; // No longer needed here, handled in initial checks\
        operatingModeButton.classList.toggle(\'disabled\', !isSystemOn); // Ensure disabled class is correct\
         console.log(\"Updated Operating Mode Button style.\");\
     } else if (operatingModeButton) {\
         // Default state if data missing\
        operatingModeButton.textContent = \'MODE?\';\
        operatingModeButton.classList.remove(\'blue\', \'yellow\', \'green\', \'orange\');\
        // operatingModeButton.classList.add(\'disabled\'); // No longer needed here\
         console.log(\"Operating Mode Button data missing.\");\
     }\
     if (operatingModeButton) console.log(\"Final Operating Mode Button disabled status:\", operatingModeButton.disabled);\
\
    // --- Update Fan and Heater Control Buttons (Manual Mode Only) ---\
    const isManualMode = (webButtonState.buttonMode !== undefined) ? !webButtonState.buttonMode : false; // Manual is false in ESP32 code, default to Auto if data missing\
\
     // Enable/Disable Fan and Heater buttons based on mode and system state\
     const manualControlsEnabled = isManualMode && isSystemOn;\
     if (fanControlButton) {\
         // fanControlButton.disabled = !manualControlsEnabled; // No longer needed here\
         fanControlButton.classList.toggle(\'disabled\', !manualControlsEnabled); // Ensure disabled class is correct\
         console.log(\"Updated Fan Control Button disabled class based on manualControlsEnabled:\", !manualControlsEnabled);\
     }\
     if (heaterControlButton) {\
         // heaterControlButton.disabled = !manualControlsEnabled; // No longer needed here\
         heaterControlButton.classList.toggle(\'disabled\', !manualControlsEnabled); // Ensure disabled class is correct\
         console.log(\"Updated Heater Control Button disabled class based on manualControlsEnabled:\", !manualControlsEnabled);\
     }\
\
\
     // Fan Control Button (Manual Mode Only)\
    // fanManual: true = ON (Blue), false = OFF (Yellow)\
    if (fanControlButton && systemState.fanManual !== undefined) {\
         fanControlButton.textContent = systemState.fanManual ? \'Fan ON\' : \'Fan OFF\'; // Text reflects state\
         // Apply colors only when enabled, otherwise keep disabled look\
         if(manualControlsEnabled) {\
             fanControlButton.classList.toggle(\'blue\', systemState.fanManual); // Fan ON is Blue\
             fanControlButton.classList.toggle(\'yellow\', !systemState.fanManual); // Fan OFF is Yellow\
              fanControlButton.classList.remove(\'green\', \'orange\'); // Remove other colors\
              console.log(\"Updated Fan Control Button style based on fanManual.\");\
         } else {\
              // Ensure only disabled styling is active when disabled\
             fanControlButton.classList.remove(\'blue\', \'yellow\', \'green\', \'orange\');\
             console.log(\"Fan Control Button style reset due to manualControlsEnabled being false.\");\
         }\
    } else if (fanControlButton) {\
         // Default state or loading state when data is incomplete\
         fanControlButton.textContent = \'Fan ?\';\
          if(manualControlsEnabled) {\
             fanControlButton.classList.add(\'yellow\'); // Default to yellow\
              fanControlButton.classList.remove(\'blue\', \'green\', \'orange\');\
         } else {\
             fanControlButton.classList.remove(\'blue\', \'yellow\', \'green\', \'orange\'); // No state color when disabled\
         }\
         console.log(\"Fan Control Button data missing.\");\
    }\
    if (fanControlButton) console.log(\"Final Fan Control Button disabled status:\", fanControlButton.disabled);\
\
\
    // Heater Control Button (Manual Mode Only)\
    // relay1Active: true = Heater 1 (Yellow), false = Heater 2 (Blue) - BASED ON LATEST REQUEST\
    if (heaterControlButton && systemState.relay1Active !== undefined) {\
        heaterControlButton.textContent = systemState.relay1Active ? \'Heater 1\' : \'Heater 2\'; // Text reflects state\
         // Apply colors only when enabled, otherwise keep disabled look\
         if(manualControlsEnabled) {\
             heaterControlButton.classList.toggle(\'yellow\', systemState.relay1Active); // Heater 1 is Yellow\
             heaterControlButton.classList.toggle(\'blue\', !systemState.relay1Active); // Heater 2 is Blue\
             heaterControlButton.classList.remove(\'green\', \'orange\'); // Remove other colors\
              console.log(\"Updated Heater Control Button style based on relay1Active.\");\
         } else {\
              // Ensure only disabled styling is active when disabled\
             heaterControlButton.classList.remove(\'blue\', \'yellow\', \'green\', \'orange\');\
             console.log(\"Heater Control Button style reset due to manualControlsEnabled being false.\");\
         }\
    } else if (heaterControlButton) {\
         // Default state or loading state when data is incomplete\
         heaterControlButton.textContent = \'Heater ?\';\
          if(manualControlsEnabled) {\
              heaterControlButton.classList.add(\'yellow\'); // Default to yellow\
               heaterControlButton.classList.remove(\'blue\', \'green\', \'orange\');\
         } else {\
             heaterControlButton.classList.remove(\'blue\', \'yellow\', \'green\', \'orange\'); // No state color when disabled\
         }\
         console.log(\"Heater Control Button data missing.\");\
    }\
     if (heaterControlButton) console.log(\"Final Heater Control Button disabled status:\", heaterControlButton.disabled);\
\
\
}\
\
// --- Firebase Authentication State Listener ---\
// This listener handles page navigation based on whether the user is logged in or out\
auth.onAuthStateChanged((user) => {\
    if (user) {\
        // User is signed in, go to control page\
        console.log(\"User signed in:\", user.email);\
        showControlPage(); // <-- This now triggers setupControlPanelListeners if needed\
\
    } else {\
        // User is signed out, go to login page\
        console.log(\"User signed out.\");\
        showLoginPage();\
    }\
});\
\
\
// --- Initial Event Listeners (for elements assumed to be present when script loads) ---\
\
// Login Arrow Button\
if (loginArrowButton) { // Check if element exists\
    loginArrowButton.addEventListener(\'click\', attemptLogin);\
} else {\
    console.error(\"Login arrow button not found.\");\
}\
\
\
// Allow pressing Enter key in password field to attempt login\
if (passwordInput) { // Check if element exists\
    passwordInput.addEventListener(\'keypress\', (event) => {\
        if (event.key === \'Enter\') {\
            event.preventDefault(); // Prevent default form submission if any\
            attemptLogin();\
        }\
    });\
} else {\
    console.error(\"Password input not found.\");\
}\
\
\
// Link to show Create User Page\
if (createUserButton) { // Check if element exists\
     createUserButton.addEventListener(\'click\', showCreateUserPage);\
} else {\
     console.warn(\"Create user button not found.\");\
}\
\
\
// Create User Arrow Button\
if (createUserArrowButton) { // Check if element exists\
     createUserArrowButton.addEventListener(\'click\', createUser);\
} else {\\
     console.warn(\"Create user arrow button not found.\");\
}\
\
// Back to Login Button (from Create User page)\
if (backToLoginButton) { // Check if element exists\
    backToLoginButton.addEventListener(\'click\', showLoginPage);\
} else {\
     console.warn(\"Back to login button not found.\");\
}\
\
// The script will now wait for auth.onAuthStateChanged to determine the initial page\
// and call showControlPage which in turn calls setupControlPanelListeners if needed.\
// No need to call setupControlPanelListeners immediately here.\n```"}}
