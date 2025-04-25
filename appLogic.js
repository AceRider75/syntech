// appLogic.js

// --- MODULE IMPORT ---
// Import the SDK class using the esm.run CDN URL
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// --- Configuration ---
// IMPORTANT: Replace with your actual Firebase config
const firebaseConfig = {
    apiKey: "__________________",
    authDomain: "__________________",
    databaseURL: "____________________",
    projectId: "____________",
    storageBucket: "_______________",
    messagingSenderId: "___________",
    appId: "_________________________",
    measurementId: "______________",
};

// !! IMPORTANT: Replace with your key. DO NOT commit real keys to public repos.
const GEMINI_API_KEY = "_____________________"; // <--- REPLACE

// --- Firebase Initialization ---
let app, auth, db;
try {
  if (typeof firebase === "undefined" || !firebase.initializeApp) {
    throw new Error(
      "Firebase SDK not loaded. Ensure the SDK script tags are included before this script."
    );
  }
  app = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  console.log("Firebase Initialized");
} catch (error) {
  console.error("Firebase initialization failed:", error);
  alert(
    "Critical error: Could not connect to Firebase. Please check console and SDK load order."
  );
}

// --- Gemini Initialization ---
let genAI, model;
try {
  if (typeof GoogleGenerativeAI === "undefined") {
    throw new Error(
      "GoogleGenerativeAI class not imported. Check the import statement."
    );
  }
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
    throw new Error(
      "Gemini API Key missing or placeholder. Replace in appLogic.js."
    );
  }
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  console.log("Gemini SDK Initialized");
} catch (error) {
  console.error("Gemini initialization failed:", error);
  alert(
    `Critical error initializing AI model: ${error.message}. AI features will be disabled.`
  );
}

// --- DOM Elements (assigned on DOMContentLoaded) ---
let landingPage,
  authContainer,
  appContainer,
  emailInput,
  passwordInput,
  authMessage,
  userEmailSpan,
  languageSelect,
  currentLevelSpan,
  completedLessonsSpan,
  lessonContentDiv,
  exerciseSection,
  exerciseDescriptionDiv,
  codeInput,
  feedbackSection,
  feedbackTextDiv,
  feedbackActionsDiv,
  nextLessonSection,
  loadingIndicator,
  submitButton,
  signUpButton,
  signInButton,
  signOutButton,
  nextLessonButton;

// --- Shared State (from globals) ---
const userProgress = window.userProfileData; 
let currentUser = null;
let currentLessonData = null;
let isLoading = false;

// --- DOM Ready: assign elements & listeners ---
document.addEventListener("DOMContentLoaded", () => {
  // Assign DOM elements
  landingPage = document.getElementById("landing-page");
  authContainer = document.getElementById("auth-container");
  appContainer = document.getElementById("app-container");
  emailInput = document.getElementById("email");
  passwordInput = document.getElementById("password");
  authMessage = document.getElementById("auth-message");
  userEmailSpan = document.getElementById("user-email");
  languageSelect = document.getElementById("language");
  currentLevelSpan = document.getElementById("current-level");
  completedLessonsSpan = document.getElementById("completed-lessons");
  lessonContentDiv = document.getElementById("lesson-content");
  exerciseSection = document.getElementById("exercise-section");
  exerciseDescriptionDiv = document.getElementById("exercise-description");
  codeInput = document.getElementById("code-input");
  feedbackSection = document.getElementById("feedback-section");
  feedbackTextDiv = document.getElementById("feedback-text");
  feedbackActionsDiv = document.getElementById("feedback-actions");
  nextLessonSection = document.getElementById("next-lesson-section");
  loadingIndicator = document.getElementById("loading-indicator");
  submitButton = document.getElementById("submit-button");
  nextLessonButton = document.getElementById("next-lesson-button");

  // Auth buttons
  const authBox = document.querySelector(".auth-box");
  if (authBox) {
    const btns = authBox.querySelectorAll("button");
    signUpButton = btns[0];
    signInButton = btns[1];
  }
  const header = document.querySelector("header");
  if (header) signOutButton = header.querySelector("button");

  // Verify critical elements
  if (
    !authContainer ||
    !appContainer ||
    !emailInput ||
    !passwordInput ||
    !lessonContentDiv ||
    !submitButton ||
    !signUpButton ||
    !signInButton
  ) {
    console.error("Critical DOM elements missing.");
    alert("Error initializing UI. Check console for missing IDs.");
    return;
  }

  // Add listeners
  signUpButton.addEventListener("click", signUp);
  signInButton.addEventListener("click", signIn);
  signOutButton?.addEventListener("click", signOutUser);
  languageSelect?.addEventListener("change", handleLanguageChange);
  submitButton.addEventListener("click", submitSolution);
  nextLessonButton.addEventListener("click", loadNextLesson);

  // Service checks
  if (!auth || !db) {
    displayInitializationError("Firebase services failed to load.");
    return;
  }
  if (!model) {
    displayInitializationError("AI Model failed to initialize.");
    // continue without AI tutoring
  }

  // Start auth listener
  checkAuthState();
});

