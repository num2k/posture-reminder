// 메인 탭 요소들
const nextReminderElement = document.getElementById("next-reminder");
const pauseButton = document.getElementById("pause-btn");
const resetButton = document.getElementById("reset-btn");
const intervalSelect = document.getElementById("interval-select");
const tipTitle = document.getElementById("tip-title");
const tipDescription = document.getElementById("tip-description");

// 설정 탭 요소들
const customIntervalInput = document.getElementById("custom-interval");
const intervalPresets = document.querySelectorAll(".interval-preset");
const notificationsToggle = document.getElementById("notifications-toggle");
const exercisesToggle = document.getElementById("exercises-toggle");
const categoryCheckboxes = document.querySelectorAll(".category-item input");
const workStartInput = document.getElementById("work-start");
const workEndInput = document.getElementById("work-end");
const workHoursOnlyToggle = document.getElementById("work-hours-only");
const languageSelect = document.getElementById("language-select");
const saveButton = document.getElementById("save-btn");
const resetButtonOptions = document.getElementById("reset-btn-options");

// 탭 관련 요소들
const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");

// 기본 설정
const DEFAULT_SETTINGS = {
  interval: 30,
  notifications: true,
  exercises: true,
  language: "en",
  categories: {
    neck: true,
    shoulder: true,
    back: true,
    wrist: true,
    eye: true,
    arm: true,
  },
  workStart: "09:00",
  workEnd: "18:00",
  workHoursOnly: false,
  isPaused: false,
};

// 현재 설정
let settings = { ...DEFAULT_SETTINGS };

// 타이머 업데이트 인터벌 ID
let timerInterval;

// 현재 알람 정보
let currentAlarm = null;

// 일시 정지 시 남은 시간을 저장하는 변수 (밀리초 단위)
let pausedTimeLeft = 0;

// 번역 기능 초기화
document.addEventListener("DOMContentLoaded", async () => {
  // 언어 유틸리티 초기화
  await i18n.init("popup");

  // options 섹션에 대한 번역도 로드
  i18n.loadSection("options");

  // 기존 초기화 함수 호출
  loadSettings();
  loadStretchingTip();
  initTabSystem();

  // 언어 선택 변경 이벤트 리스너 추가
  languageSelect.addEventListener("change", function () {
    const newLanguage = languageSelect.value;
    settings.language = newLanguage;
    updateAllUIElements();
  });
});

// 탭 시스템 초기화
function initTabSystem() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // 모든 탭 버튼에서 active 클래스 제거
      tabButtons.forEach((btn) => btn.classList.remove("active"));

      // 클릭한 버튼에 active 클래스 추가
      button.classList.add("active");

      // 모든 탭 컨텐츠 숨기기
      tabContents.forEach((content) => (content.style.display = "none"));

      // 해당 탭 컨텐츠 표시
      const tabId = button.getAttribute("data-tab");
      document.getElementById(`${tabId}-tab`).style.display = "block";
    });
  });
}

// 설정을 로드합니다
function loadSettings() {
  chrome.storage.sync.get(["settings", "pausedTimeLeft"], function (result) {
    if (result.settings) {
      settings = { ...DEFAULT_SETTINGS, ...result.settings };

      // 저장된 일시 정지 시간이 있으면 복원
      if (result.pausedTimeLeft && settings.isPaused) {
        pausedTimeLeft = result.pausedTimeLeft;
        console.log(
          `저장된 일시 정지 시간 복원: ${Math.floor(pausedTimeLeft / 1000)}초`
        );
      }

      // UI 업데이트
      updateAllUIElements();

      // 타이머 업데이트 시작
      startTimerUpdate();
    } else {
      // 설정이 없으면 기본값 저장
      chrome.storage.sync.set({ settings });
    }
  });
}

// 모든 UI 요소를 업데이트하는 함수
function updateAllUIElements() {
  updateMainTabUI();
  updateSettingsTabUI();
  i18n.translate("popup"); // 메인 탭 번역
  i18n.translate("options"); // 설정 탭 번역
  updateDynamicTexts(settings.language);
}

