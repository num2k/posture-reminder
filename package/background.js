// 알람 기본 설정
const DEFAULT_SETTINGS = {
  interval: 30, // 기본 30분 간격
  notifications: true,
  exercises: true,
  language: "en", // 기본 언어 영어
  categories: {
    neck: true,
    shoulder: true,
    back: true,
    wrist: true,
    eye: true,
  },
};

// 알람 ID
const ALARM_NAME = "postureReminderAlarm";

// 다국어 메시지
const messages = {
  en: {
    title: "Posture Reminder",
    breakTime: "Break Time",
    breakTimeDesc: "Take a short break and do some stretching!",
    remindLater: "Remind in 5 minutes",
    stretchNow: "Stretch now",
  },
  ko: {
    title: "자세 알림이",
    breakTime: "휴식 시간",
    breakTimeDesc: "잠시 휴식을 취하고 스트레칭을 해보세요!",
    remindLater: "5분 후에 알림",
    stretchNow: "지금 스트레칭",
  },
};

// 스트레칭 운동 데이터를 가져옵니다
let exercises = [];

// 언어에 따라 메시지를 가져오는 함수
function getMessage(key, language) {
  if (!language || !messages[language]) {
    language = "en"; // 기본값으로 영어 사용
  }
  return messages[language][key] || messages["en"][key];
}

// 언어에 따라 적절한 파일을 로드하는 함수
function loadExercisesData() {
  chrome.storage.sync.get(["settings"], function (result) {
    const settings = result.settings || DEFAULT_SETTINGS;
    const language = settings.language || "en";

    const exercisesFile =
      language === "ko" ? "data/exercises_kr.json" : "data/exercises.json";

    fetch(exercisesFile)
      .then((response) => response.json())
      .then((data) => {
        exercises = data;
      })
      .catch((error) => console.error("Failed to fetch exercise data:", error));
  });
}

// 알람 설정을 초기화합니다
function initAlarm() {
  chrome.storage.sync.get(["settings"], function (result) {
    const settings = result.settings || DEFAULT_SETTINGS;
    scheduleAlarm(settings.interval);
  });

  // 운동 데이터 로딩
  loadExercisesData();
}

// 알람 스케줄을 설정합니다
function scheduleAlarm(intervalMinutes) {
  chrome.alarms.clear(ALARM_NAME, () => {
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: intervalMinutes,
      periodInMinutes: intervalMinutes,
    });
    console.log(`Alarm set at ${intervalMinutes} minute intervals.`);
  });
}

// 특정 시간으로 알람을 설정합니다 (재개 기능용)
function scheduleOneTimeAlarm(delayInMinutes) {
  chrome.alarms.clear(ALARM_NAME, () => {
    // 사용자 설정에서 기본 알람 간격 가져오기
    chrome.storage.sync.get(["settings"], function (result) {
      const settings = result.settings || DEFAULT_SETTINGS;
      const intervalMinutes = settings.interval;

      // 일시 정지 이후 남은 시간으로 알람을 설정하고,
      // 이후에는 설정된 간격으로 주기적으로 알람이 실행되도록 함
      chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: delayInMinutes,
        periodInMinutes: intervalMinutes,
      });

      console.log(
        `Alarm set to resume in ${delayInMinutes.toFixed(
          2
        )} minutes, then repeat every ${intervalMinutes} minutes.`
      );
    });
  });
}

// 알람 이벤트 리스너
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  chrome.storage.sync.get(["settings"], function (result) {
    const settings = result.settings || DEFAULT_SETTINGS;

    // 일시 정지 상태이면 알림을 표시하지 않음
    if (settings.isPaused) {
      console.log("일시 정지 상태이므로 알림을 표시하지 않습니다.");
      return;
    }

    // 알림이 비활성화되어 있으면 실행 중단
    if (!settings.notifications) return;

    // 근무 시간 중에만 알림 표시 설정이 켜져 있고, 현재 근무 시간이 아니면 실행 중단
    if (
      settings.workHoursOnly &&
      !isWithinWorkHours(settings.workStart, settings.workEnd)
    ) {
      console.log("현재 시간이 근무 시간이 아니므로 알림을 표시하지 않습니다.");
      return;
    }

    // 모든 조건을 만족하면 알림 표시
    showNotification(settings);
  });
});