// --- Utility Functions ---
function showLoading(message = "Loading...") {
  if (!loadingIndicator || !submitButton) return;
  isLoading = true;
  loadingIndicator.textContent = message;
  loadingIndicator.classList.remove("hidden");
  submitButton.disabled = true;
}
function hideLoading() {
  if (!loadingIndicator || !submitButton) return;
  loadingIndicator.classList.add("hidden");
  submitButton.disabled = false;
  isLoading = false;
}
function showAuthMessage(msg, isError = true) {
  if (!authMessage) return;
  authMessage.textContent = msg;
  authMessage.style.color = isError ? "var(--accent-color)" : "var(--success-color)";
}
function clearAuthMessage() {
  if (authMessage) authMessage.textContent = "";
}
function showAppUI() {
  landingPage?.classList.add("hidden");
  authContainer?.classList.add("hidden");
  appContainer?.classList.remove("hidden");
}
function showAuthUI() {
  landingPage?.classList.remove("hidden");
  authContainer?.classList.remove("hidden");
  appContainer?.classList.add("hidden");
  clearAuthMessage();
}
function displayInitializationError(message) {
  if (!appContainer) {
    alert(message);
    return;
  }
  appContainer.innerHTML = "";
  const div = document.createElement("div");
  Object.assign(div.style, {
    color: "red",
    padding: "20px",
    textAlign: "center",
    fontWeight: "bold",
  });
  div.textContent = message;
  appContainer.appendChild(div);
  appContainer.classList.remove("hidden");
  authContainer?.classList.add("hidden");
}

// --- Authentication Functions ---
async function signUp() {
  clearAuthMessage();
  const email = emailInput.value, pwd = passwordInput.value;
  if (!email || !pwd) { showAuthMessage("Enter email & password."); return; }
  if (pwd.length < 6) { showAuthMessage("Password ≥ 6 chars."); return; }
  try {
    const uc = await auth.createUserWithEmailAndPassword(email, pwd);
    await initUserProgress(uc.user.uid);
  } catch (e) {
    console.error("Sign up error:", e);
    showAuthMessage(`Sign up failed: ${e.message}`);
  }
}

async function signIn() {
  clearAuthMessage();
  const email = emailInput.value, pwd = passwordInput.value;
  if (!email || !pwd) { showAuthMessage("Enter email & password."); return; }
  try {
    await auth.signInWithEmailAndPassword(email, pwd);
  } catch (e) {
    console.error("Sign in error:", e);
    if (
      e.code === "auth/user-not-found" ||
      e.code === "auth/wrong-password" ||
      e.code === "auth/invalid-credential"
    ) {
      showAuthMessage("Incorrect email or password.");
    } else {
      showAuthMessage(`Sign in failed: ${e.message}`);
    }
  }
}

