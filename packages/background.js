// 알람 기본 설정
const DEFAULT_SETTINGS = {
  interval: 5, // 기본 5분 간격
  notifications: true,
  exercises: true,
  language: "en", // 기본 언어 영어
  categories: {
    neck: true,
    shoulder: true,
    back: true,
    wrist: true,
    eye: true,
    arm: true,
  },
  timerStarted: false, // 타이머 시작 여부 추가
};

// 알람 ID
const ALARM_NAME = "postureReminderAlarm"; // 주요 알람
const WAKE_UP_ALARM = "wakeUpServiceWorker"; // 서비스 워커 활성화 알람

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

// 스트레칭 운동 데이터를 저장할 변수
let exercises = [];
let exercisesLoaded = false; // 운동 데이터 로딩 여부 표시

// 사용자 설정 캐시
let cachedSettings = null;

// 서비스 워커 활성 상태를 확인하는 마지막 타임스탬프
let lastActiveTimestamp = Date.now();

// 주기적 상태 체크 인터벌 ID
let statusCheckIntervalId = null;

// 현재 선택된 운동
let selectedExercise = null;

// 언어에 따라 메시지를 가져오는 함수
function getMessage(key, language) {
  if (!language || !messages[language]) {
    language = "en"; // 기본값으로 영어 사용
  }
  return messages[language][key] || messages["en"][key];
}

// 언어에 따라 적절한 파일을 로드하는 함수
async function loadExercisesData(language) {
  language = language || "en";

  const exercisesFile =
    language === "ko" ? "data/exercises_kr.json" : "data/exercises.json";

  try {
    console.log(
      `운동 데이터 로드 중... 언어: ${language}, 파일: ${exercisesFile}`
    );

    const response = await fetch(exercisesFile);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    exercises = await response.json();
    console.log(`운동 데이터 로드 완료: ${exercises.length}개 항목`);
    return exercises;
  } catch (error) {
    console.error(`운동 데이터 로드 실패: ${error.message}`);
    // messages 객체에서 정의된 메시지 사용
    exercises = [
      {
        id: 1,
        title: getMessage("breakTime", language),
        category: "general",
        description: getMessage("breakTimeDesc", language),
      },
    ];
    console.log(`기본 메시지 사용: ${exercises.length}개 항목`);
    return exercises;
  }
}

// 사용자 설정 가져오기
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["settings"], function (result) {
      const settings = result.settings || DEFAULT_SETTINGS;
      cachedSettings = settings; // 설정 캐싱
      resolve(settings);
    });
  });
}

// 알람 설정을 초기화합니다
async function initAlarm() {
  const settings = await getSettings();

  // 운동 데이터 미리 로딩
  await loadExercisesData(settings.language);
  exercisesLoaded = true;

  // 타이머가 시작된 상태인 경우에만 알람을 설정
  if (settings.timerStarted) {
    scheduleAlarm(settings.interval);

    // 웨이크업 알람 설정 - 매 30초마다 서비스 워커를 활성화
    setupWakeUpAlarm();
  } else {
    console.log("타이머가 시작되지 않았음 알람을 설정하지 않음");
  }

  // 서비스 워커 상태 업데이트
  updateServiceWorkerStatus();

  // 주기적으로 서비스워커 상태를 확인하는 인터벌 설정
  setupStatusCheckInterval();
}

// 주기적인 상태 체크 인터벌 설정
function setupStatusCheckInterval() {
  // 기존 인터벌이 있으면 정리
  if (statusCheckIntervalId) {
    clearInterval(statusCheckIntervalId);
  }

  // 30초마다 서비스 워커 상태 확인
  statusCheckIntervalId = setInterval(() => {
    updateServiceWorkerStatus();
  }, 30000);
}

// 서비스 워커 웨이크업 알람 설정
function setupWakeUpAlarm() {
  // 기존 웨이크업 알람 제거
  chrome.alarms.clear(WAKE_UP_ALARM, () => {
    // 서비스 워커를 더 자주 깨우는 알람 설정 (5초마다)
    chrome.alarms.create(WAKE_UP_ALARM, {
      delayInMinutes: 0.08, // 5초
      periodInMinutes: 0.08, // 5초마다 반복
    });

    console.log("서비스 워커 활성화 알람이 5초 간격으로 설정됨");

    // 메인 알람이 제대로 설정되어 있는지 확인
    checkAndResetMainAlarm();
  });
}

