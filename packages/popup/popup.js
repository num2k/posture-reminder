// ===============================
// 상수 및 설정
// ===============================
const APP_CONSTANTS = {
  DEFAULT_INTERVAL: 5, // 기본 타이머 간격(분)
  MIN_INTERVAL: 1, // 최소 타이머 간격(분)
  MAX_INTERVAL: 180, // 최대 타이머 간격(분)
  ZERO_DISPLAY_TIME: 1000, // 0초 표시 시간(밀리초)
  FEEDBACK_DISPLAY_TIME: 2000, // 피드백 메시지 표시 시간(밀리초)
};

// 기본 설정
const DEFAULT_SETTINGS = {
  interval: APP_CONSTANTS.DEFAULT_INTERVAL, // 기본 5분 간격
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
  timerStarted: false, // 타이머 시작 여부
};

// 현재 설정
let settings = { ...DEFAULT_SETTINGS };

// 타이머 관련 변수
let pausedTimeLeft = 0; // 일시 정지 시 남은 시간(밀리초)
let timerInterval = null; // 타이머 인터벌 참조 (정리용)

// ===============================
// DOM 요소 선택자
// ===============================
const DOM = {
  // 메인 탭 요소
  nextReminder: document.getElementById("next-reminder"),
  pauseButton: document.getElementById("pause-btn"),
  resetButton: document.getElementById("reset-btn"),
  intervalSelect: document.getElementById("interval-select"),
  tipTitle: document.getElementById("tip-title"),
  tipDescription: document.getElementById("tip-description"),
  containerSection: document.querySelector(".container"),

  // 설정 탭 요소
  customIntervalInput: document.getElementById("custom-interval"),
  intervalPresets: document.querySelectorAll(".interval-preset"),
  notificationsToggle: document.getElementById("notifications-toggle"),
  exercisesToggle: document.getElementById("exercises-toggle"),
  categoryCheckboxes: document.querySelectorAll(".category-item input"),
  workStartInput: document.getElementById("work-start"),
  workEndInput: document.getElementById("work-end"),
  workHoursOnlyToggle: document.getElementById("work-hours-only"),
  languageSelect: document.getElementById("language-select"),
  saveButton: document.getElementById("save-btn"),
  resetButtonOptions: document.getElementById("reset-btn-options"),

  // 탭 관련 요소
  tabButtons: document.querySelectorAll(".tab-button"),
  tabContents: document.querySelectorAll(".tab-content"),
};

// 시작 버튼 섹션 요소 선언 (동적 생성)
let startButtonSection;

// ===============================
// 유틸리티 함수
// ===============================

// 숫자를 2자리로 패딩
function padZero(num) {
  return num.toString().padStart(2, "0");
}

/**
 * 타이머 표시를 업데이트하는 유틸리티 함수
 * 모든 타이머 표시 로직을 한 곳에서 처리하여 코드 중복 제거
 *
 * @param {number} minutes - 표시할 분
 * @param {number} seconds - 표시할 초 (없으면 00으로 표시)
 * @param {boolean} isPaused - 일시정지 상태 여부
 */
function updateTimerDisplay(minutes, seconds = 0, isPaused = false) {
  if (isPaused) {
    DOM.nextReminder.innerHTML = `<span class="paused">${padZero(
      minutes
    )}:${padZero(seconds)}</span>`;
  } else {
    DOM.nextReminder.textContent = `${padZero(minutes)}:${padZero(seconds)}`;
  }
}

// ===============================
// 타이머 클래스 정의
// ===============================
class PreciseTimer {
  constructor(displayElement) {
    this.displayElement = displayElement;
    this.startTime = 0; // 타이머 시작 시간 (밀리초 단위)
    this.duration = 0; // 타이머 지속 시간 (밀리초 단위)
    this.isRunning = false; // 타이머 실행 상태
    this.isPaused = false; // 일시정지 상태
    this.remainingTime = 0; // 일시정지 시 남은 시간
    this.animFrameId = null; // requestAnimationFrame ID
    this.onComplete = null; // 타이머 완료 콜백
    this.lastSecondTime = 0; // 마지막으로 초가 변경된 시간
    this.isFirstCycle = true; // 첫 번째 사이클인지 여부
  }