function signOutUser() {
  auth.signOut().catch((e) => {
    console.error("Sign out error:", e);
    alert("Error signing out. Try again.");
  });
}

// --- Firestore User Progress ---
async function initUserProgress(uid) {
  const lang = languageSelect?.value || "python";
  const init = {
    completedLessons: 0,
    currentLevel: 1,
    selectedLanguage: lang,
    history: [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    await db.collection("users").doc(uid).set(init);
    Object.assign(userProgress, init);
    updateUIWithUserData();
  } catch (e) {
    console.error("Error init progress:", e);
    alert("Could not save initial progress.");
  }
}

async function loadUserProgress(uid) {
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (doc.exists) {
      const d = doc.data();
      userProgress.completedLessons = d.completedLessons || 0;
      userProgress.currentLevel = d.currentLevel || 1;
      userProgress.selectedLanguage = d.selectedLanguage || "python";
      userProgress.history = Array.isArray(d.history) ? d.history : [];
    } else {
      await initUserProgress(uid);
    }
  } catch (e) {
    console.error("Error load progress:", e);
    alert("Could not load progress; using defaults.");
  } finally {
    updateUIWithUserData();
    return userProgress;
  }
}

async function updateUserProgress() {
  if (!currentUser) return;
  const payload = {
    completedLessons: userProgress.completedLessons,
    currentLevel: userProgress.currentLevel,
    selectedLanguage: userProgress.selectedLanguage,
    history: Array.isArray(userProgress.history) ? userProgress.history : [],
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    await db.collection("users").doc(currentUser.uid).update(payload);
  } catch (e) {
    console.error("Error update progress:", e);
    alert("Could not save progress.");
  }
}

// --- Gemini Helpers ---
function cleanJsonFromMarkdown(text = '') {
    let cleanedText = text.trim();
    // FIXED: Added closing quotes '```
    if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.substring(7).trim(); // Skip ```
        if (cleanedText.endsWith('```')) {
            cleanedText = cleanedText.substring(0, cleanedText.length - 3).trim();
        }
    } else if (cleanedText.startsWith('```')){
        cleanedText = cleanedText.substring(3).trim(); // Skip ```\n
        if (cleanedText.endsWith('```')){
            cleanedText = cleanedText.substring(0, cleanedText.length - 3).trim();
        }
    }
    return cleanedText;
}


async function generateLessonContent() {
    if (!model) { // Check if Gemini model initialized
        console.error("Gemini model not initialized. Cannot generate lesson.");
        if(lessonContentDiv) lessonContentDiv.innerHTML = `<p class="error-message">AI Model unavailable.</p>`;
        return null;
    }
    if (!lessonContentDiv) return null; // Check if UI element exists

    showLoading(`Generating ${userProgress.selectedLanguage} lesson (Level ${userProgress.currentLevel})...`);
    const historyPrompt = userProgress.history.length > 0 ? `Prior concepts covered: ${userProgress.history.slice(-5).join(', ')}.` : "First lesson.";
    // Refined prompt for clarity and JSON structure enforcement
    const prompt = `
        Tutor role: Generate the next ${userProgress.selectedLanguage} lesson for Level ${userProgress.currentLevel}. ${historyPrompt}
        Introduce ONE core concept.
        Output JSON ONLY: { "title": "Concise Title (max 60)", "concept": "Concept Name (max 30)", "explanation": "Markdown explanation with \`\`\`${userProgress.selectedLanguage}\\ncode\\n\`\`\` examples.", "exercise": { "description": "Single task using ONLY this lesson's concept.", "hints": ["Optional hint 1", "Optional hint 2"] } }
        CRITICAL: Valid JSON output ONLY. No text before or after the JSON object.
    `;
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const cleanedText = cleanJsonFromMarkdown(text); // Use helper function
        console.log("Gemini Lesson Raw/Cleaned:", text, cleanedText); // Log both raw and cleaned

        // Basic validation before parsing
        if (!cleanedText.startsWith('{') || !cleanedText.endsWith('}')) {
             throw new Error("AI response does not appear to be a valid JSON object.");
        }
        return JSON.parse(cleanedText); // Parse the cleaned text
    } catch (error) {
        console.error('Error processing Gemini lesson response:', error);
        if(lessonContentDiv) lessonContentDiv.innerHTML = `<p class="error-message">Error generating lesson: ${error.message}. Please try again.</p>`;
        return null; // Indicate failure
    } finally {
        hideLoading();
    }
}