// 메인 알람이 제대로 설정되어 있는지 확인하고 필요하면 재설정하는 함수
function checkAndResetMainAlarm() {
  chrome.storage.sync.get(["settings"], function (result) {
    const settings = result.settings || DEFAULT_SETTINGS;

    // 타이머가 활성화된 상태인 경우만 알람 확인
    if (settings.timerStarted && !settings.isPaused) {
      chrome.alarms.get(ALARM_NAME, (alarm) => {
        const now = Date.now();
        // 알람이 없거나 스케줄된 시간이 2분 이상 과거인 경우에만 재설정
        // 2분보다 짧은 시간이 지났다면 알람이 정상적으로 처리 중일 수 있으므로 재설정하지 않음
        if (!alarm) {
          console.log("메인 알람이 누락됨, 재설정 중...");
          scheduleAlarm(settings.interval);
        } else if (alarm.scheduledTime < now - 120000) {
          // 2분(120초) 전 시간과 비교
          console.log("메인 알람이 2분 이상 과거로 설정됨, 재설정 중...");
          scheduleAlarm(settings.interval);
        } else if (alarm.scheduledTime < now) {
          console.log(
            `메인 알람이 과거 시간(${Math.round(
              (now - alarm.scheduledTime) / 1000
            )}초 전)으로 설정되어 있지만, 아직 처리 중일 수 있으므로 재설정하지 않음`
          );
        } else {
          console.log(
            `메인 알람 확인 완료, 예정 시간: ${new Date(
              alarm.scheduledTime
            ).toLocaleTimeString()}, ${Math.round(
              (alarm.scheduledTime - now) / 1000
            )}초 후`
          );
        }
      });
    }
  });
}

// 서비스 워커 상태 주기적 업데이트
function updateServiceWorkerStatus() {
  lastActiveTimestamp = Date.now();
  console.log(
    "서비스워커 활성화 상태 업데이트: " + new Date().toLocaleTimeString()
  );

  // 서비스 워커 활성 상태를 저장
  chrome.storage.local.set({
    lastActiveTimestamp,
    serviceWorkerActive: true,
  });
}

// 알람을 설정합니다 (안정화된 버전)
function scheduleAlarm(intervalMinutes) {
  // 기존 알람을 항상 제거하고 새로 생성하는 방식으로 변경
  chrome.alarms.clear(ALARM_NAME, () => {
    // 새 알람 설정
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: intervalMinutes,
      periodInMinutes: intervalMinutes,
    });

    console.log(`알람이 새로 설정됨: ${intervalMinutes}분 간격`);
    console.log(
      `다음 알람 예정 시간: ${new Date(
        Date.now() + intervalMinutes * 60 * 1000
      ).toLocaleTimeString()}`
    );

    // 서비스 워커 상태 업데이트
    updateServiceWorkerStatus();
  });
}

// 정확한 타이밍으로 알람을 설정하는 함수
function scheduleExactAlarm(intervalMinutes) {
  // 기존 알람 제거
  chrome.alarms.clear(ALARM_NAME, () => {
    // 정확한 시간 계산을 위해 미리초 단위의 계산 사용
    const exactMilliseconds = intervalMinutes * 60 * 1000;
    const exactDelayInMinutes = intervalMinutes;

    // 새 알람 설정 - 정확한 시간에 맞추어 설정
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: exactDelayInMinutes,
      periodInMinutes: intervalMinutes, // 이후에는 기본 간격으로 반복
    });

    // 알람 생성 시간과 예정 시간을 모두 기록
    const now = Date.now();
    const scheduledTime = now + exactMilliseconds;
    console.log(`정확한 알람이 설정됨: ${exactDelayInMinutes.toFixed(4)}분 후`);
    console.log(`알람 생성 시간: ${new Date(now).toLocaleTimeString()}`);
    console.log(
      `다음 정확한 알람 예정 시간: ${new Date(
        scheduledTime
      ).toLocaleTimeString()}, 간격: ${intervalMinutes}분`
    );

    // 서비스 워커 상태 업데이트
    updateServiceWorkerStatus();
  });
}