// 메인 탭 UI를 업데이트합니다
function updateMainTabUI() {
  intervalSelect.value = settings.interval;
  updatePauseButtonState();
}

// 설정 탭 UI를 업데이트합니다
function updateSettingsTabUI() {
  customIntervalInput.value = settings.interval;
  notificationsToggle.checked = settings.notifications;
  exercisesToggle.checked = settings.exercises;

  // 언어 선택 UI 업데이트
  languageSelect.value = settings.language || "en";

  // 인터벌 프리셋을 업데이트합니다
  intervalPresets.forEach((preset) => {
    const value = parseInt(preset.dataset.value);
    if (value === settings.interval) {
      preset.classList.add("active");
    } else {
      preset.classList.remove("active");
    }
  });

  // 카테고리 체크박스를 업데이트합니다
  categoryCheckboxes.forEach((checkbox) => {
    const category = checkbox.dataset.category;
    if (settings.categories && settings.categories[category] !== undefined) {
      checkbox.checked = settings.categories[category];
    }
  });

  // 작업 시간 설정을 업데이트합니다
  workStartInput.value = settings.workStart;
  workEndInput.value = settings.workEnd;
  workHoursOnlyToggle.checked = settings.workHoursOnly;
}

// data-i18n 속성이 없는 동적 텍스트 요소들을
// 수동으로 번역하는 함수
function updateDynamicTexts(lang) {
  // 인터벌 프리셋 버튼 텍스트 업데이트
  intervalPresets.forEach((preset) => {
    const value = preset.dataset.value;
    if (value === "15")
      preset.textContent = "15 " + (lang === "ko" ? "분" : "min");
    else if (value === "30")
      preset.textContent = "30 " + (lang === "ko" ? "분" : "min");
    else if (value === "45")
      preset.textContent = "45 " + (lang === "ko" ? "분" : "min");
    else if (value === "60")
      preset.textContent = "60 " + (lang === "ko" ? "분" : "min");
  });

  // 일시정지 버튼 상태 업데이트
  updatePauseButtonState();

  // 타이머 업데이트 (일시 정지 상태에서도 현재 시간 표시 유지)
  updateTimer();

  // 재시작 버튼
  if (resetButton) {
    resetButton.textContent = i18n.get("popup", "resetBtn");
  }

  // 저장 및 재설정 버튼 텍스트 업데이트
  if (saveButton) {
    saveButton.textContent = i18n.get("options", "save");
  }

  if (resetButtonOptions) {
    resetButtonOptions.textContent = i18n.get("options", "reset");
  }

  // 스트레칭 팁 다시 로드
  loadStretchingTip();
}

// 타이머 업데이트를 시작합니다
function startTimerUpdate() {
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

// 타이머 표시를 업데이트합니다
function updateTimer() {
  chrome.alarms.get("postureReminderAlarm", (alarm) => {
    currentAlarm = alarm;

    if (alarm && !settings.isPaused) {
      const now = new Date().getTime();
      const alarmTime = alarm.scheduledTime;
      const timeLeft = Math.max(0, alarmTime - now);

      const minutes = Math.floor(timeLeft / (60 * 1000));
      const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);

      nextReminderElement.textContent = `${padZero(minutes)}:${padZero(
        seconds
      )}`;
    } else if (settings.isPaused && pausedTimeLeft > 0) {
      // 일시 정지 상태에서는 마지막으로 저장된 시간을 표시
      const minutes = Math.floor(pausedTimeLeft / (60 * 1000));
      const seconds = Math.floor((pausedTimeLeft % (60 * 1000)) / 1000);

      nextReminderElement.innerHTML = `
        <span class="paused">${padZero(minutes)}:${padZero(seconds)}</span>
      `;
    } else {
      // 알람이 없거나 남은 시간이 없을 때
      nextReminderElement.textContent = "00:00";
    }
  });
}

