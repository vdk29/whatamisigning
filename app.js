// ======================================================
// ЧТО Я ПОДПИСЫВАЮ?
// APP.JS
// ======================================================


// ------------------------------------------------------
// ЭЛЕМЕНТЫ
// ------------------------------------------------------

const uploadCard = document.getElementById("uploadCard");
const uploadButton = document.getElementById("uploadButton");
const fileInput = document.getElementById("fileInput");

const aboutButton = document.getElementById("aboutButton");
const aboutModal = document.getElementById("aboutModal");
const modalClose = document.getElementById("modalClose");
const modalOverlay = document.getElementById("modalOverlay");


// ------------------------------------------------------
// НАСТРОЙКИ
// ------------------------------------------------------

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png"
];


// ------------------------------------------------------
// ВЫБОР ФАЙЛА
// ------------------------------------------------------

uploadButton.addEventListener("click", function () {
    fileInput.click();
});


fileInput.addEventListener("change", function () {

    if (!fileInput.files || fileInput.files.length === 0) {
        return;
    }

    handleFile(fileInput.files[0]);

});


// ------------------------------------------------------
// DRAG & DROP
// ------------------------------------------------------

uploadCard.addEventListener("dragover", function (event) {

    event.preventDefault();

    uploadCard.classList.add("dragover");

});


uploadCard.addEventListener("dragleave", function () {

    uploadCard.classList.remove("dragover");

});


uploadCard.addEventListener("drop", function (event) {

    event.preventDefault();

    uploadCard.classList.remove("dragover");

    const files = event.dataTransfer.files;

    if (!files || files.length === 0) {
        return;
    }

    handleFile(files[0]);

});


// ------------------------------------------------------
// ОБРАБОТКА ФАЙЛА
// ------------------------------------------------------

function handleFile(file) {

    if (!allowedTypes.includes(file.type)) {

        showError(
            "Этот формат пока не поддерживается.",
            "Используйте PDF, JPG или PNG."
        );

        return;
    }


    if (file.size > MAX_FILE_SIZE) {

        showError(
            "Файл слишком большой.",
            "Максимальный размер — 20 МБ."
        );

        return;
    }


    showSelectedFile(file);

}


// ------------------------------------------------------
// ПОКАЗ ВЫБРАННОГО ФАЙЛА
// ------------------------------------------------------

function showSelectedFile(file) {

    const size = formatFileSize(file.size);

    uploadCard.innerHTML = `
    
        <div class="upload-icon success-icon">
            ✓
        </div>

        <h2>Документ загружен</h2>

        <p class="selected-file-name">
            ${escapeHtml(file.name)}
        </p>

        <div class="selected-file-size">
            ${size}
        </div>

        <button
            class="upload-button analyze-button"
            id="analyzeButton"
            type="button"
        >
            Анализировать документ
        </button>

        <button
            class="change-file-button"
            id="changeFileButton"
            type="button"
        >
            Выбрать другой файл
        </button>

        <div class="upload-note">
            Анализ пока находится в разработке
        </div>

    `;


    const analyzeButton = document.getElementById("analyzeButton");
    const changeFileButton = document.getElementById("changeFileButton");


    analyzeButton.addEventListener("click", function () {

        showComingSoon();

    });


    changeFileButton.addEventListener("click", function () {

        resetUpload();

    });

}


// ------------------------------------------------------
// СБРОС
// ------------------------------------------------------

function resetUpload() {

    uploadCard.innerHTML = `

        <div class="upload-icon">
            ↑
        </div>

        <h2>Загрузите документ</h2>

        <p>
            PDF, JPG или PNG
        </p>

        <button
            class="upload-button"
            id="uploadButton"
            type="button"
        >
            Выбрать файл
        </button>

        <input
            type="file"
            id="fileInput"
            accept=".pdf,.jpg,.jpeg,.png"
            hidden
        >

        <div class="upload-note">
            Документ анализируется автоматически
        </div>

    `;


    reconnectUploadEvents();

}


// ------------------------------------------------------
// ПОВТОРНОЕ ПОДКЛЮЧЕНИЕ СОБЫТИЙ
// ------------------------------------------------------

function reconnectUploadEvents() {

    const newUploadButton =
        document.getElementById("uploadButton");

    const newFileInput =
        document.getElementById("fileInput");


    newUploadButton.addEventListener("click", function () {

        newFileInput.click();

    });


    newFileInput.addEventListener("change", function () {

        if (!newFileInput.files || newFileInput.files.length === 0) {
            return;
        }

        handleFile(newFileInput.files[0]);

    });

}


// ------------------------------------------------------
// ОШИБКА
// ------------------------------------------------------

function showError(title, text) {

    uploadCard.innerHTML = `

        <div class="upload-icon error-icon">
            !
        </div>

        <h2>${escapeHtml(title)}</h2>

        <p>
            ${escapeHtml(text)}
        </p>

        <button
            class="upload-button"
            id="errorBackButton"
            type="button"
        >
            Попробовать снова
        </button>

    `;


    document
        .getElementById("errorBackButton")
        .addEventListener("click", function () {

            resetUpload();

        });

}


// ------------------------------------------------------
// ЗАГЛУШКА АНАЛИЗА
// ------------------------------------------------------

function showComingSoon() {

    uploadCard.innerHTML = `

        <div class="upload-icon">
            ...
        </div>

        <h2>
            Готовим анализ
        </h2>

        <p>
            Следующим шагом подключим настоящий
            анализ текста документа.
        </p>

        <button
            class="upload-button"
            id="backFromAnalysis"
            type="button"
        >
            Вернуться
        </button>

    `;


    document
        .getElementById("backFromAnalysis")
        .addEventListener("click", function () {

            resetUpload();

        });

}


// ------------------------------------------------------
// РАЗМЕР ФАЙЛА
// ------------------------------------------------------

function formatFileSize(bytes) {

    if (bytes < 1024) {
        return bytes + " Б";
    }


    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " КБ";
    }


    return (bytes / (1024 * 1024)).toFixed(1) + " МБ";

}


// ------------------------------------------------------
// БЕЗОПАСНЫЙ ВЫВОД ТЕКСТА
// ------------------------------------------------------

function escapeHtml(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}


// ------------------------------------------------------
// МОДАЛЬНОЕ ОКНО
// ------------------------------------------------------

aboutButton.addEventListener("click", function () {

    aboutModal.classList.add("active");

});


modalClose.addEventListener("click", function () {

    aboutModal.classList.remove("active");

});


modalOverlay.addEventListener("click", function () {

    aboutModal.classList.remove("active");

});


// ------------------------------------------------------
// ESC
// ------------------------------------------------------

document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {

        aboutModal.classList.remove("active");

    }

});


// ------------------------------------------------------
// ГОТОВО
// ------------------------------------------------------

console.log(
    "Что я подписываю? — приложение загружено."
);