// 특정 시간으로 알람을 설정합니다 (재개 기능용)
function scheduleOneTimeAlarm(delayInMinutes) {
  chrome.alarms.clear(ALARM_NAME, () => {
    // 사용자 설정에서 기본 알람 간격 가져오기
    chrome.storage.sync.get(["settings"], function (result) {
      const settings = result.settings || DEFAULT_SETTINGS;
      const intervalMinutes = settings.interval;

      // 주 알람 설정
      chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: delayInMinutes, // 지정된 지연 시간
        periodInMinutes: intervalMinutes, // 이후에는 기본 간격으로 반복
      });

      console.log(
        `알람이 ${delayInMinutes.toFixed(
          2
        )}분 후에 설정됨, 이후 ${intervalMinutes}분 간격으로 반복`
      );
      console.log(
        `다음 알람 예정 시간: ${new Date(
          Date.now() + delayInMinutes * 60 * 1000
        ).toLocaleTimeString()}`
      );
    });
  });
}

// 알람 이벤트 리스너
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log(`알람 발생: ${alarm.name} - ${new Date().toLocaleTimeString()}`);

  // 서비스 워커 웨이크업 알람인 경우
  if (alarm.name === WAKE_UP_ALARM) {
    updateServiceWorkerStatus();

    // 웨이크업 알람 처리 로직은 그대로 유지
    const settings = await getSettings();
    if (settings.timerStarted && !settings.isPaused) {
      // 알림을 표시해야 할 시간이 다가오면 미리 준비
      const nextAlarmTime = await getNextAlarmTime();
      if (nextAlarmTime && nextAlarmTime - Date.now() < 60000) {
        // 1분 이내
        console.log("알림 표시 준비 중... (1분 이내 알림 예정)");
        // 운동 데이터 미리 로드
        if (!exercisesLoaded) {
          await loadExercisesData(settings.language);
          exercisesLoaded = true;
        }
      }

      // 알람 상태 확인
      chrome.alarms.get(ALARM_NAME, (alarm) => {
        const now = Date.now();
        if (!alarm) {
          console.log("웨이크업 체크: 메인 알람이 없음, 재설정 중...");
          scheduleExactAlarm(settings.interval);
        } else if (alarm.scheduledTime < now - 5000) {
          // 5초 이상 지난 알람은 재설정
          console.log(
            `웨이크업 체크: 메인 알람이 과거 시간으로 설정됨 (${Math.round(
              (now - alarm.scheduledTime) / 1000
            )}초 전), 재설정 중...`
          );
          scheduleExactAlarm(settings.interval);
        }
      });
    }
    return;
  }

  // 메인 알람이 발생한 경우
  if (alarm.name === ALARM_NAME) {
    try {
      // 알람 발생 시각 정확하게 기록
      const alarmTriggerTime = Date.now();
      console.log(
        `메인 알람 발생 시각: ${new Date(
          alarmTriggerTime
        ).toLocaleTimeString()}`
      );

      const settings = await getSettings();

      // 서비스 워커 상태 업데이트
      updateServiceWorkerStatus();

      // 일시 정지 상태이면 알림을 표시하지 않음
      if (settings.isPaused) {
        console.log("일시 정지 상태이므로 알림을 표시하지 않음");
        return;
      }

      // 타이머가 중지된 상태이면 알림을 표시하지 않음
      if (!settings.timerStarted) {
        console.log("타이머가 중지된 상태이므로 알림을 표시하지 않음");
        return;
      }

      // 중요: 먼저 다음 알람을 설정하여 타이밍 문제 해결
      // 다음 알람을 강화된 방식으로 설정 - 빠르게 먼저 설정
      scheduleExactAlarm(settings.interval);
      console.log(`다음 알람 설정 완료: ${settings.interval}분 후`);

      // 알림이 비활성화되어 있으면 알림 표시 생략
      if (!settings.notifications) {
        console.log("알림이 비활성화 되어있음");
        return;
      }

      // 근무 시간 설정에 따라 표시 여부 결정
      if (
        settings.workHoursOnly &&
        !isWithinWorkHours(settings.workStart, settings.workEnd)
      ) {
        console.log("현재 시간이 근무 시간이 아니므로 알림을 표시하지 않음");
        return;
      }

      // 운동 데이터가 아직 로드되지 않았거나 개수가 0이면 로드
      if (!exercisesLoaded || exercises.length === 0) {
        await loadExercisesData(settings.language);
        exercisesLoaded = true;
      }

      // 운동 선택
      selectedExercise = await selectExercise(settings);

      // 알림 표시
      console.log("알림 표시 시작...");
      try {
        await showNotification(settings);
        console.log("알림 표시 완료");
      } catch (error) {
        console.error("알림 표시 중 오류 발생:", error);
      }

      // 알람 처리에 소요된 시간 기록
      const processingTime = Date.now() - alarmTriggerTime;
      console.log(`알람 처리 소요 시간: ${processingTime}ms`);

      // 알람 설정 확인
      setTimeout(() => {
        chrome.alarms.get(ALARM_NAME, (alarm) => {
          if (alarm) {
            console.log(
              `알람 설정 확인: ${new Date(
                alarm.scheduledTime
              ).toLocaleTimeString()}에 예정됨`
            );
          } else {
            console.error("알람이 설정되지 않았음! 긴급 재설정 시도");
            scheduleExactAlarm(settings.interval);
          }
        });
      }, 2000);
    } catch (error) {
      console.error("알람 처리 중 오류 발생:", error);

      // 오류 발생 시에도 다음 알람 설정 시도
      try {
        const settings = await getSettings();
        scheduleExactAlarm(settings.interval);
        console.log("오류 발생 후 알람 재설정 시도 완료");
      } catch (e) {
        console.error("오류 복구 실패:", e);
      }
    }
  }
});