// 숫자를 2자리로 패딩합니다
function padZero(num) {
  return num.toString().padStart(2, "0");
}

// 일시정지 버튼 상태를 업데이트합니다
function updatePauseButtonState() {
  if (settings.isPaused) {
    pauseButton.classList.add("paused");
    pauseButton.textContent = i18n.get("popup", "resumeBtn");
    pauseButton.setAttribute("title", i18n.get("popup", "resumeBtn"));
  } else {
    pauseButton.classList.remove("paused");
    pauseButton.textContent = i18n.get("popup", "pauseBtn");
    pauseButton.setAttribute("title", i18n.get("popup", "pauseBtn"));
  }
}

// 알람 일시정지/재개 토글
function togglePause() {
  const wasPaused = settings.isPaused;

  if (!wasPaused) {
    // 일시 정지하려는 경우
    if (currentAlarm) {
      const now = new Date().getTime();
      const alarmTime = currentAlarm.scheduledTime;
      pausedTimeLeft = Math.max(0, alarmTime - now);
      console.log(
        `일시 정지: 남은 시간 ${Math.floor(pausedTimeLeft / 1000)}초 저장됨`
      );

      // 남은 시간을 storage에 저장
      chrome.storage.sync.set({ pausedTimeLeft });
    }

    // 상태를 먼저 변경
    settings.isPaused = true;
    chrome.storage.sync.set({ settings });

    // 알람을 일시정지합니다
    chrome.alarms.clear("postureReminderAlarm");
  } else {
    // 재개하려는 경우
    // 상태를 먼저 변경
    settings.isPaused = false;
    chrome.storage.sync.set({ settings });

    // 재개할 때 저장된 남은 시간으로 알람 설정
    if (pausedTimeLeft > 0) {
      // 남은 시간을 분 단위로 변환 (소수점 포함)
      const remainingMinutes = pausedTimeLeft / (60 * 1000);
      console.log(
        `재개: 남은 ${remainingMinutes.toFixed(2)}분으로 알람 재설정`
      );

      // 특정 시간으로 알람을 재설정하는 메시지 전송
      chrome.runtime.sendMessage({
        action: "resumeAlarm",
        delayInMinutes: remainingMinutes,
      });

      // 재개 후 저장된 시간 초기화
      pausedTimeLeft = 0;
      chrome.storage.sync.remove("pausedTimeLeft");
    } else {
      // 저장된 시간이 없으면 기본 간격으로 재설정
      chrome.runtime.sendMessage({ action: "resetAlarm" });
    }
  }

  updatePauseButtonState();
}

// 알람을 리셋합니다
function resetAlarm() {
  settings.isPaused = false;
  chrome.storage.sync.set({ settings });
  chrome.runtime.sendMessage({ action: "resetAlarm" });
  updatePauseButtonState();
}

// Quick Settings 타이머 간격을 변경합니다
function changeInterval() {
  const newInterval = parseInt(intervalSelect.value);
  settings.interval = newInterval;

  // 설정 탭의 커스텀 인터벌 값도 업데이트
  customIntervalInput.value = newInterval;

  // 활성 프리셋 업데이트
  intervalPresets.forEach((preset) => {
    const value = parseInt(preset.dataset.value);
    if (value === newInterval) {
      preset.classList.add("active");
    } else {
      preset.classList.remove("active");
    }
  });

  chrome.storage.sync.set({ settings });

  if (!settings.isPaused) {
    resetAlarm();
  }
}