  // 타이머 시작
  start(durationMinutes, callback) {
    // 콜백 설정
    this.onComplete = callback || null;

    // 이전 타이머 관련 자원 정리
    this.cleanup();

    // 타이머 시간 계산 (밀리초)
    this.duration = durationMinutes * 60 * 1000;
    this.startTime = Date.now();
    this.isRunning = true;
    this.isPaused = false;
    this.lastSecondTime = this.startTime;

    // 애니메이션 프레임 시작
    this.update();

    console.log(
      `타이머 시작: ${durationMinutes}분, 종료 시간: ${new Date(
        this.startTime + this.duration
      ).toLocaleTimeString()}`
    );
  }

  // 타이머 업데이트 (애니메이션 프레임 사용)
  update = () => {
    if (!this.isRunning || this.isPaused) return;

    const now = Date.now();
    const elapsedTime = now - this.startTime;
    const timeLeft = Math.max(0, this.duration - elapsedTime);

    // 남은 시간 계산
    const totalSeconds = Math.ceil(timeLeft / 1000); // 올림 처리하여 항상 1초부터 표시 시작
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    // UI 업데이트 - 초가 변경될 때만 업데이트
    const currentSecond = Math.floor(timeLeft / 1000);
    const prevSecond = Math.floor((now - 10 - this.startTime) / 1000);

    if (currentSecond !== prevSecond) {
      this.displayTime(minutes, seconds);
      this.lastSecondTime = now;
    }

    // 타이머 완료 확인
    if (timeLeft <= 0) {
      // 0초에 도달하면 정확히 0:00 표시
      this.displayTime(0, 0);

      // 타이머 정리
      this.isRunning = false;
      this.isFirstCycle = false;

      // 애니메이션 프레임 취소
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }

      // 콜백 함수 호출 (다음 사이클로 넘어가기 위해)
      if (this.onComplete && typeof this.onComplete === "function") {
        setTimeout(() => {
          this.onComplete();
        }, APP_CONSTANTS.ZERO_DISPLAY_TIME); // 0초를 정확히 1초간 표시하기 위해 지연
      }

      return;
    }

    // 다음 프레임 요청
    this.animFrameId = requestAnimationFrame(this.update);
  };

  // 시간 표시 함수
  displayTime(minutes, seconds) {
    if (this.displayElement) {
      if (this.isPaused) {
        this.displayElement.innerHTML = `<span class="paused">${padZero(
          minutes
        )}:${padZero(seconds)}</span>`;
      } else {
        this.displayElement.textContent = `${padZero(minutes)}:${padZero(
          seconds
        )}`;
      }
    }
  }

  // 타이머 일시정지
  pause() {
    if (this.isRunning && !this.isPaused) {
      this.isPaused = true;
      const now = Date.now();
      const elapsedTime = now - this.startTime;
      this.remainingTime = Math.max(0, this.duration - elapsedTime);
      this.cleanup(); // 모든 타이머 정리

      // 일시정지된 시간을 표시
      const totalSeconds = Math.ceil(this.remainingTime / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      this.displayElement.innerHTML = `<span class="paused">${padZero(
        minutes
      )}:${padZero(seconds)}</span>`;

      console.log(
        `타이머 일시정지: 남은 시간 ${Math.floor(this.remainingTime / 1000)}초`
      );
    }
  }

  // 타이머 재개
  resume() {
    if (this.isPaused && this.remainingTime > 0) {
      this.isPaused = false;
      this.duration = this.remainingTime;
      this.startTime = Date.now();
      this.lastSecondTime = this.startTime;
      this.isRunning = true;
      this.update();
      console.log(
        `타이머 재개: 남은 시간 ${Math.floor(this.remainingTime / 1000)}초`
      );
    }
  }

  // 타이머 리셋
  reset() {
    this.cleanup();
    this.isRunning = false;
    this.isPaused = false;
    this.remainingTime = 0;
  }

  // 모든 타이머 자원 정리
  cleanup() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  // 현재 남은 시간 가져오기 (밀리초)
  getRemainingTime() {
    if (!this.isRunning && !this.isPaused) return 0;
    if (this.isPaused) return this.remainingTime;

    const now = Date.now();
    const elapsedTime = now - this.startTime;
    return Math.max(0, this.duration - elapsedTime);
  }
}

// 타이머 인스턴스 생성
const preciseTimer = new PreciseTimer(DOM.nextReminder);

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
  settings.isPaused = false;

  // 시작 버튼 숨기기
  hideStartButton();

  // 설정 저장
  chrome.storage.sync.set({ settings }, () => {
    chrome.runtime.sendMessage({ action: "startTimer" }, (response) => {
      if (response && response.success) {
        console.log("타이머가 시작되었습니다.");

        // 정밀한 타이머 시작
        preciseTimer.start(settings.interval, onTimerComplete);
      } else {
        console.error("타이머 시작 실패:", response?.message);
      }
    });
  });
}

