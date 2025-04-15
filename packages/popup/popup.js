// 메인 탭 요소들
const nextReminderElement = document.getElementById("next-reminder");
const pauseButton = document.getElementById("pause-btn");
const resetButton = document.getElementById("reset-btn");
const intervalSelect = document.getElementById("interval-select");
const tipTitle = document.getElementById("tip-title");
const tipDescription = document.getElementById("tip-description");
const containerSection = document.querySelector(".container");

// 시작 버튼 섹션 요소 선언
let startButtonSection;

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
  interval: 5, // 기본 5분 간격
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
  timerStarted: false, // 타이머 시작 여부 추가
};

// 현재 설정
let settings = { ...DEFAULT_SETTINGS };

// 타이머 업데이트 인터벌 ID
let timerInterval;

// 현재 알람 정보
let currentAlarm = null;

// 일시 정지 시 남은 시간을 저장하는 변수 (밀리초 단위)
let pausedTimeLeft = 0;

// 서비스워커 킵얼라이브 인터벌 ID
let keepAliveInterval;

// 서비스워커 상태 확인 인터벌 ID
let checkInterval;

// 마지막으로 서비스워커 상태를 확인한 시간
let lastCheckedTime = 0;

// 번역 기능 초기화
document.addEventListener("DOMContentLoaded", async () => {
  // 언어 유틸리티 초기화
  await i18n.init("popup");

  // options 섹션 번역 로드
  i18n.loadSection("options");

  // 시작 버튼 섹션 생성
  createStartButtonSection();

  // 기존 초기화 함수 호출
  loadSettings();
  loadStretchingTip();
  initTabSystem();

  // 서비스 워커 상태 확인 시작
  startServiceWorkerMonitoring();
});

// 서비스 워커 모니터링 시작
function startServiceWorkerMonitoring() {
  // 기존 킵얼라이브 메커니즘 향상
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }

  // 더 짧은 간격으로 킵얼라이브 메시지를 보냄
  keepAliveInterval = setInterval(() => {
    // 타이머가 시작되지 않았으면 킵얼라이브 메시지를 보내지 않음
    if (!settings.timerStarted) {
      return;
    }

    // 서비스 워커에 킵얼라이브 메시지를 보냄
    chrome.runtime.sendMessage({ action: "keepAlive" }, (response) => {
      if (response && response.success) {
        console.log(
          "서비스 워커 활성화 상태 유지 중: " + new Date().toLocaleTimeString()
        );
      }
    });
  }, 15000); // 15초마다 킵얼라이브 메시지 보내기

  // 주기적으로 알림 상태를 확인하고 정리하는 인터벌
  if (checkInterval) {
    clearInterval(checkInterval);
  }

  checkInterval = setInterval(checkNotifications, 30000); // 30초마다 알림 상태 확인
}

// 알림 상태 확인 및 정리
function checkNotifications() {
  // 타이머가 시작되지 않았으면 실행하지 않음
  if (!settings.timerStarted) {
    return;
  }

  // 마지막 확인 이후 너무 짧은 시간이 지나지 않았으면 실행하지 않음
  const now = Date.now();
  if (now - lastCheckedTime < 25000) {
    // 25초 이내에는 중복 실행 방지
    return;
  }

  lastCheckedTime = now;

  // 알림 상태 확인 메시지 전송
  chrome.runtime.sendMessage({ action: "checkNotifications" }, (response) => {
    if (response && response.success) {
      console.log(`알림 상태 확인 완료: ${response.activeCount}개 활성 알림`);
    } else {
      console.warn("알림 상태 확인 실패");

      // 서비스 워커가 비활성화된 경우 재시작 시도
      if (chrome.runtime.lastError) {
        console.warn(
          "서비스 워커가 비활성화된 것으로 보입니다. 재활성화 시도 중..."
        );
        // 알람 설정을 초기화하여 서비스 워커를 재활성화
        chrome.runtime.sendMessage({ action: "resetAlarm" });
      }
    }
  });
}

// 시작 버튼 섹션 생성
function createStartButtonSection() {
  startButtonSection = document.createElement("div");
  startButtonSection.className = "start-button-section";
  startButtonSection.style.textAlign = "center";
  startButtonSection.style.padding = "0";
  startButtonSection.style.display = "none"; // 초기에는 숨김 처리
}

