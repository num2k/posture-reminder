let allExercises = [];
let currentExercises = [];
let currentExerciseIndex = 0;
const stretchingList = document.getElementById("stretching-list");
const categoryFilter = document.getElementById("category-filter");
const exerciseModal = document.getElementById("exercise-modal");
const modalImage = document.getElementById("modal-image");
const modalTitle = document.getElementById("modal-title");
const modalDescription = document.getElementById("modal-description");
const prevButton = document.getElementById("prev-exercise");
const nextButton = document.getElementById("next-exercise");
const closeModal = document.querySelector(".close-modal");

// 번역 기능 초기화
document.addEventListener("DOMContentLoaded", async () => {
  // 언어 초기화 (stretching 섹션 번역)
  await i18n.init("stretching");
  // 초기화 후 카테고리 옵션 번역
  translateCategoryOptions();
  // 운동 데이터 로드
  loadExercises();
});

// 카테고리 옵션 번역 함수
function translateCategoryOptions() {
  const options = categoryFilter.querySelectorAll("option");
  options.forEach((option) => {
    const key = option.getAttribute("data-i18n");
    if (key) {
      option.textContent = i18n.get("stretching", key);
    }
  });
}

// 운동 데이터 로드
function loadExercises() {
  // 사용자 설정에서 언어 가져오기
  chrome.storage.sync.get(["settings"], function (result) {
    const settings = result.settings || {};
    const language = settings.language || "en";

    // 언어에 따라 운동 데이터 파일 경로 설정
    const exercisesFile =
      language === "ko"
        ? "../data/exercises_kr.json"
        : "../data/exercises.json";

    fetch(exercisesFile)
      .then((response) => response.json())
      .then((data) => {
        allExercises = data;
        currentExercises = [...allExercises];
        renderExercises();
      })
      .catch((error) => {
        console.error("Error loading exercises:", error);
        stretchingList.innerHTML = `<div class="no-results">${i18n.get(
          "stretching",
          "failedToLoad"
        )}</div>`;
      });
  });
}

// 스트레칭 목록 렌더링
function renderExercises() {
  if (currentExercises.length === 0) {
    stretchingList.innerHTML = `<div class="no-results">${i18n.get(
      "stretching",
      "noResults"
    )}</div>`;
    return;
  }

  stretchingList.innerHTML = "";

  currentExercises.forEach((exercise, index) => {
    const card = document.createElement("div");
    card.className = "exercise-card";
    card.dataset.index = index;

    card.innerHTML = `
      <div class="card-image">
        <img src="${exercise.imageUrl}" alt="${
      exercise.title
    }" onerror="this.src='../assets/images/icon128.png'">
      </div>
      <div class="card-content">
        <h2>${exercise.title}</h2>
        <p>${exercise.description}</p>
        <span class="category-badge">${getLocalizedCategory(
          exercise.category
        )}</span>
      </div>
    `;

    card.addEventListener("click", () => openModal(index));
    stretchingList.appendChild(card);
  });
}

// 카테고리명 지역화
function getLocalizedCategory(category) {
  return i18n.get("stretching", category) || capitalizeFirstLetter(category);
}

// 운동 카테고리별 필터링
function filterExercises(category) {
  if (category === "all") {
    currentExercises = [...allExercises];
  } else {
    currentExercises = allExercises.filter(
      (exercise) => exercise.category === category
    );
  }
  renderExercises();
}

// 운동 모달 열기
function openModal(index) {
  currentExerciseIndex = index;
  const exercise = currentExercises[index];

  modalImage.src = exercise.imageUrl;
  modalImage.onerror = () => {
    modalImage.src = "../assets/images/icon128.png";
  };
  modalTitle.textContent = exercise.title;
  modalDescription.textContent = exercise.description;

  exerciseModal.style.display = "block";
  document.body.style.overflow = "hidden";

  updateNavigationButtons();
}

// 모달 닫기
function closeModalFunction() {
  exerciseModal.style.display = "none";
  document.body.style.overflow = "auto"; // 스크롤 복원
}

// 이전 운동으로 이동
function showPreviousExercise() {
  if (currentExerciseIndex > 0) {
    currentExerciseIndex--;
    const exercise = currentExercises[currentExerciseIndex];

    modalImage.src = exercise.imageUrl;
    modalImage.onerror = () => {
      modalImage.src = "../assets/images/icon128.png";
    };
    modalTitle.textContent = exercise.title;
    modalDescription.textContent = exercise.description;

    updateNavigationButtons();
  }
}

// 다음 운동으로 이동
function showNextExercise() {
  if (currentExerciseIndex < currentExercises.length - 1) {
    currentExerciseIndex++;
    const exercise = currentExercises[currentExerciseIndex];

    modalImage.src = exercise.imageUrl;
    modalImage.onerror = () => {
      modalImage.src = "../assets/images/icon128.png";
    };
    modalTitle.textContent = exercise.title;
    modalDescription.textContent = exercise.description;

    updateNavigationButtons();
  }
}

// 내비게이션 버튼 활성화/비활성화
function updateNavigationButtons() {
  prevButton.disabled = currentExerciseIndex === 0;
  nextButton.disabled = currentExerciseIndex === currentExercises.length - 1;

  prevButton.style.opacity = currentExerciseIndex === 0 ? "0.5" : "1";
  nextButton.style.opacity =
    currentExerciseIndex === currentExercises.length - 1 ? "0.5" : "1";
}

// 첫 글자 대문자로 변환
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// 이벤트 리스너 설정
categoryFilter.addEventListener("change", (e) =>
  filterExercises(e.target.value)
);
closeModal.addEventListener("click", closeModalFunction);
prevButton.addEventListener("click", showPreviousExercise);
nextButton.addEventListener("click", showNextExercise);

// 모달 외부 클릭 시 닫기
window.addEventListener("click", (e) => {
  if (e.target === exerciseModal) {
    closeModalFunction();
  }
});

// 키보드 이벤트 리스너 설정
document.addEventListener("keydown", (e) => {
  if (exerciseModal.style.display === "block") {
    if (e.key === "Escape") {
      closeModalFunction();
    } else if (e.key === "ArrowLeft") {
      showPreviousExercise();
    } else if (e.key === "ArrowRight") {
      showNextExercise();
    }
  }
});