// 타이머 완료 시 호출되는 콜백
function onTimerComplete() {
  // 다음 타이머 시작 준비
  const newMinutes = settings.interval <= 1 ? 0 : settings.interval - 1;
  updateTimerDisplay(newMinutes, 59, false);

  // 백그라운드에 알람 재설정 요청
  chrome.runtime.sendMessage({ action: "resetAlarm" }, (response) => {
    if (response && response.success) {
      console.log(
        `알람 재설정 성공, 다음 알람 예정: ${new Date(
          response.nextAlarmAt
        ).toLocaleTimeString()}`
      );

      // 새 타이머 시작 (초기 시간을 59초로 설정)
      // 타이머 시간에서 1초를 빼서 정확히 MM:59부터 시작하도록 함
      preciseTimer.start(settings.interval - 1 / 60, onTimerComplete);
    } else {
      console.error("알람 재설정 실패:", response?.message);

      // 실패해도 새 타이머는 시작 (초기 시간을 59초로 설정)
      preciseTimer.start(settings.interval - 1 / 60, onTimerComplete);
    }
  });
}

// 타이머 중지
function stopTimer() {
  // 타이머 중지 상태로 설정
  settings.timerStarted = false;
  settings.isPaused = false;

  // 설정 저장
  chrome.storage.sync.set({ settings });

  // 정밀 타이머 리셋
  preciseTimer.reset();

  // 타이머 초기화 (설정된 인터벌 시간 표시)
  updateTimerDisplay(settings.interval, 0, true);

  // 백그라운드 서비스에 타이머 중지 요청
  chrome.runtime.sendMessage({ action: "stopTimer" }, (response) => {
    if (response && response.success) {
      console.log("타이머가 중지되었습니다.");

      // 시작 버튼 표시
      showStartButton();
    } else {
      console.error(
        "타이머 중지 실패:",
        chrome.runtime.lastError || "알 수 없는 오류"
      );
    }
  });
}

// 알람 일시정지/재개 토글
function togglePause() {
  const wasPaused = settings.isPaused;

  if (!wasPaused) {
    // 일시 정지
    settings.isPaused = true;
    preciseTimer.pause();

    // 남은 시간 저장
    pausedTimeLeft = preciseTimer.getRemainingTime();
    chrome.storage.sync.set({ settings, pausedTimeLeft });

    // 알람을 일시정지
    chrome.alarms.clear("postureReminderAlarm");
    chrome.alarms.clear("postureReminderPrepare");

    // UI 업데이트
    updatePauseButtonState();
  } else {
    // 재개
    settings.isPaused = false;
    chrome.storage.sync.set({ settings });

    if (pausedTimeLeft > 0) {
      // 남은 시간을 분 단위로 변환 (소수점 포함)
      const remainingMinutes = pausedTimeLeft / (60 * 1000);

      // 특정 시간으로 알람을 재설정하는 메시지 전송
      chrome.runtime.sendMessage({
        action: "resumeAlarm",
        delayInMinutes: remainingMinutes,
      });

      // 타이머 재개
      preciseTimer.resume();

      // 저장된 시간 초기화
      pausedTimeLeft = 0;
      chrome.storage.sync.remove("pausedTimeLeft");
    } else {
      // 저장된 시간이 없으면 기본 간격으로 재설정
      chrome.runtime.sendMessage({ action: "resetAlarm" });
      preciseTimer.start(settings.interval, onTimerComplete);
    }

    // UI 업데이트
    updatePauseButtonState();
  }
}

// 알람 리셋
function resetAlarm() {
  settings.isPaused = false;
  chrome.storage.sync.set({ settings });
  chrome.runtime.sendMessage({ action: "resetAlarm" }, (response) => {
    if (response && response.success) {
      // 타이머 재시작
      preciseTimer.reset();
      preciseTimer.start(settings.interval, onTimerComplete);
    }
  });
  updatePauseButtonState();
}

