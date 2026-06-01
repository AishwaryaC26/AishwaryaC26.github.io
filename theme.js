import "dark-mode-toggle";

const STAR_COUNT = 52;

function initStars() {
  const container = document.getElementById("stars");
  if (!container || container.childElementCount > 0) return;

  for (let i = 0; i < STAR_COUNT; i++) {
    const star = document.createElement("span");
    star.style.left = `${4 + Math.random() * 92}%`;
    star.style.top = `${2 + Math.random() * 58}%`;
    star.style.setProperty("--twinkle-dur", `${2 + Math.random() * 3.5}s`);
    star.style.setProperty("--twinkle-delay", `${Math.random() * 5}s`);
    const roll = Math.random();
    if (roll > 0.78) {
      star.classList.add("star-lg");
    } else if (roll < 0.18) {
      star.classList.add("star-yellow");
    } else if (roll < 0.48) {
      star.classList.add("star-accent");
    }
    container.appendChild(star);
  }
}

initStars();

export function applyTheme(mode) {
  const isDark = mode === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  window.dispatchEvent(
    new CustomEvent("themechange", { detail: { mode, isDark } }),
  );
}

function initThemeToggle(toggle) {
  applyTheme(toggle.mode || "light");

  document.addEventListener("colorschemechange", (event) => {
    const mode = event.detail?.colorScheme;
    if (mode === "dark" || mode === "light") {
      applyTheme(mode);
    }
  });
}

const toggle = document.getElementById("dark-mode-toggle");
if (toggle) {
  if (customElements.get("dark-mode-toggle")) {
    initThemeToggle(toggle);
  } else {
    customElements.whenDefined("dark-mode-toggle").then(() => {
      initThemeToggle(toggle);
    });
  }
}
