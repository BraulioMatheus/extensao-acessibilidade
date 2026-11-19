const STORAGE_KEY = "avaStateV3";

const DEFAULT_PROFILE = {
  brightness: 100,
  contrast: 100,
  pauseAnimations: false,
  hideGifs: false,
  pauseLoopVideos: false,
  automaticAnalysis: false,
  smoothingMode: "adaptive",
  sensitivity: 60,
  temporalStrength: 65,
  spatialStrength: 35, bufferDelayMs: 400, qualityMode: "balanced"
};

function initialState() {
  return {
    activation: { mode: "off", host: null },
    activeProfile: "1",
    profiles: {
      "1": { ...DEFAULT_PROFILE },
      "2": { ...DEFAULT_PROFILE },
      "3": { ...DEFAULT_PROFILE }
    }
  };
}

const $ = (id) => document.getElementById(id);
let state = initialState();
let currentHost = null;
let writeQueue = Promise.resolve();

function normalizeState(value) {
  const base = initialState();
  if (!value || typeof value !== "object") return base;
  const mode = ["off", "site", "all"].includes(value.activation?.mode)
    ? value.activation.mode : "off";
  base.activation = {
    mode,
    host: mode === "site" ? (value.activation?.host || null) : null
  };
  base.activeProfile = ["1", "2", "3"].includes(value.activeProfile)
    ? value.activeProfile : "1";
  for (const id of ["1", "2", "3"]) {
    base.profiles[id] = { ...DEFAULT_PROFILE, ...(value.profiles?.[id] || {}) };
  }
  return base;
}

function migrateOldSettings(old) {
  const migrated = initialState();
  migrated.profiles["1"] = {
    brightness: old.brightness ?? DEFAULT_PROFILE.brightness,
    contrast: old.contrast ?? DEFAULT_PROFILE.contrast,
    pauseAnimations: old.pauseAnimations ?? false,
    hideGifs: old.hideGifs ?? false,
    pauseLoopVideos: old.pauseLoopVideos ?? false,
    automaticAnalysis: false,
    smoothingMode: "adaptive",
    sensitivity: 60,
    temporalStrength: 65,
    spatialStrength: 35, bufferDelayMs: 400, qualityMode: "balanced"
  };
  if (old.globalEnabled) {
    migrated.activation = { mode: "all", host: null };
  } else {
    const host = Object.keys(old.sites || {}).find((key) => old.sites[key]);
    if (host) migrated.activation = { mode: "site", host };
  }
  return migrated;
}

function selectedModeForPage() {
  if (state.activation.mode === "all") return "all";
  if (state.activation.mode === "site" && state.activation.host === currentHost) return "site";
  return "off";
}

function render() {
  const modeHere = selectedModeForPage();
  for (const button of document.querySelectorAll("[data-mode]")) {
    const selected = button.dataset.mode === modeHere;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    if (button.dataset.mode === "site") button.disabled = !currentHost;
  }
  for (const button of document.querySelectorAll("[data-profile]")) {
    const selected = button.dataset.profile === state.activeProfile;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }

  const profile = state.profiles[state.activeProfile];
  $("brightness").value = profile.brightness;
  $("contrast").value = profile.contrast;
  $("brightnessValue").textContent = `${profile.brightness}%`;
  $("contrastValue").textContent = `${profile.contrast}%`;
  $("pauseAnimations").checked = profile.pauseAnimations;
  $("hideGifs").checked = profile.hideGifs;
  $("pauseLoopVideos").checked = profile.pauseLoopVideos;
  $("automaticAnalysis").checked = Boolean(profile.automaticAnalysis);
  $("smoothingMode").value = profile.smoothingMode || "adaptive";
  $("qualityMode").value = profile.qualityMode || "balanced";
  for (const id of ["sensitivity", "temporalStrength", "spatialStrength", "bufferDelayMs"]) {
    $(id).value = profile[id] ?? DEFAULT_PROFILE[id];
    $(id + "Value").textContent = id === "bufferDelayMs" ? `${$(id).value} ms` : `${$(id).value}%`;
  }
  $("siteName").textContent = currentHost ? `Site aberto: ${currentHost}` : "Página não compatível.";

  if (state.activation.mode === "all") {
    $("scopeStatus").textContent = "Ativa em todos os sites HTTP/HTTPS compatíveis.";
  } else if (state.activation.mode === "site") {
    $("scopeStatus").textContent = `Ativa somente em: ${state.activation.host}.`;
  } else {
    $("scopeStatus").textContent = "Extensão desativada.";
  }
}

function persist() {
  const snapshot = JSON.parse(JSON.stringify(state));
  $("saveStatus").textContent = "Salvando configurações...";
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    await chrome.storage.local.set({ [STORAGE_KEY]: snapshot });
    $("saveStatus").textContent = `Perfil ${state.activeProfile} salvo automaticamente.`;
  }).catch((error) => {
    $("saveStatus").textContent = "Não foi possível salvar as configurações.";
    console.error(error);
  });
}

for (const button of document.querySelectorAll("[data-mode]")) {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    if (mode === "site" && !currentHost) return;
    state.activation = {
      mode,
      host: mode === "site" ? currentHost : null
    };
    render();
    persist();
  });
}

for (const button of document.querySelectorAll("[data-profile]")) {
  button.addEventListener("click", () => {
    state.activeProfile = button.dataset.profile;
    render();
    persist();
  });
}

for (const id of ["brightness", "contrast", "pauseAnimations", "hideGifs", "pauseLoopVideos",
                  "automaticAnalysis", "smoothingMode", "sensitivity", "temporalStrength", "spatialStrength", "bufferDelayMs", "qualityMode"]) {
  const input = $(id);
  input.addEventListener(input.type === "range" ? "input" : "change", () => {
    const profile = state.profiles[state.activeProfile];
    profile[id] = input.type === "range" ? Number(input.value) :
        input.type === "checkbox" ? input.checked : input.value;
    if (input.type === "range") $(id + "Value").textContent = id === "bufferDelayMs" ? `${input.value} ms` : `${input.value}%`;
    persist();
  });
}

async function initialize() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const url = new URL(tabs[0]?.url);
    if (["http:", "https:"].includes(url.protocol)) currentHost = url.hostname;
  } catch (_) { currentHost = null; }

  const stored = await chrome.storage.local.get(null);
  if (stored[STORAGE_KEY]) {
    state = normalizeState(stored[STORAGE_KEY]);
  } else {
    state = migrateOldSettings(stored);
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  }
  render();
  $("saveStatus").textContent = `Perfil ${state.activeProfile} carregado. Alterações são salvas automaticamente.`;
}

initialize().catch((error) => {
  $("saveStatus").textContent = "Erro ao carregar a extensão.";
  console.error(error);
});