// 탭 시스템 초기화
function initTabSystem() {
  DOM.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // 모든 탭 버튼에서 active 클래스 제거
      DOM.tabButtons.forEach((btn) => btn.classList.remove("active"));

      // 클릭한 버튼에 active 클래스 추가
      button.classList.add("active");

      // 모든 탭 컨텐츠 숨기기
      DOM.tabContents.forEach((content) => (content.style.display = "none"));

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

      // 타이머 상태에 따라 UI 초기화
      if (!settings.timerStarted) {
        showStartButton();
      } else {
        hideStartButton();
        // 타이머 상태 복원
        if (settings.timerStarted && !settings.isPaused) {
          // 알람 정보를 가져와서 남은 시간 계산
          chrome.alarms.get("postureReminderAlarm", (alarm) => {
            if (alarm) {
              const now = Date.now();
              const timeLeft = Math.max(0, alarm.scheduledTime - now);
              const minutes = timeLeft / (60 * 1000);

              // 정밀 타이머 시작
              preciseTimer.start(minutes, onTimerComplete);
            } else {
              // 알람이 없으면 기본 간격으로 시작
              preciseTimer.start(settings.interval, onTimerComplete);
            }
          });
        } else if (
          settings.timerStarted &&
          settings.isPaused &&
          pausedTimeLeft > 0
        ) {
          // 일시정지 상태 복원
          const minutes = Math.floor(pausedTimeLeft / 60000);
          const seconds = Math.floor((pausedTimeLeft % 60000) / 1000);
          updateTimerDisplay(minutes, seconds, true);
        }
      }
    } else {
      // 설정이 없으면 기본값 저장
      chrome.storage.sync.set({ settings });
      DOM.intervalSelect.value = settings.interval;
      updateTimerDisplay(settings.interval, 0, true);
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
  DOM.intervalSelect.value = settings.interval;
  updatePauseButtonState();

  // 일시 정지 상태일 때는 타이머 표시를 업데이트하지 않음
  if (settings.isPaused) {
    return; // 일시 정지 중에는 타이머 표시 유지
  }

  if (settings.timerStarted && !settings.isPaused) {
    // 타이머 실행 중인 경우는 preciseTimer에 맡김
    if (!preciseTimer.isRunning) {
      chrome.alarms.get("postureReminderAlarm", (alarm) => {
        if (alarm) {
          const now = Date.now();
          const timeLeft = Math.max(0, alarm.scheduledTime - now);
          const minutes = timeLeft / (60 * 1000);
          preciseTimer.start(minutes, onTimerComplete);
        } else {
          preciseTimer.start(settings.interval, onTimerComplete);
        }
      });
    }
  } else if (!settings.timerStarted) {
    // 타이머가 시작되지 않은 경우만 기본 인터벌 시간 표시
    updateTimerDisplay(settings.interval, 0, true);
  }
}