// 다음 알람 예정 시간 가져오기
function getNextAlarmTime() {
  return new Promise((resolve) => {
    chrome.alarms.get(ALARM_NAME, (alarm) => {
      if (alarm) {
        resolve(alarm.scheduledTime);
      } else {
        resolve(null);
      }
    });
  });
}

// 운동을 선택하는 함수
async function selectExercise(settings) {
  const language = settings.language || "en";

  let exercise = {
    title: getMessage("breakTime", language),
    description: getMessage("breakTimeDesc", language),
  };

  // 운동 옵션이 켜져 있고 운동 데이터가 있는 경우
  if (settings.exercises && exercises.length > 0) {
    // 사용자가 선택한 카테고리에 해당하는 운동만 필터링
    let availableExercises = exercises.filter((ex) => {
      // 카테고리 정보가 없는 경우 기본 설정 사용
      const categories = settings.categories || DEFAULT_SETTINGS.categories;

      // 해당 카테고리가 정의되지 않았다면 true로 간주
      if (categories[ex.category] === undefined) {
        return true;
      }

      // 해당 운동의 카테고리가 활성화되어 있으면 포함
      return categories[ex.category] === true;
    });

    // 필터링된 운동이 없으면 기본 메시지 사용
    if (availableExercises.length === 0) {
      console.log(
        "선택된 카테고리에 사용 가능한 운동없음. 기본 메시지를 사용 함."
      );
    } else {
      // 필터링된 운동 중에서 랜덤으로 선택
      const randomIndex = Math.floor(Math.random() * availableExercises.length);
      exercise = availableExercises[randomIndex];
      console.log(`선택된 운동: ${exercise.title} (${exercise.category})`);
    }
  }

  return exercise;
}

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

  console.log(
    `현재 시간: ${currentHours}:${currentMinutes} (${currentTotalMinutes}분)`
  );
  console.log(
    `근무 시작: ${startHours}:${startMinutes} (${startTotalMinutes}분)`
  );
  console.log(`근무 종료: ${endHours}:${endMinutes} (${endTotalMinutes}분)`);

  // 종료 시간이 시작 시간보다 작은 경우 (예: 시작 22:00, 종료 06:00)
  if (endTotalMinutes < startTotalMinutes) {
    // 자정을 넘어가는 경우
    return (
      currentTotalMinutes >= startTotalMinutes ||
      currentTotalMinutes <= endTotalMinutes
    );
  } else {
    // 일반적인 경우
    return (
      currentTotalMinutes >= startTotalMinutes &&
      currentTotalMinutes <= endTotalMinutes
    );
  }
}