// 현재 시간이 근무 시간 내인지 확인하는 함수
function isWithinWorkHours(startTime, endTime) {
  // 현재 시간 가져오기
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();

  // 시작 시간과 종료 시간을 파싱
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);

  // 현재 시간을 분 단위로 변환
  const currentTotalMinutes = currentHours * 60 + currentMinutes;

  // 시작 시간과 종료 시간을 분 단위로 변환
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;

  // 현재 시간이 시작 시간과 종료 시간 사이인지 확인
  return (
    currentTotalMinutes >= startTotalMinutes &&
    currentTotalMinutes <= endTotalMinutes
  );
}

// 알림을 표시합니다
function showNotification(settings) {
  const language = settings.language || "en";

  let exercise = {
    title: getMessage("breakTime", language),
    description: getMessage("breakTimeDesc", language),
  };

  console.log("스트레칭 운동 설정:", settings.exercises);
  console.log("로드된 운동 데이터:", exercises.length);

  // 운동 옵션이 켜져 있고 운동 데이터가 있는 경우
  if (settings.exercises && exercises.length > 0) {
    // 사용자가 선택한 카테고리에 해당하는 운동만 필터링
    let availableExercises = exercises.filter((ex) => {
      // 카테고리 정보가 없는 경우 기본 설정 사용
      const categories = settings.categories || DEFAULT_SETTINGS.categories;

      console.log(`카테고리 체크: ${ex.category} - ${categories[ex.category]}`);

      // 해당 운동의 카테고리가 활성화되어 있으면 포함
      return categories[ex.category] === true;
    });

    console.log(`사용 가능한 운동 수: ${availableExercises.length}`);

    // 필터링된 운동이 없으면 기본 메시지 사용
    if (availableExercises.length === 0) {
      console.log(
        "No exercises available in selected categories. Using default message."
      );
    } else {
      // 필터링된 운동 중에서 랜덤으로 선택
      const randomIndex = Math.floor(Math.random() * availableExercises.length);
      exercise = availableExercises[randomIndex];
      console.log(
        `Selected exercise: ${exercise.title} (${exercise.category})`
      );
    }
  }

  // 알람 간격을 초로 변환하고 정확히 5초를 더해서 알림이 표시될 시간 계산
  const intervalInSeconds = settings.interval * 60; // 분을 초로 변환
  const autoCloseTime = (intervalInSeconds + 5) * 1000; // 5초 더함

  // 알림 생성 - 선택된 언어에 따른 메시지 사용
  const notificationId = "posture-reminder-" + Date.now();
  chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "assets/images/icon128.png",
    title: getMessage("title", language),
    message: `${exercise.title}: ${exercise.description}`,
    priority: 2,
    buttons: [
      { title: getMessage("remindLater", language) },
      { title: getMessage("stretchNow", language) },
    ],
    requireInteraction: true, // 사용자 상호작용 없이는 사라지지 않게 함 (원래 설계로 복구)
    silent: true, // 항상 소리 없음으로 설정
  });

  // 로그로 예상 표시 시간 기록
  const minutes = Math.floor(autoCloseTime / 60000);
  const seconds = Math.floor((autoCloseTime % 60000) / 1000);
  console.log(
    `Notification should display for ${minutes}m ${seconds}s (${settings.interval} minute interval + 5 seconds)`
  );

  // 계산된 시간 후에 알림을 수동으로 닫음
  setTimeout(() => {
    chrome.notifications.clear(notificationId);
    console.log(`Notification manually closed after ${minutes}m ${seconds}s`);
  }, autoCloseTime);
}

// 알림 버튼 클릭 리스너
chrome.notifications.onButtonClicked.addListener(
  (notificationId, buttonIndex) => {
    if (buttonIndex === 0) {
      // 5분 더 알림
      scheduleAlarm(5);
    } else {
      // 지금 스트레칭
      chrome.tabs.create({ url: "popup/stretching_guide.html" });
    }
    chrome.notifications.clear(notificationId);
  }
);

// 설정 변경 리스너
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.settings) {
    const newSettings = changes.settings.newValue;
    scheduleAlarm(newSettings.interval);

    // 언어 설정이 변경되면 운동 데이터를 다시 로딩
    if (changes.settings.oldValue?.language !== newSettings.language) {
      loadExercisesData();
    }
  }
});

// 메시지 리스너
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "resetAlarm") {
    chrome.storage.sync.get(["settings"], function (result) {
      const settings = result.settings || DEFAULT_SETTINGS;
      scheduleAlarm(settings.interval);
    });
  } else if (message.action === "resumeAlarm" && message.delayInMinutes) {
    // 일시 정지 후 재개 - 남은 시간으로 알람 설정
    scheduleOneTimeAlarm(message.delayInMinutes);
  }
});

initAlarm();
