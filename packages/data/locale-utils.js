// 현재 선택된 언어와 언어 문자열을 저장할 변수
let currentLanguage = "en";
let translations = {};
// 로드된 섹션을 추적하기 위한 변수
let loadedSections = [];

// 언어 문자열 불러오기
async function loadTranslations() {
  try {
    const response = await fetch("../data/localization.json");
    translations = await response.json();
    return translations;
  } catch (error) {
    console.error("Failed to load translations:", error);
    return {};
  }
}

// 현재 설정된 언어 불러오기
async function getCurrentLanguage() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["settings"], function (result) {
      if (result.settings && result.settings.language) {
        currentLanguage = result.settings.language;
      }
      resolve(currentLanguage);
    });
  });
}

// 지정된 키에 해당하는 번역 문자열 가져오기
function getTranslation(section, key) {
  if (
    !translations[currentLanguage] ||
    !translations[currentLanguage][section] ||
    !translations[currentLanguage][section][key]
  ) {
    // 번역이 없으면 영어로 폴백
    if (
      translations["en"] &&
      translations["en"][section] &&
      translations["en"][section][key]
    ) {
      return translations["en"][section][key];
    }
    return key; // 영어 번역도 없으면 키 자체를 반환
  }

  return translations[currentLanguage][section][key];
}

// 페이지의 텍스트 요소들을 번역
function translatePage(section) {
  // data-i18n 속성이 있는 모든 요소를 선택
  const elements = document.querySelectorAll("[data-i18n]");

  elements.forEach((el) => {
    const key = el.getAttribute("data-i18n");
    // data-i18n-section 속성을 먼저 확인하고, 없으면 기본 섹션을 사용
    const elemSection = el.getAttribute("data-i18n-section") || section;

    // 요소가 지정된 섹션에 속하는 경우에만 번역 적용
    if (elemSection === section) {
      el.textContent = getTranslation(section, key);
    }
  });

  // 플레이스홀더 번역
  const inputElements = document.querySelectorAll("[data-i18n-placeholder]");
  inputElements.forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    const elemSection =
      el.getAttribute("data-i18n-placeholder-section") || section;

    // 요소가 지정된 섹션에 속하는 경우에만 번역 적용
    if (elemSection === section) {
      el.placeholder = getTranslation(section, key);
    }
  });
}

// 초기화 함수
async function initLocalization(section) {
  await loadTranslations();
  await getCurrentLanguage();
  loadedSections.push(section);
  translatePage(section);

  // 언어 변경 이벤트 감지
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (
      area === "sync" &&
      changes.settings &&
      changes.settings.newValue &&
      changes.settings.oldValue &&
      changes.settings.newValue.language !== changes.settings.oldValue.language
    ) {
      currentLanguage = changes.settings.newValue.language;
      // 로드된 모든 섹션에 대한 번역 적용
      loadedSections.forEach((sect) => translatePage(sect));
    }
  });
}

// 추가 섹션 로드 함수
function loadAdditionalSection(section) {
  if (!loadedSections.includes(section)) {
    loadedSections.push(section);
    translatePage(section); // 섹션을 추가한 후 바로 번역 적용
  }
}

// 글로벌 스코프에서 사용 가능하도록 내보내기
window.i18n = {
  init: initLocalization,
  get: getTranslation,
  translate: translatePage,
  loadSection: loadAdditionalSection,
};