// 시작 버튼 표시
function showStartButton() {
  // 기존 타이머 컨트롤 숨기기
  const timerControls = document.querySelector(".timer-controls");
  if (timerControls) {
    timerControls.style.display = "none";
  }

  // 시작 버튼 섹션 내용 설정
  startButtonSection.innerHTML = `
    <button id="start-timer-btn" data-i18n="startTimerBtn" data-i18n-section="popup" style="background-color: #28a745; font-size: 16px; padding: 10px 20px; display:inline-block;">${
      i18n.get("popup", "startTimerBtn") || "Start Timer"
    }</button>
    <p data-i18n="startTimerDesc" data-i18n-section="popup" style="margin-top: 10px; color: #777; font-size: 12px;">${
      i18n.get("popup", "startTimerDesc") ||
      "Click to start for posture reminder"
    }</p>
  `;

  // 시작 버튼 섹션을 타이머 디스플레이 다음에 삽입
  const timerDisplay = document.querySelector(".timer-display");
  if (timerDisplay && !document.querySelector(".start-button-section")) {
    timerDisplay.parentNode.insertBefore(
      startButtonSection,
      timerDisplay.nextSibling
    );
  }

  startButtonSection.style.display = "block";

  // 시작 버튼 이벤트 리스너 추가
  document
    .getElementById("start-timer-btn")
    .addEventListener("click", startTimer);
}

// 시작 버튼 숨기기
function hideStartButton() {
  if (startButtonSection) {
    startButtonSection.style.display = "none";
  }

  // 타이머 컨트롤 표시
  const timerControls = document.querySelector(".timer-controls");
  if (timerControls) {
    timerControls.style.display = "flex";
  }
}

// 타이머 시작하기
function startTimer() {
  // 설정 업데이트
  settings.timerStarted = true;
  chrome.storage.sync.set({ settings });

  // 시작 버튼 숨기기
  hideStartButton();

  // 타이머 UI 표시
  const interval = settings.interval || 30;
  nextReminderElement.textContent = `${padZero(interval)}:00`;

  // 새로운 'startTimer' 액션을 사용하여 background.js에 타이머 시작 요청
  chrome.runtime.sendMessage({ action: "startTimer" }, (response) => {
    if (response && response.success) {
      console.log("타이머가 시작되었습니다.");

      // 타이머 업데이트 시작
      startTimerUpdate();

      // 서비스워커 모니터링 시작
      startServiceWorkerMonitoring();
    } else {
      console.error("타이머 시작 실패:", response?.message);
    }
  });
}

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

      if (tabId === "settings") {
        // 설정 탭이 열릴 때 설정을 로드
        updateSettingsTabUI();
      }
    });
  });
}