async function evaluateSolution(code) {
    // Check pre-conditions
    if (!model) {
         console.error("Cannot evaluate: Model not ready.");
         if(feedbackTextDiv) feedbackTextDiv.innerHTML = `<p class="error-message">AI evaluation unavailable.</p>`;
         if(feedbackActionsDiv) { feedbackActionsDiv.innerHTML = ''; feedbackActionsDiv.appendChild(createRetryButton()); }
         return null;
    }
    if (!currentLessonData) {
         console.error("Cannot evaluate: Lesson context missing.");
         if(feedbackTextDiv) feedbackTextDiv.innerHTML = `<p class="error-message">Lesson context missing.</p>`;
         if(feedbackActionsDiv) { feedbackActionsDiv.innerHTML = ''; feedbackActionsDiv.appendChild(createRetryButton()); }
         return null;
    }
    if (!feedbackTextDiv || !feedbackActionsDiv) return null; // Check UI elements

    showLoading("Evaluating your solution...");
    // Refined prompt for clarity and JSON enforcement
    const prompt = `
        Assistant role: Evaluate student's ${userProgress.selectedLanguage} code for an exercise on "${currentLessonData.concept}".
        Exercise: "${currentLessonData.exercise.description}"
        Student code: \`\`\`${userProgress.selectedLanguage}\n${code}\n\`\`\`
        Output JSON ONLY: { "passed": boolean (true ONLY if code fully solves exercise using the concept), "score": number (0-100), "feedback": "Markdown feedback explaining pass/fail, errors, suggestions." }
        CRITICAL: Valid JSON output ONLY. Be strict on "passed".
    `;
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const cleanedText = cleanJsonFromMarkdown(text); // Use helper function
        console.log("Gemini Eval Raw/Cleaned:", text, cleanedText); // Log both

        // Basic validation before parsing
        if (!cleanedText.startsWith('{') || !cleanedText.endsWith('}')) {
             throw new Error("AI response does not appear to be a valid JSON object.");
        }
        return JSON.parse(cleanedText); // Parse cleaned text
    } catch (error) {
        console.error('Error processing Gemini evaluation response:', error);
        feedbackTextDiv.innerHTML = `<p class="error-message">Error evaluating solution: ${error.message}. Please try again.</p>`;
        feedbackTextDiv.className = 'failed'; // Style as failed
        feedbackActionsDiv.innerHTML = ''; feedbackActionsDiv.appendChild(createRetryButton()); // Add retry button
        return null; // Indicate failure
    } finally {
        hideLoading();
    }
}

// --- UI Update & Interaction ---
function updateUIWithUserData() {
  if (currentUser) userEmailSpan.textContent = currentUser.email;
  currentLevelSpan.textContent = userProgress.currentLevel;
  completedLessonsSpan.textContent = userProgress.completedLessons;
  if (languageSelect.value !== userProgress.selectedLanguage) {
    languageSelect.value = userProgress.selectedLanguage;
  }
}

function markdownToHtml(md = "") {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const codeBlockRegex = /``````/g;
  html = html.replace(codeBlockRegex, (_, lang, code) => {
    const cls = lang ? ` class="language-${lang}"` : "";
    return `<pre><code${cls}>${code.trim()}</code></pre>`;
  });
  return html.replace(/(?:\r\n|\r|\n)/g, "<br>");
}