// 알림을 표시합니다
async function showNotification(settings) {
  console.log("알림 표시 중...");

  const language = settings.language || "en";
  const exercise = selectedExercise || (await selectExercise(settings));

  // 알림 ID 생성
  const notificationId = "posture-reminder-" + Date.now();

  try {
    await new Promise((resolve, reject) => {
      chrome.notifications.create(
        notificationId,
        {
          type: "basic",
          iconUrl: "assets/images/icon128.png",
          title: getMessage("title", language),
          message: `${exercise.title}: ${exercise.description}`,
          priority: 2,
          buttons: [
            { title: getMessage("remindLater", language) },
            { title: getMessage("stretchNow", language) },
          ],
          requireInteraction: false, // 자동 닫힘 허용
        },
        (notificationId) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(notificationId);
          }
        }
      );
    });

    console.log(`알림 표시됨: ${notificationId}, 자동으로 닫힘이 허용됨`);
  } catch (error) {
    console.error("알림 생성 중 오류 발생:", error);
  }
}

// 알림 버튼 클릭 리스너
chrome.notifications.onButtonClicked.addListener(
  async (notificationId, buttonIndex) => {
    if (buttonIndex === 0) {
      // 5분 후에 알림
      scheduleOneTimeAlarm(5);
    } else {
      // 지금 스트레칭
      chrome.tabs.create({ url: "popup/stretching_guide.html" });
    }

    // 알림 닫기
    chrome.notifications.clear(notificationId);
  }
);