// 오늘의 스트레칭 팁을 로드합니다
function loadStretchingTip() {
  // 파라미터로 전달된 language를 사용하거나, 없으면 현재 설정에서 가져옴
  const language = settings.language || "en";

  const exercisesFile =
    language === "ko" ? "../data/exercises_kr.json" : "../data/exercises.json";

  console.log(
    `스트레칭 팁 로드 중... 언어: ${language}, 파일: ${exercisesFile}`
  );

  fetch(exercisesFile)
    .then((response) => response.json())
    .then((exercises) => {
      if (exercises.length > 0) {
        const randomIndex = Math.floor(Math.random() * exercises.length);
        const tip = exercises[randomIndex];
        tipTitle.textContent = tip.title;
        tipDescription.textContent = tip.description;
        console.log(`스트레칭 팁 로드 완료: ${tip.title}`);
      }
    })
    .catch((error) => console.error("Failed to load stretching tip:", error));
}

// 커스텀 인터벌 유효성 검사
function validateCustomInterval() {
  let value = parseInt(customIntervalInput.value);

  if (isNaN(value) || value < 1) {
    value = 1;
  } else if (value > 180) {
    value = 180;
  }

  customIntervalInput.value = value;
}

// 설정을 저장합니다
function saveSettings() {
  // 카테고리 설정을 수집합니다
  const categories = {};
  categoryCheckboxes.forEach((checkbox) => {
    const category = checkbox.dataset.category;
    categories[category] = checkbox.checked;
  });

  // 커스텀 인터벌 값 유효성 검증
  validateCustomInterval();

  // 새 설정 객체를 생성합니다
  settings = {
    interval: parseInt(customIntervalInput.value),
    notifications: notificationsToggle.checked,
    exercises: exercisesToggle.checked,
    language: languageSelect.value,
    categories: categories,
    workStart: workStartInput.value,
    workEnd: workEndInput.value,
    workHoursOnly: workHoursOnlyToggle.checked,
    isPaused: settings.isPaused,
  };

  // 설정을 저장합니다
  chrome.storage.sync.set({ settings }, function () {
    // 알람을 재설정합니다 (만약 일시정지 상태가 아니라면)
    if (!settings.isPaused) {
      chrome.runtime.sendMessage({ action: "resetAlarm" });
    }

    // 메인 탭 UI도 업데이트
    updateMainTabUI();

    // 저장 피드백을 표시합니다
    showSavedFeedback();
  });
}

// 저장 피드백을 표시합니다
function showSavedFeedback() {
  saveButton.textContent = i18n.get("options", "saved");
  saveButton.style.backgroundColor = "#28a745";

  setTimeout(() => {
    saveButton.textContent = i18n.get("options", "save");
    saveButton.style.backgroundColor = "#175dce";
  }, 2000);
}

// 설정을 초기화합니다
function resetSettings() {
  if (confirm(i18n.get("options", "resetConfirm"))) {
    chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, function () {
      settings = { ...DEFAULT_SETTINGS };
      updateMainTabUI();
      updateSettingsTabUI();

      // 알람을 재설정합니다
      chrome.runtime.sendMessage({ action: "resetAlarm" });

      // 초기화 피드백을 표시합니다
      resetButtonOptions.textContent = "Reset!";
      setTimeout(() => {
        resetButtonOptions.textContent = i18n.get("options", "reset");
      }, 2000);
    });
  }
}

// 인터벌 프리셋 클릭 이벤트
intervalPresets.forEach((preset) => {
  preset.addEventListener("click", function () {
    const value = parseInt(this.dataset.value);
    customIntervalInput.value = value;

    // 활성 클래스를 업데이트합니다
    intervalPresets.forEach((p) => p.classList.remove("active"));
    this.classList.add("active");
  });
});

// 이벤트 리스너 등록 - 메인 탭
pauseButton.addEventListener("click", togglePause);
resetButton.addEventListener("click", resetAlarm);
intervalSelect.addEventListener("change", changeInterval);

// 이벤트 리스너 등록 - 설정 탭
customIntervalInput.addEventListener("change", validateCustomInterval);
saveButton.addEventListener("click", saveSettings);
resetButtonOptions.addEventListener("click", resetSettings);

// 페이지가 닫힐 때 타이머 인터벌 정리
window.addEventListener("unload", () => {
  clearInterval(timerInterval);
});
