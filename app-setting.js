// app-settings.js

// When user toggles theme
function toggleTheme() {
  const currentTheme = localStorage.getItem("theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", newTheme);
  location.reload();
}

// When user selects a language
function setLanguage(lang) {
  localStorage.setItem("language", lang);
  location.reload();
}


// Apply Dark Mode if enabled
if (localStorage.getItem("darkmode") === "true") {
  document.body.classList.add("dark-mode");
}

// Apply Language if set
const languageMap = {
  en: { settings: "Settings", /* ...other labels */ },
  fr: { settings: "Paramètres", /* ... */ },
  // Add more...
};

function applyLanguage(lang) {
  const text = languageMap[lang];
  if (!text) return;
  // Update only if specific elements exist
  const header = document.querySelector("h2");
  if (header) header.innerText = text.settings;
  // Extend for other labels...
}

// const lang = localStorage.getItem("lang") || "en";
// applyLanguage(lang);



  // Set theme based on saved setting
  const body = document.getElementById('body');
  // const savedTheme = localStorage.getItem('theme'); // 'dark' or 'light'
  // if (savedTheme === 'dark') {
  //   body.classList.add('dark-mode');
  // }

  // ==== DARK MODE ====
const darkMode = JSON.parse(localStorage.getItem("darkMode"));
if (darkMode) {
  document.documentElement.classList.add("dark");
  document.body.style.backgroundColor = "#1e1e1e"; // Optional: dark background
} else {
  document.documentElement.classList.remove("dark");
  document.body.style.backgroundColor = "#f3fbfb"; // Light background
}
  // Apply saved language (if needed)
  const lang = localStorage.getItem('language') || 'en'; // e.g. 'en' or 'es'
  const translations = {
    en: {
      profile: "Profile",
      personalInfo: "Personal Information",
      username: "Username",
      email: "Email",
      phone: "Phone",
      gender: "Gender",
      setting: "Setting",
      back: "Back to Dashboard",
      logout: "Logout"
    },
    es: {
      profile: "Perfil",
      personalInfo: "Información Personal",
      username: "Nombre de usuario",
      email: "Correo electrónico",
      phone: "Teléfono",
      gender: "Género",
      setting: "Configuración",
      back: "Volver al Panel",
      logout: "Cerrar sesión"
    }
    // Add more languages as needed
  };

  function applyTranslations() {
    const t = translations[lang];
    document.querySelector('.edit h3').innerText = t.profile;
    document.querySelector('.info h4').innerText = t.personalInfo;
    document.querySelectorAll('.label')[0].innerText = t.username + ':';
    document.querySelectorAll('.label')[1].innerText = t.email + ':';
    document.querySelectorAll('.label')[2].innerText = t.phone + ':';
    document.querySelectorAll('.label')[3].innerText = t.gender + ':';
    document.querySelectorAll('.label')[4].innerText = t.setting + ':';
    document.querySelector('.btn-green').innerText = t.back;
    document.querySelector('.btn-red').innerText = t.logout;
  }

applyTranslations();
  
  const t = translations[language] || translations.en;

  // Apply translations using data-i18n
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.textContent = t[key];
  });