// 설정을 로드
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

      // 타이머가 시작되지 않았으면 시작 버튼 표시
      if (!settings.timerStarted) {
        showStartButton();
      } else {
        hideStartButton();
        // 타이머 업데이트 시작
        startTimerUpdate();
        // 서비스워커 모니터링 시작
        startServiceWorkerMonitoring();
      }
    } else {
      // 설정이 없으면 기본값 저장
      chrome.storage.sync.set({ settings });
      intervalSelect.value = settings.interval;
      nextReminderElement.innerHTML = `<span class="paused">${padZero(
        settings.interval
      )}:00</span>`;
      showStartButton();
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

// 메인 탭 UI를 업데이트
function updateMainTabUI() {
  intervalSelect.value = settings.interval;
  updatePauseButtonState();
  // nextReminderElement.textContent = `${padZero(settings.interval)}:00`;
  nextReminderElement.innerHTML = `<span class="paused">${padZero(
    settings.interval
  )}:00</span>`;
}

// 인터벌 프리셋 UI를 업데이트
function updateIntervalPresetsUI(number) {
  intervalPresets.forEach((preset) => {
    const value = parseInt(preset.dataset.value);
    if (value === number) {
      preset.classList.add("active");
    } else {
      preset.classList.remove("active");
    }
  });
}

// 설정 탭 UI를 업데이트
function updateSettingsTabUI() {
  customIntervalInput.value = settings.interval;
  notificationsToggle.checked = settings.notifications;
  exercisesToggle.checked = settings.exercises;

  // 언어 선택 UI 업데이트
  languageSelect.value = settings.language || "en";

  updateIntervalPresetsUI(settings.interval); // 인터벌 프리셋 업데이트

  // 카테고리 체크박스를 업데이트
  categoryCheckboxes.forEach((checkbox) => {
    const category = checkbox.dataset.category;
    if (settings.categories && settings.categories[category] !== undefined) {
      checkbox.checked = settings.categories[category];
    }
  });

  // 작업 시간 설정을 업데이트
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

  // 재시작 버튼
  if (resetButton) {
    resetButton.querySelector("[data-i18n='restart']").textContent = i18n.get(
      "popup",
      "restart"
    );
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

// 타이머 업데이트를 시작
async function startTimerUpdate() {
  // 타이머 인터벌이 이미 있으면 제거
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  // 첫 업데이트 실행
  await updateTimer();

  // 타이머 인터벌 설정 (1초마다 업데이트)
  timerInterval = setInterval(async () => {
    await updateTimer();
  }, 1000);

  console.log("타이머 업데이트 시작됨: " + new Date().toLocaleTimeString());
}

// 킵얼라이브 메커니즘 시작
function startKeepAlive() {
  // 기존 킵얼라이브 인터벌이 있으면 제거
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }

  // 새로운 킵얼라이브 인터벌 설정 (더 짧은 간격으로)
  keepAliveInterval = setInterval(() => {
    // 타이머가 시작되지 않았거나 일시 정지 상태인 경우 킵얼라이브 메시지를 보내지 않음
    if (!settings.timerStarted || settings.isPaused) {
      return;
    }

    // 서비스 워커에 킵얼라이브 메시지를 보냄
    chrome.runtime.sendMessage({ action: "keepAlive" }, (response) => {
      if (response && response.success) {
        console.log(
          "서비스 워커 활성화 상태 유지 중: " + new Date().toLocaleTimeString()
        );
      } else if (chrome.runtime.lastError) {
        console.warn(
          "서비스 워커에 연결할 수 없습니다. 재활성화를 시도합니다."
        );
        // 알람 재설정 시도
        chrome.runtime.sendMessage({ action: "resetAlarm" });
      }
    });
  }, 15000); // 15초마다 킵얼라이브 메시지 보내기
}

// 타이머 표시를 업데이트
function updateTimer() {
  return new Promise((resolve) => {
    if (settings.isPaused && pausedTimeLeft > 0) {
      // 일시 정지 상태에서는 마지막으로 저장된 시간을 표시
      const totalSeconds = Math.floor(pausedTimeLeft / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      nextReminderElement.innerHTML = `
        <span class="paused">${padZero(minutes)}:${padZero(seconds)}</span>
      `;
      resolve();
      return;
    }

    if (!settings.timerStarted) {
      // 타이머가 시작되지 않은 경우
      nextReminderElement.innerHTML = `<span class="paused">${padZero(
        settings.interval
      )}:00</span>`;
      resolve();
      return;
    }

    chrome.alarms.get("postureReminderAlarm", (alarm) => {
      currentAlarm = alarm;

      if (alarm && !settings.isPaused) {
        const now = Date.now();
        const alarmTime = alarm.scheduledTime;
        const timeLeft = Math.max(0, alarmTime - now);

        // 시간과 초를 직접 계산
        const totalSeconds = Math.floor(timeLeft / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        // 디버그 로그는 30초마다 출력 (너무 많은 로그 방지)
        if (seconds % 30 === 0 || seconds === 0) {
          console.log(
            `타이머 업데이트: ${padZero(minutes)}:${padZero(
              seconds
            )} (${new Date().toLocaleTimeString()})`
          );
        }

        nextReminderElement.textContent = `${padZero(minutes)}:${padZero(
          seconds
        )}`;
      } else {
        // 알람이 없거나 남은 시간이 없을 때
        nextReminderElement.textContent = `${padZero(settings.interval)}:00`;
      }
      resolve();
    });
  });
}

// 숫자를 2자리로 패딩
function padZero(num) {
  return num.toString().padStart(2, "0");
}

// 일시정지 버튼 상태를 업데이트
function updatePauseButtonState() {
  if (settings.isPaused) {
    pauseButton.classList.add("paused");
    pauseButton.querySelector("[data-i18n='pauseBtn']").textContent = i18n.get(
      "popup",
      "resumeBtn"
    );
    // pauseButton.setAttribute("title", i18n.get("popup", "resumeBtn"));
  } else {
    pauseButton.classList.remove("paused");
    pauseButton.querySelector("[data-i18n='pauseBtn']").textContent = i18n.get(
      "popup",
      "pauseBtn"
    );
    // pauseButton.setAttribute("title", i18n.get("popup", "pauseBtn"));
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

    // 알람을 일시정지
    chrome.alarms.clear("postureReminderAlarm");
    // 준비 알람도 일시정지
    chrome.alarms.clear("postureReminderPrepare");

    // 킵얼라이브 중지
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
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

      // 킵얼라이브 다시 시작
      startKeepAlive();
    } else {
      // 저장된 시간이 없으면 기본 간격으로 재설정
      chrome.runtime.sendMessage({ action: "resetAlarm" });

      // 킵얼라이브 다시 시작
      startKeepAlive();
    }
  }

  updatePauseButtonState();
}

// 알람을 리셋
function resetAlarm() {
  settings.isPaused = false;
  chrome.storage.sync.set({ settings });
  chrome.runtime.sendMessage({ action: "resetAlarm" });
  updatePauseButtonState();

  // 킵얼라이브 재시작
  startKeepAlive();
}

// Quick Settings 타이머 간격을 변경
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
    nextReminderElement.innerHTML = settings.timerStarted
      ? `${padZero(settings.interval)}:00`
      : `<span class="paused">${padZero(settings.interval)}:00</span>`;
    resetAlarm();
  }
}

// 오늘의 스트레칭 팁을 로드
function loadStretchingTip() {
  // 파라미터로 전달된 language를 사용하거나, 없으면 현재 설정에서 가져옴
  const language = settings.language || "en";

  const exercisesFile =
    language === "ko" ? "../data/exercises_kr.json" : "../data/exercises.json";

  fetch(exercisesFile)
    .then((response) => response.json())
    .then((exercises) => {
      if (exercises.length > 0) {
        const randomIndex = Math.floor(Math.random() * exercises.length);
        const tip = exercises[randomIndex];
        tipTitle.textContent = tip.title;
        tipDescription.textContent = tip.description;
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
  updateIntervalPresetsUI(value); // 프리셋 UI 업데이트
}

// 설정을 저장
function saveSettings() {
  // 카테고리 설정을 수집
  const categories = {};
  categoryCheckboxes.forEach((checkbox) => {
    const category = checkbox.dataset.category;
    categories[category] = checkbox.checked;
  });

  // 커스텀 인터벌 값 유효성 검증
  validateCustomInterval();

  // 새 설정 객체를 생성 (timerStarted 상태 유지)
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
    timerStarted: settings.timerStarted, // 타이머 시작 상태 유지
  };

  // 설정을 저장
  chrome.storage.sync.set({ settings }, function () {
    // 알람을 재설정 (만약 일시정지 상태가 아니고 타이머가 시작되었다면)
    if (!settings.isPaused && settings.timerStarted) {
      chrome.runtime.sendMessage({ action: "resetAlarm" });
    }

    // 메인 탭 UI도 업데이트
    updateMainTabUI();

    // 인터벌 프리셋 업데이트
    updateIntervalPresetsUI(settings.interval);

    updateDynamicTexts(settings.language);

    // 저장 피드백을 표시
    showSavedFeedbackUI();
  });
}

// 저장 피드백을 표시
function showSavedFeedbackUI() {
  saveButton.textContent = i18n.get("options", "saved");
  saveButton.style.backgroundColor = "#28a745";

  setTimeout(() => {
    saveButton.textContent = i18n.get("options", "save");
    saveButton.style.backgroundColor = "#175dce";
  }, 2000);
}

// 설정을 초기화
function resetSettings() {
  if (confirm(i18n.get("options", "resetConfirm"))) {
    // 킵얼라이브 중지
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }

    chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, function () {
      settings = { ...DEFAULT_SETTINGS };

      // 알람을 중지
      chrome.alarms.clear("postureReminderAlarm");
      chrome.alarms.clear("postureReminderPrepare");

      updateAllUIElements();

      // 시작 버튼 표시
      showStartButton();

      // 초기화 피드백을 표시
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

    // 활성 클래스를 업데이트
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
customIntervalInput.addEventListener("keyup", (e) => {
  updateIntervalPresetsUI(parseInt(e.target.value));
});
saveButton.addEventListener("click", saveSettings);
resetButtonOptions.addEventListener("click", resetSettings);

// 페이지가 닫힐 때 타이머 인터벌 정리
window.addEventListener("unload", () => {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }

  if (checkInterval) {
    clearInterval(checkInterval);
  }

  // 팝업이 닫히기 전에 마지막으로 서비스 워커 활성화 요청 보내기
  if (settings.timerStarted && !settings.isPaused) {
    // 비동기이지만 팝업이 닫히기 전에 메시지가 전달되도록 시도
    try {
      chrome.runtime.sendMessage({
        action: "keepAlive",
        isClosing: true, // 팝업이 닫히는 중임을 알림
      });

      // 알람 재설정 요청도 함께 보냄
      chrome.runtime.sendMessage({ action: "resetAlarm" });
    } catch (e) {
      console.error("팝업 닫기 전 메시지 전송 실패:", e);
    }
  }
});