async function loadAndDisplayLesson() {
  if (isLoading || !model) return;
  lessonContentDiv.innerHTML = "";
  exerciseSection.classList.add("hidden");
  feedbackSection.classList.add("hidden");
  nextLessonSection.classList.add("hidden");
  codeInput.value = "";

  currentLessonData = await generateLessonContent();
  if (
    currentLessonData?.title &&
    currentLessonData?.explanation &&
    currentLessonData?.exercise?.description
  ) {
    lessonContentDiv.innerHTML = `<h2>${currentLessonData.title}</h2>`;
    lessonContentDiv.innerHTML += markdownToHtml(
      currentLessonData.explanation
    );
    exerciseDescriptionDiv.innerHTML = markdownToHtml(
      currentLessonData.exercise.description
    );
    exerciseSection.classList.remove("hidden");
  } else if (!lessonContentDiv.querySelector(".error-message")) {
    lessonContentDiv.innerHTML = `<p class="error-message">Failed to load lesson.</p>`;
  }
}

function createRetryButton() {
  const btn = document.createElement("button");
  btn.textContent = "Try Again";
  btn.addEventListener("click", retryExercise);
  return btn;
}

async function submitSolution() {
  if (isLoading || !model) return;
  const code = codeInput.value.trim();
  if (!code) {
    alert("Please enter your code solution.");
    return;
  }
  const evalRes = await evaluateSolution(code);
  feedbackSection.classList.remove("hidden");
  exerciseSection.classList.add("hidden");
  feedbackActionsDiv.innerHTML = "";

  if (evalRes) {
    feedbackTextDiv.innerHTML = markdownToHtml(evalRes.feedback);
    feedbackTextDiv.className = evalRes.passed ? "passed" : "failed";
    if (evalRes.passed) {
      nextLessonSection.classList.remove("hidden");
      const concept = currentLessonData.concept || currentLessonData.title;
      const hist = Array.isArray(userProgress.history)
        ? userProgress.history
        : [];
      if (concept && !hist.includes(concept)) {
        userProgress.completedLessons++;
        userProgress.currentLevel++;
        hist.push(concept);
        userProgress.history = hist;
        await updateUserProgress();
        updateUIWithUserData();
      }
    } else {
      feedbackActionsDiv.appendChild(createRetryButton());
      nextLessonSection.classList.add("hidden");
    }
  } else {
    feedbackTextDiv.className = "failed";
    feedbackActionsDiv.appendChild(createRetryButton());
  }
}

function retryExercise() {
  exerciseSection.classList.remove("hidden");
  feedbackSection.classList.add("hidden");
  nextLessonSection.classList.add("hidden");
  feedbackTextDiv.innerHTML = "";
  codeInput.focus();
}

async function loadNextLesson() {
  nextLessonSection.classList.add("hidden");
  currentLessonData = null;
  await loadAndDisplayLesson();
}

async function handleLanguageChange() {
  const newLang = languageSelect.value;
  if (newLang !== userProgress.selectedLanguage && currentUser) {
    const ok = confirm(
      `Change language to ${newLang}? This will reset your progress.`
    );
    if (ok) {
      userProgress.selectedLanguage = newLang;
      userProgress.currentLevel = 1;
      userProgress.completedLessons = 0;
      userProgress.history = [];
      await updateUserProgress();
      updateUIWithUserData();
      currentLessonData = null;
      await loadAndDisplayLesson();
    } else {
      languageSelect.value = userProgress.selectedLanguage;
    }
  }
}

// --- Auth State Listener ---
function checkAuthState() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      if (!currentUser || currentUser.uid !== user.uid) {
        currentUser = user;
        showAppUI();
        await loadUserProgress(user.uid);
        if (model && !currentLessonData) {
          await loadAndDisplayLesson();
        }
      } else {
        showAppUI();
        updateUIWithUserData();
      }
    } else {
      currentUser = null;
      currentLessonData = null;
      showAuthUI();
      updateUIWithUserData();
      //window.location.replace("index.html");
    }
  });
}