// 설정 변경 리스너
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === "sync" && changes.settings) {
    const newSettings = changes.settings.newValue;
    cachedSettings = newSettings; // 캐시 업데이트

    // 타이머가 시작된 경우에만 알람을 설정
    if (newSettings.timerStarted && !newSettings.isPaused) {
      scheduleAlarm(newSettings.interval);
      console.log(
        `설정 변경 감지: 타이머 시작됨, ${newSettings.interval}분 간격으로 알람 설정`
      );
    } else {
      console.log(
        "설정 변경 감지: 타이머 시작되지 않았거나 일시 정지 상태, 알람 설정 안 함"
      );
    }

    // 언어 설정이 변경되면 운동 데이터를 다시 로딩
    if (
      !changes.settings.oldValue ||
      changes.settings.oldValue.language !== newSettings.language
    ) {
      await loadExercisesData(newSettings.language);
      exercisesLoaded = true;
    }
  }
});

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("메시지 수신:", message.action);

  // 서비스 워커 상태 업데이트
  updateServiceWorkerStatus();

  if (message.action === "resetAlarm") {
    chrome.storage.sync.get(["settings"], function (result) {
      const settings = result.settings || DEFAULT_SETTINGS;
      cachedSettings = settings; // 캐시 업데이트

      // 타이머가 시작된 경우에만 알람을 설정
      if (settings.timerStarted) {
        // immediate 파라미터가 있으면 즉시 다음 알람을 설정 (0초 지연 없이)
        if (message.immediate) {
          console.log("즉시 알람 재설정 요청 처리 중...");
          chrome.alarms.clear(ALARM_NAME, () => {
            // 새 알람을 즉시 설정 (일반 스케줄링보다 우선 처리)
            const nextAlarmTime = Date.now() + settings.interval * 60 * 1000;
            chrome.alarms.create(ALARM_NAME, {
              when: nextAlarmTime, // 정확한 시간 지정
              periodInMinutes: settings.interval, // 이후 반복 간격
            });
            console.log(
              `즉시 알람 재설정 완료: 다음 알람 ${
                settings.interval
              }분 후 (${new Date(nextAlarmTime).toLocaleTimeString()})`
            );

            // 응답 전송 - 다음 알람 시간도 함께 전달
            if (sendResponse) {
              sendResponse({
                success: true,
                message: "알람 즉시 재설정 완료",
                nextAlarmAt: nextAlarmTime,
              });
            }

            // 알람이 제대로 설정되었는지 확인
            setTimeout(() => {
              chrome.alarms.get(ALARM_NAME, (alarm) => {
                if (alarm) {
                  console.log(
                    `알람 확인: ${new Date(
                      alarm.scheduledTime
                    ).toLocaleTimeString()}`
                  );
                } else {
                  console.error("알람 설정 실패! 재시도합니다.");
                  chrome.alarms.create(ALARM_NAME, {
                    when: nextAlarmTime,
                    periodInMinutes: settings.interval,
                  });
                }
              });
            }, 500);
          });
        } else {
          // 일반 알람 재설정
          scheduleAlarm(settings.interval);
          console.log("타이머가 시작됨: 알람 설정됨");

          // 다음 알람 시간 가져오기
          chrome.alarms.get(ALARM_NAME, (alarm) => {
            // 응답이 필요한 경우 sendResponse 호출
            if (sendResponse) {
              sendResponse({
                success: true,
                message: "알람 설정됨",
                nextAlarmAt: alarm
                  ? alarm.scheduledTime
                  : Date.now() + settings.interval * 60 * 1000,
              });
            }
          });
        }
      } else {
        console.log("타이머가 시작되지 않았음: 알람을 설정하지 않음");

        // 타이머가 시작되지 않았음을 알림
        if (sendResponse) {
          sendResponse({
            success: false,
            message: "타이머 중지됨",
          });
        }
      }
    });

    // sendResponse를 비동기로 사용하기 위해 true 반환
    return true;
  } else if (message.action === "resumeAlarm" && message.delayInMinutes) {
    // 일시 정지 후 재개 - 남은 시간으로 알람 설정
    scheduleOneTimeAlarm(message.delayInMinutes);

    if (sendResponse) {
      sendResponse({ success: true, message: "알람 재개" });
    }
    return true;
  } else if (message.action === "startTimer") {
    chrome.storage.sync.get(["settings"], function (result) {
      let settings = result.settings || DEFAULT_SETTINGS;

      // timerStarted 플래그 설정
      settings.timerStarted = true;
      settings.isPaused = false;
      cachedSettings = settings; // 캐시 업데이트

      // 설정 저장
      chrome.storage.sync.set({ settings }, function () {
        // 알람 설정
        scheduleAlarm(settings.interval);
        // 웨이크업 알람 설정
        setupWakeUpAlarm();
        console.log("타이머 시작 요청: 알람 설정됨");

        if (sendResponse) {
          sendResponse({ success: true, message: "타이머 시작" });
        }
      });
    });

    return true;
  } else if (message.action === "stopTimer") {
    chrome.storage.sync.get(["settings"], function (result) {
      let settings = result.settings || DEFAULT_SETTINGS;

      // 타이머 중지 상태로 설정
      settings.timerStarted = false;
      settings.isPaused = false;
      cachedSettings = settings;

      // 설정 저장
      chrome.storage.sync.set({ settings }, function () {
        // 알람 제거
        chrome.alarms.clear(ALARM_NAME);
        chrome.alarms.clear(WAKE_UP_ALARM);

        console.log("타이머 중지 요청: 모든 알람 제거");

        if (sendResponse) {
          sendResponse({ success: true, message: "타이머 중지" });
        }
      });
    });

    return true;
  } else if (message.action === "getExercises") {
    if (!exercisesLoaded || exercises.length === 0) {
      getSettings().then((settings) => {
        loadExercisesData(settings.language).then((data) => {
          exercisesLoaded = true;
          if (sendResponse) {
            sendResponse({ success: true, exercises: data });
          }
        });
      });
    } else {
      if (sendResponse) {
        sendResponse({ success: true, exercises: exercises });
      }
    }
    return true;
  } else if (message.action === "keepAlive") {
    console.log("킵얼라이브 메시지 수신, 서비스 워커 활성 유지");
    updateServiceWorkerStatus();

    if (sendResponse) {
      sendResponse({ success: true, timestamp: lastActiveTimestamp });
    }
    return true;
  } else if (message.action === "wakeUpServiceWorker") {
    // 서비스 워커 웨이크업 요청 처리
    console.log("서비스 워커 웨이크업 요청 받음");
    updateServiceWorkerStatus();

    chrome.storage.sync.get(["settings"], function (result) {
      const settings = result.settings || DEFAULT_SETTINGS;

      // 타이머가 활성화된 상태인 경우 웨이크업 알람 설정
      if (settings.timerStarted && !settings.isPaused) {
        setupWakeUpAlarm();
      }

      if (sendResponse) {
        sendResponse({
          success: true,
          active: true,
          timestamp: lastActiveTimestamp,
        });
      }
    });

    return true;
  }
});

// 서비스 워커 시작 시 초기화
initAlarm();