// 인터벌 프리셋 UI를 업데이트
function updateIntervalPresetsUI(number) {
  DOM.intervalPresets.forEach((preset) => {
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
  DOM.customIntervalInput.value = settings.interval;
  DOM.notificationsToggle.checked = settings.notifications;
  DOM.exercisesToggle.checked = settings.exercises;

  // 언어 선택 UI 업데이트
  DOM.languageSelect.value = settings.language || "en";

  updateIntervalPresetsUI(settings.interval); // 인터벌 프리셋 업데이트

  // 카테고리 체크박스를 업데이트
  DOM.categoryCheckboxes.forEach((checkbox) => {
    const category = checkbox.dataset.category;
    if (settings.categories && settings.categories[category] !== undefined) {
      checkbox.checked = settings.categories[category];
    }
  });

  // 작업 시간 설정을 업데이트
  DOM.workStartInput.value = settings.workStart;
  DOM.workEndInput.value = settings.workEnd;
  DOM.workHoursOnlyToggle.checked = settings.workHoursOnly;
}

// data-i18n 속성이 없는 동적 텍스트 요소들을
// 수동으로 번역하는 함수
function updateDynamicTexts(lang) {
  // 인터벌 프리셋 버튼 텍스트 업데이트
  DOM.intervalPresets.forEach((preset) => {
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
  if (DOM.resetButton) {
    DOM.resetButton.querySelector("[data-i18n='restart']").textContent =
      i18n.get("popup", "restart");
  }

  // 저장 및 재설정 버튼 텍스트 업데이트
  if (DOM.saveButton) {
    DOM.saveButton.textContent = i18n.get("options", "save");
  }

  if (DOM.resetButtonOptions) {
    DOM.resetButtonOptions.textContent = i18n.get("options", "reset");
  }

  // 스트레칭 팁 다시 로드
  loadStretchingTip();
}

// 일시정지 버튼 상태를 업데이트
function updatePauseButtonState() {
  if (settings.isPaused) {
    DOM.pauseButton.classList.add("paused");
    DOM.pauseButton.querySelector("[data-i18n='pauseBtn']").textContent =
      i18n.get("popup", "resumeBtn");
  } else {
    DOM.pauseButton.classList.remove("paused");
    DOM.pauseButton.querySelector("[data-i18n='pauseBtn']").textContent =
      i18n.get("popup", "pauseBtn");
  }
}

// Quick Settings 타이머 간격을 변경
function changeInterval() {
  // 이전 인터벌 값 저장
  const oldInterval = settings.interval;
  const newInterval = parseInt(DOM.intervalSelect.value);

  // 설정 값만 업데이트하고 저장
  settings.interval = newInterval;
  DOM.customIntervalInput.value = newInterval; // 설정 탭 동기화
  updateIntervalPresetsUI(newInterval); // 프리셋 UI 업데이트
  chrome.storage.sync.set({ settings });

  console.log(`인터벌 변경: ${oldInterval}분 → ${newInterval}분`);

  // 일시 정지 상태일 때는 UI 업데이트하지 않음 (다음 사이클부터 적용)
  if (settings.isPaused) {
    console.log("일시 정지 상태에서 인터벌 변경: 다음 사이클부터 적용됩니다.");
    return;
  }

  // 타이머가 시작되지 않은 경우는 UI만 업데이트
  if (!settings.timerStarted) {
    updateTimerDisplay(settings.interval, 0, true);
    return;
  }

  // 타이머가 실행 중이고 일시 정지 아닌 경우에만 즉시 재설정
  resetAlarm();
}

// 설정을 저장
function saveSettings() {
  // 카테고리 설정을 수집
  const categories = {};
  DOM.categoryCheckboxes.forEach((checkbox) => {
    const category = checkbox.dataset.category;
    categories[category] = checkbox.checked;
  });

  // 커스텀 인터벌 값 유효성 검증
  validateCustomInterval();

  // 이전 인터벌 값 저장 (변경 여부 확인용)
  const previousInterval = settings.interval;
  const newInterval = parseInt(DOM.customIntervalInput.value);
  const intervalChanged = previousInterval !== newInterval;

  // 새 설정 객체를 생성 (timerStarted 상태 유지)
  settings = {
    interval: newInterval,
    notifications: DOM.notificationsToggle.checked,
    exercises: DOM.exercisesToggle.checked,
    language: DOM.languageSelect.value,
    categories: categories,
    workStart: DOM.workStartInput.value,
    workEnd: DOM.workEndInput.value,
    workHoursOnly: DOM.workHoursOnlyToggle.checked,
    isPaused: false, // 설정 변경 시 일시정지 상태 해제
    timerStarted: settings.timerStarted, // 타이머 시작 상태 유지
  };

  // 설정을 저장
  chrome.storage.sync.set({ settings, pausedTimeLeft: 0 }, function () {
    // 메인 탭의 인터벌 선택도 업데이트
    DOM.intervalSelect.value = settings.interval;

    // 타이머가 시작된 상태라면 무조건 재시작
    if (settings.timerStarted) {
      console.log(`설정 저장: 인터벌 ${settings.interval}분으로 타이머 재시작`);

      // 알람 재설정 및 타이머 재시작
      preciseTimer.reset();
      chrome.runtime.sendMessage({ action: "resetAlarm" }, (response) => {
        if (response && response.success) {
          preciseTimer.start(settings.interval, onTimerComplete);
        }
      });

      // UI 상태 업데이트 (일시정지 버튼)
      updatePauseButtonState();
    } else {
      // 타이머가 시작되지 않은 경우 값만 표시
      updateTimerDisplay(settings.interval, 0, true);
    }

    // UI 업데이트
    updateAllUIElements();

    // 저장 피드백을 표시
    showSavedFeedbackUI();
  });
}

// 저장 피드백을 표시
function showSavedFeedbackUI() {
  DOM.saveButton.textContent = i18n.get("options", "saved");
  DOM.saveButton.style.backgroundColor = "#28a745";

  setTimeout(() => {
    DOM.saveButton.textContent = i18n.get("options", "save");
    DOM.saveButton.style.backgroundColor = "#175dce";
  }, APP_CONSTANTS.FEEDBACK_DISPLAY_TIME);
}

// 설정을 초기화
function resetSettings() {
  if (confirm(i18n.get("options", "resetConfirm"))) {
    // 타이머 인터벌 정리
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // 정밀 타이머 리셋
    preciseTimer.reset();

    // 기본 설정으로 복원
    settings = { ...DEFAULT_SETTINGS };
    chrome.storage.sync.set({ settings }, function () {
      // 저장된 일시정지 시간 제거
      chrome.storage.sync.remove("pausedTimeLeft");
      pausedTimeLeft = 0;

      // 알람을 중지
      chrome.alarms.clear("postureReminderAlarm");
      chrome.alarms.clear("postureReminderPrepare");
      chrome.runtime.sendMessage({ action: "stopTimer" });

      // UI 업데이트
      updateAllUIElements();

      // 초기 시간 표시 (기본 인터벌로 표시)
      updateTimerDisplay(settings.interval, 0, true);

      // 시작 버튼 표시
      showStartButton();

      // 초기화 피드백을 표시
      DOM.resetButtonOptions.textContent = "Reset!";
      setTimeout(() => {
        DOM.resetButtonOptions.textContent = i18n.get("options", "reset");
      }, APP_CONSTANTS.FEEDBACK_DISPLAY_TIME);
    });
  }
}

// 오늘의 스트레칭 팁을 로드
function loadStretchingTip() {
  // 현재 설정에서 언어를 가져옴
  const language = settings.language || "en";

  const exercisesFile =
    language === "ko" ? "../data/exercises_kr.json" : "../data/exercises.json";

  fetch(exercisesFile)
    .then((response) => response.json())
    .then((exercises) => {
      if (exercises.length > 0) {
        const randomIndex = Math.floor(Math.random() * exercises.length);
        const tip = exercises[randomIndex];
        DOM.tipTitle.textContent = tip.title;
        DOM.tipDescription.textContent = tip.description;
      }
    })
    .catch((error) => console.error("Failed to load stretching tip:", error));
}

// 커스텀 인터벌 유효성 검사
function validateCustomInterval() {
  let value = parseInt(DOM.customIntervalInput.value);

  if (isNaN(value) || value < APP_CONSTANTS.MIN_INTERVAL) {
    value = APP_CONSTANTS.MIN_INTERVAL;
  } else if (value > APP_CONSTANTS.MAX_INTERVAL) {
    value = APP_CONSTANTS.MAX_INTERVAL;
  }

  DOM.customIntervalInput.value = value;
  updateIntervalPresetsUI(value); // 프리셋 UI 업데이트
}

// ===============================
// 앱 초기화 및 이벤트 리스너
// ===============================

// 앱 초기화
function initApp() {
  // 시작 버튼 섹션 생성
  createStartButtonSection();

  // 설정 로드 및 UI 초기화
  loadSettings();

  // 스트레칭 팁 로드
  loadStretchingTip();

  // 탭 시스템 초기화
  initTabSystem();

  // 이벤트 리스너 등록
  registerEventListeners();
}

// 모든 이벤트 리스너 등록
function registerEventListeners() {
  // 메인 탭 이벤트 리스너
  DOM.pauseButton.addEventListener("click", togglePause);
  DOM.resetButton.addEventListener("click", resetAlarm);
  DOM.intervalSelect.addEventListener("change", changeInterval);

  // 설정 탭 이벤트 리스너
  DOM.customIntervalInput.addEventListener("change", validateCustomInterval);
  DOM.customIntervalInput.addEventListener("keyup", (e) => {
    updateIntervalPresetsUI(parseInt(e.target.value));
  });
  DOM.saveButton.addEventListener("click", saveSettings);
  DOM.resetButtonOptions.addEventListener("click", resetSettings);

  // 인터벌 프리셋 이벤트 리스너
  DOM.intervalPresets.forEach((preset) => {
    preset.addEventListener("click", function () {
      const value = parseInt(this.dataset.value);
      DOM.customIntervalInput.value = value;

      // 활성 클래스를 업데이트
      DOM.intervalPresets.forEach((p) => p.classList.remove("active"));
      this.classList.add("active");

      // 설정 저장 시 적용될 수 있도록 저장하지 않음
      // 저장은 saveSettings() 함수에서 수행
    });
  });

  // 언로드 이벤트 리스너
  window.addEventListener("unload", () => {
    // 타이머 인터벌 정리
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // 정밀 타이머 정리
    if (preciseTimer) {
      preciseTimer.reset();
    }
  });
}

// DOM 로드 완료 시 초기화
document.addEventListener("DOMContentLoaded", async () => {
  // 언어 유틸리티 초기화
  await i18n.init("popup");

  // options 섹션 번역 로드
  i18n.loadSection("options");

  // 앱 초기화
  initApp();
});
