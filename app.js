// ======================================================
// ЧТО Я ПОДПИСЫВАЮ?
// LOCAL DOCUMENT ANALYZER
// PDF + PDF SCAN + JPG + PNG
// Без OpenAI / без сервера
// ======================================================

const PDFJS_VERSION = "3.11.174";

const PDFJS_URL =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;

const PDFJS_WORKER_URL =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

const TESSERACT_URL =
    "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

// ======================================================
// DOM
// ======================================================

const uploadButton = document.getElementById("uploadButton");
const fileInput = document.getElementById("fileInput");
const uploadCard = document.getElementById("uploadCard");

const aboutButton = document.getElementById("aboutButton");
const aboutModal = document.getElementById("aboutModal");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");

// ======================================================
// ИНИЦИАЛИЗАЦИЯ
// ======================================================

if (uploadButton && fileInput) {

    uploadButton.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", async (event) => {

        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        await handleFile(file);
    });
}

// ======================================================
// DRAG & DROP
// ======================================================

if (uploadCard) {

    uploadCard.addEventListener("dragover", (event) => {

        event.preventDefault();

        uploadCard.classList.add("drag-active");
    });

    uploadCard.addEventListener("dragleave", () => {

        uploadCard.classList.remove("drag-active");
    });

    uploadCard.addEventListener("drop", async (event) => {

        event.preventDefault();

        uploadCard.classList.remove("drag-active");

        const file = event.dataTransfer?.files?.[0];

        if (!file) {
            return;
        }

        await handleFile(file);
    });
}

// ======================================================
// MODAL
// ======================================================

if (aboutButton && aboutModal) {

    aboutButton.addEventListener("click", () => {

        aboutModal.classList.add("active");

        document.body.classList.add("modal-open");
    });
}

if (modalClose) {
    modalClose.addEventListener("click", closeModal);
}

if (modalOverlay) {
    modalOverlay.addEventListener("click", closeModal);
}

document.addEventListener("keydown", (event) => {

    if (event.key === "Escape") {
        closeModal();
    }
});

function closeModal() {

    if (!aboutModal) {
        return;
    }

    aboutModal.classList.remove("active");

    document.body.classList.remove("modal-open");
}

// ======================================================
// ОСНОВНАЯ ОБРАБОТКА ФАЙЛА
// ======================================================

async function handleFile(file) {

    clearPreviousResult();

    const validationError = validateFile(file);

    if (validationError) {

        showStatus(
            validationError,
            "error"
        );

        return;
    }

    showSelectedFile(file);

    try {

        const type = getFileType(file);

        let text = "";

        // --------------------------------------------------
        // PDF
        // --------------------------------------------------

        if (type === "pdf") {

            showStatus(
                "Читаем PDF...",
                "loading"
            );

            text = await extractPdfText(file);

            if (!text || text.trim().length < 80) {

                showStatus(
                    "Текстовый слой не найден. Распознаём документ...",
                    "loading"
                );

                text = await ocrPdf(file);
            }
        }

        // --------------------------------------------------
        // IMAGE
        // --------------------------------------------------

        if (type === "image") {

            showStatus(
                "Распознаём документ...",
                "loading"
            );

            text = await ocrImage(file);
        }

        text = normalizeText(text);

        if (!text || text.length < 20) {

            throw new Error(
                "Не удалось получить читаемый текст из документа."
            );
        }

        showStatus(
            "Текст получен. Анализируем условия...",
            "loading"
        );

        await sleep(150);

        const result = analyzeDocument(text);

        renderAnalysisResult(result);

        showStatus(
            `Готово. Найдено условий: ${result.totalFindings}`,
            "success"
        );

    } catch (error) {

        console.error(error);

        showStatus(
            error.message ||
            "Не удалось обработать документ.",
            "error"
        );
    }
}

// ======================================================
// ПРОВЕРКА ФАЙЛА
// ======================================================

function validateFile(file) {

    if (!file) {
        return "Файл не выбран.";
    }

    if (file.size > MAX_FILE_SIZE) {
        return "Файл слишком большой. Максимальный размер — 20 МБ.";
    }

    const name = file.name.toLowerCase();

    const allowed =
        name.endsWith(".pdf") ||
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg") ||
        name.endsWith(".png");

    if (!allowed) {
        return "Поддерживаются только PDF, JPG, JPEG и PNG.";
    }

    return null;
}

function getFileType(file) {

    const name = file.name.toLowerCase();

    if (name.endsWith(".pdf")) {
        return "pdf";
    }

    return "image";
}

// ======================================================
// PDF.JS
// ======================================================

async function loadPdfJs() {

    if (window.pdfjsLib) {
        return window.pdfjsLib;
    }

    return new Promise((resolve, reject) => {

        const existing =
            document.querySelector(
                'script[data-pdfjs="true"]'
            );

        if (existing) {

            existing.addEventListener("load", () => {
                resolve(window.pdfjsLib);
            });

            existing.addEventListener("error", () => {
                reject(
                    new Error(
                        "Не удалось загрузить модуль чтения PDF."
                    )
                );
            });

            return;
        }

        const script =
            document.createElement("script");

        script.src = PDFJS_URL;

        script.dataset.pdfjs = "true";

        script.onload = () => {

            if (!window.pdfjsLib) {

                reject(
                    new Error(
                        "PDF.js загрузился некорректно."
                    )
                );

                return;
            }

            resolve(window.pdfjsLib);
        };

        script.onerror = () => {

            reject(
                new Error(
                    "Не удалось загрузить модуль чтения PDF. Проверьте интернет-соединение."
                )
            );
        };

        document.head.appendChild(script);
    });
}

// ======================================================
// ИЗВЛЕЧЕНИЕ ТЕКСТА ИЗ PDF
// ======================================================

async function extractPdfText(file) {

    const pdfjsLib = await loadPdfJs();

    pdfjsLib.GlobalWorkerOptions.workerSrc =
        PDFJS_WORKER_URL;

    const arrayBuffer =
        await file.arrayBuffer();

    const pdf =
        await pdfjsLib.getDocument({
            data: arrayBuffer
        }).promise;

    let fullText = "";

    for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
    ) {

        showStatus(
            `Читаем страницу ${pageNumber} из ${pdf.numPages}...`,
            "loading"
        );

        const page =
            await pdf.getPage(pageNumber);

        const textContent =
            await page.getTextContent();

        const pageText =
            textContent.items
                .map(item => item.str || "")
                .join(" ");

        fullText += "\n" + pageText;
    }

    return fullText;
}

// ======================================================
// TESSERACT
// ======================================================

async function loadTesseract() {

    if (window.Tesseract) {
        return window.Tesseract;
    }

    return new Promise((resolve, reject) => {

        const existing =
            document.querySelector(
                'script[data-tesseract="true"]'
            );

        if (existing) {

            existing.addEventListener("load", () => {
                resolve(window.Tesseract);
            });

            existing.addEventListener("error", () => {
                reject(
                    new Error(
                        "Не удалось загрузить OCR-модуль."
                    )
                );
            });

            return;
        }

        const script =
            document.createElement("script");

        script.src = TESSERACT_URL;

        script.dataset.tesseract = "true";

        script.onload = () => {

            if (!window.Tesseract) {

                reject(
                    new Error(
                        "OCR-модуль загрузился некорректно."
                    )
                );

                return;
            }

            resolve(window.Tesseract);
        };

        script.onerror = () => {

            reject(
                new Error(
                    "Не удалось загрузить OCR. Проверьте интернет-соединение."
                )
            );
        };

        document.head.appendChild(script);
    });
}

// ======================================================
// OCR ИЗОБРАЖЕНИЯ
// ======================================================

async function ocrImage(file) {

    const Tesseract =
        await loadTesseract();

    showStatus(
        "Запускаем распознавание русского текста...",
        "loading"
    );

    const worker =
        await Tesseract.createWorker(
            "rus",
            1,
            {
                logger: (message) => {
                    handleOcrProgress(message);
                }
            }
        );

    try {

        const result =
            await worker.recognize(file);

        return result?.data?.text || "";

    } finally {

        await worker.terminate();
    }
}

// ======================================================
// OCR PDF
// ======================================================

async function ocrPdf(file) {

    const pdfjsLib =
        await loadPdfJs();

    const Tesseract =
        await loadTesseract();

    pdfjsLib.GlobalWorkerOptions.workerSrc =
        PDFJS_WORKER_URL;

    const arrayBuffer =
        await file.arrayBuffer();

    const pdf =
        await pdfjsLib.getDocument({
            data: arrayBuffer
        }).promise;

    const worker =
        await Tesseract.createWorker(
            "rus",
            1,
            {
                logger: (message) => {
                    handleOcrProgress(message);
                }
            }
        );

    let fullText = "";

    try {

        for (
            let pageNumber = 1;
            pageNumber <= pdf.numPages;
            pageNumber++
        ) {

            showStatus(
                `Распознаём страницу ${pageNumber} из ${pdf.numPages}...`,
                "loading"
            );

            const page =
                await pdf.getPage(pageNumber);

            const scale = 1.5;

            const viewport =
                page.getViewport({
                    scale
                });

            const canvas =
                document.createElement("canvas");

            const context =
                canvas.getContext("2d", {
                    alpha: false
                });

            canvas.width =
                Math.ceil(viewport.width);

            canvas.height =
                Math.ceil(viewport.height);

            await page.render({
                canvasContext: context,
                viewport
            }).promise;

            const result =
                await worker.recognize(canvas);

            const pageText =
                result?.data?.text || "";

            fullText +=
                "\n\n" +
                `СТРАНИЦА ${pageNumber}\n` +
                pageText;

            canvas.width = 1;
            canvas.height = 1;
        }

    } finally {

        await worker.terminate();
    }

    return fullText;
}

// ======================================================
// OCR PROGRESS
// ======================================================

function handleOcrProgress(message) {

    if (!message) {
        return;
    }

    if (
        message.status === "recognizing text" &&
        typeof message.progress === "number"
    ) {

        const percent =
            Math.round(
                message.progress * 100
            );

        showStatus(
            `Распознаём текст... ${percent}%`,
            "loading"
        );
    }
}

// ======================================================
// НОРМАЛИЗАЦИЯ
// ======================================================

function normalizeText(text) {

    if (!text) {
        return "";
    }

    return text
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[^\S\n]+/g, " ")
        .trim();
}

// ======================================================
// АНАЛИЗ ДОКУМЕНТА
// ======================================================

function analyzeDocument(text) {

    const sentences =
        splitIntoSentences(text);

    const important = [];
    const worthKnowing = [];

    // --------------------------------------------------
    // АВТОПРОДЛЕНИЕ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "автоматически продлевается",
            "автоматическое продление",
            "автопродление",
            "продлевается автоматически",
            "если ни одна из сторон не заявит",
            "если не уведомит",
            "считается продленным",
            "считается продлённым"
        ],
        important,
        "Автоматическое продление",
        "Договор может продлиться автоматически, если вовремя не уведомить другую сторону."
    );

    // --------------------------------------------------
    // ШТРАФЫ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "штраф",
            "штрафа",
            "штрафом",
            "неустойка",
            "неустойки",
            "компенсация"
        ],
        important,
        "Штрафы и санкции",
        "В документе предусмотрена денежная ответственность за определённые нарушения."
    );

    // --------------------------------------------------
    // ПЕНИ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "пеня",
            "пени",
            "за каждый день просрочки",
            "за каждый день"
        ],
        important,
        "Пени за просрочку",
        "За нарушение срока оплаты или другого обязательства может начисляться пеня."
    );

    // --------------------------------------------------
    // ИЗМЕНЕНИЕ ЦЕНЫ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "изменить стоимость",
            "изменение стоимости",
            "изменить цену",
            "изменение цены",
            "вправе изменить цену",
            "вправе изменить стоимость",
            "стоимость может быть изменена",
            "тариф может быть изменен",
            "тариф может быть изменён",
            "тариф может измениться"
        ],
        important,
        "Изменение цены",
        "В документе есть условие, позволяющее изменить стоимость или тариф."
    );

    // --------------------------------------------------
    // ОПЛАТА
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "оплата",
            "оплатить",
            "оплачивается",
            "ежемесячная плата",
            "ежемесячно",
            "стоимость услуг",
            "абонентская плата"
        ],
        worthKnowing,
        "Оплата",
        "В документе указаны условия оплаты."
    );

    // --------------------------------------------------
    // КОМИССИЯ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "комиссия",
            "комиссии",
            "комиссионное вознаграждение",
            "дополнительная плата"
        ],
        important,
        "Комиссии и дополнительные платежи",
        "Помимо основной оплаты может взиматься дополнительная комиссия или плата."
    );

    // --------------------------------------------------
    // РАСТОРЖЕНИЕ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "расторгнуть",
            "расторжение",
            "прекратить договор",
            "прекращение договора",
            "уведомить за",
            "предварительно уведомить"
        ],
        worthKnowing,
        "Расторжение договора",
        "Обратите внимание на условия и срок уведомления для прекращения договора."
    );

    // --------------------------------------------------
    // ПЕРСОНАЛЬНЫЕ ДАННЫЕ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "персональных данных",
            "персональные данные",
            "обработка персональных данных",
            "третьим лицам",
            "третьих лиц",
            "передавать данные"
        ],
        important,
        "Персональные данные",
        "Документ предусматривает обработку или передачу персональных данных."
    );

    // --------------------------------------------------
    // РЕКЛАМА
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "рекламные сообщения",
            "рекламных сообщений",
            "рекламных рассылок",
            "рекламная рассылка",
            "рекламу"
        ],
        worthKnowing,
        "Рекламные сообщения",
        "Документ может предусматривать получение рекламных сообщений."
    );

    // --------------------------------------------------
    // ОТВЕТСТВЕННОСТЬ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "ограничение ответственности",
            "ограничивает ответственность",
            "не несет ответственности",
            "не несёт ответственности",
            "ответственность не несет",
            "ответственность не несёт"
        ],
        important,
        "Ограничение ответственности",
        "Одна из сторон ограничивает свою ответственность за возможные последствия."
    );

    // --------------------------------------------------
    // СРОК
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "срок действия",
            "срок договора",
            "действует с",
            "действует до",
            "на срок",
            "12 месяцев",
            "6 месяцев",
            "1 год",
            "2 года"
        ],
        worthKnowing,
        "Срок действия",
        "В документе указан срок действия договора или обязательства."
    );

    // --------------------------------------------------
    // ОГРАНИЧЕНИЯ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "запрещается",
            "запрещено",
            "не допускается",
            "не вправе",
            "ограничено",
            "ограничения"
        ],
        worthKnowing,
        "Ограничения",
        "В документе есть ограничения или действия, которые запрещены."
    );

    // --------------------------------------------------
    // ОБЪЕДИНЯЕМ ОДИНАКОВЫЕ КАТЕГОРИИ
    // --------------------------------------------------

    const groupedImportant =
        groupFindings(important);

    const groupedWorthKnowing =
        groupFindings(worthKnowing);

    // --------------------------------------------------
    // ДЕНЬГИ
    // --------------------------------------------------

    const moneyMatches =
        extractMoney(text);

    const percentages =
        extractPercentages(text);

    // --------------------------------------------------
    // СРОКИ
    // --------------------------------------------------

    const duration =
        detectDuration(text);

    // --------------------------------------------------
    // ИТОГ
    // --------------------------------------------------

    const totalFindings =
        groupedImportant.length +
        groupedWorthKnowing.length;

    return {

        summary:
            createSummary(
                groupedImportant,
                groupedWorthKnowing
            ),

        important:
            groupedImportant,

        worthKnowing:
            groupedWorthKnowing,

        payments:
            moneyMatches,

        percentages,

        duration,

        totalFindings
    };
}

// ======================================================
// ПОИСК
// ======================================================

function findMatches(
    sentences,
    keywords,
    target,
    title,
    description
) {

    for (const sentence of sentences) {

        const lower =
            sentence.toLowerCase();

        const matched =
            keywords.some(keyword =>
                lower.includes(
                    keyword.toLowerCase()
                )
            );

        if (!matched) {
            continue;
        }

        target.push({
            title,
            description,
            source: sentence.trim()
        });
    }
}

// ======================================================
// ОБЪЕДИНЕНИЕ ОДИНАКОВЫХ НАХОДОК
// ======================================================

function groupFindings(items) {

    const groups = new Map();

    for (const item of items) {

        const key =
            item.title.toLowerCase();

        if (!groups.has(key)) {

            groups.set(key, {
                title: item.title,
                description: item.description,
                sources: []
            });
        }

        const group =
            groups.get(key);

        if (
            item.source &&
            !group.sources.includes(item.source)
        ) {

            group.sources.push(
                item.source
            );
        }
    }

    return Array.from(
        groups.values()
    );
}

// ======================================================
// ПРЕДЛОЖЕНИЯ
// ======================================================

function splitIntoSentences(text) {

    return text
        .replace(/\n+/g, " ")
        .split(/(?<=[.!?;])\s+/)
        .map(sentence =>
            sentence.trim()
        )
        .filter(
            sentence =>
                sentence.length >= 15
        );
}

// ======================================================
// ДЕНЬГИ
// ======================================================

function extractMoney(text) {

    const matches =
        text.match(
            /\b\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{1,2})?\s*(?:₽|руб\.?|рублей|р\.)\b/gi
        );

    if (!matches) {
        return [];
    }

    return [
        ...new Set(
            matches.map(
                item => item.trim()
            )
        )
    ];
}

// ======================================================
// ПРОЦЕНТЫ
// ======================================================

function extractPercentages(text) {

    const matches =
        text.match(
            /\b\d+(?:[.,]\d+)?\s*%/gi
        );

    if (!matches) {
        return [];
    }

    return [
        ...new Set(
            matches.map(
                item => item.trim()
            )
        )
    ];
}

// ======================================================
// СРОК
// ======================================================

function detectDuration(text) {

    const patterns = [

        /\b\d+\s*(?:месяц|месяцев|месяца)\b/gi,

        /\b\d+\s*(?:год|года|лет)\b/gi,

        /\b\d+\s*(?:день|дня|дней)\b/gi
    ];

    const found = [];

    for (const pattern of patterns) {

        const matches =
            text.match(pattern);

        if (matches) {
            found.push(...matches);
        }
    }

    return [
        ...new Set(found)
    ];
}

// ======================================================
// SUMMARY
// ======================================================

function createSummary(
    important,
    worthKnowing
) {

    if (
        important.length === 0 &&
        worthKnowing.length === 0
    ) {

        return "Явных условий, требующих внимания, по текущим правилам не обнаружено.";
    }

    const total =
        important.length +
        worthKnowing.length;

    if (important.length >= 3) {

        return `Обнаружено ${total} условий, которые стоит проверить перед подписанием.`;
    }

    if (important.length > 0) {

        return `Обнаружено ${total} условий, которые стоит внимательно проверить.`;
    }

    return `Обнаружено ${total} условий, которые полезно учитывать.`;
}

// ======================================================
// РЕНДЕР РЕЗУЛЬТАТА
// ======================================================

function renderAnalysisResult(result) {

    clearPreviousResult();

    document.body.classList.add(
        "has-analysis"
    );

    const container =
        document.createElement("section");

    container.className =
        "analysis-result";

    const categoryCards =
        renderCategoryCards(result);

    container.innerHTML = `

        <div class="result-header">

            <div class="result-label">
                ПАСПОРТ ДОКУМЕНТА
            </div>

            <h2>
                Что нашли
            </h2>

            <p class="result-summary">
                ${escapeHtml(result.summary)}
            </p>

        </div>


        <div class="result-overview">

            <div class="overview-main">

                <span class="overview-number">
                    ${result.totalFindings}
                </span>

                <div>
                    <strong>
                        условий требуют внимания
                    </strong>

                    <span>
                        Нажмите на категорию, чтобы посмотреть детали
                    </span>
                </div>

            </div>

            <div class="overview-status">
                АНАЛИЗ ГОТОВ
            </div>

        </div>


        ${renderDurationCard(result)}

        <div class="result-categories">

            ${categoryCards}

        </div>


        <div class="result-disclaimer">

            <span>Справочная информация</span>

            Анализ выполняется автоматически.
            Он помогает обратить внимание на условия
            документа и не является юридической консультацией.

        </div>
    `;

    if (uploadCard) {

        uploadCard.insertAdjacentElement(
            "afterend",
            container
        );

    } else {

        document.body.appendChild(
            container
        );
    }

    requestAnimationFrame(() => {

        setTimeout(() => {

            container.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }, 150);
    });

    initResultInteractions();
}

// ======================================================
// КАТЕГОРИИ
// ======================================================

function renderCategoryCards(result) {

    const cards = [];

    // --------------------------------------------------
    // ВАЖНО
    // --------------------------------------------------

    if (result.important.length) {

        cards.push(
            createCategoryCard(
                "important",
                "!",
                "Важно",
                `${result.important.length} ${
                    pluralize(
                        result.important.length,
                        "условие",
                        "условия",
                        "условий"
                    )
                }`,
                "Условия, которые могут повлиять на деньги, обязанности или ваши права."
            )
        );
    }

    // --------------------------------------------------
    // ДЕНЬГИ
    // --------------------------------------------------

    if (
        result.payments.length ||
        result.percentages.length
    ) {

        const count =
            result.payments.length +
            result.percentages.length;

        cards.push(
            createCategoryCard(
                "money",
                "₽",
                "Деньги",
                `${count} ${
                    pluralize(
                        count,
                        "значение",
                        "значения",
                        "значений"
                    )
                }`,
                "Суммы, проценты и финансовые условия документа."
            )
        );
    }

    // --------------------------------------------------
    // СТОИТ ЗНАТЬ
    // --------------------------------------------------

    if (result.worthKnowing.length) {

        cards.push(
            createCategoryCard(
                "info",
                "i",
                "Стоит знать",
                `${result.worthKnowing.length} ${
                    pluralize(
                        result.worthKnowing.length,
                        "условие",
                        "условия",
                        "условий"
                    )
                }`,
                "Сроки, расторжение, ограничения и другие условия."
            )
        );
    }

    // --------------------------------------------------
    // СРОКИ
    // --------------------------------------------------

    if (result.duration.length) {

        cards.push(
            createCategoryCard(
                "duration",
                "◷",
                "Сроки",
                `${result.duration.length} ${
                    pluralize(
                        result.duration.length,
                        "значение",
                        "значения",
                        "значений"
                    )
                }`,
                "Обнаруженные сроки и продолжительность."
            )
        );
    }

    return cards.join("");
}

// ======================================================
// КАРТОЧКА КАТЕГОРИИ
// ======================================================

function createCategoryCard(
    type,
    icon,
    title,
    count,
    description
) {

    return `

        <button
            class="category-card category-${type}"
            type="button"
            data-category="${type}"
            aria-expanded="false"
        >

            <span class="category-icon">
                ${icon}
            </span>

            <span class="category-content">

                <strong>
                    ${title}
                </strong>

                <span>
                    ${count}
                </span>

            </span>

            <span class="category-arrow">
                →
            </span>

        </button>


        <div
            class="category-panel"
            data-panel="${type}"
            hidden
        >

            <div class="category-panel-inner">

                <div class="category-panel-description">
                    ${description}
                </div>

                <div class="category-panel-content"></div>

            </div>

        </div>
    `;
}

// ======================================================
// СРОКИ
// ======================================================

function renderDurationCard(result) {

    if (!result.duration.length) {
        return "";
    }

    return `

        <div class="compact-duration">

            <div class="compact-duration-icon">
                ◷
            </div>

            <div class="compact-duration-content">

                <span>
                    Сроки документа
                </span>

                <strong>
                    ${result.duration
                        .map(item =>
                            escapeHtml(item)
                        )
                        .join(" · ")
                    }
                </strong>

            </div>

        </div>
    `;
}

// ======================================================
// ВЗАИМОДЕЙСТВИЯ
// ======================================================

function initResultInteractions() {

    const buttons =
        document.querySelectorAll(
            ".category-card"
        );

    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const category =
                    button.dataset.category;

                const panel =
                    document.querySelector(
                        `[data-panel="${category}"]`
                    );

                if (!panel) {
                    return;
                }

                const isOpen =
                    button.getAttribute(
                        "aria-expanded"
                    ) === "true";

                // Закрываем остальные

                document
                    .querySelectorAll(
                        ".category-card[aria-expanded='true']"
                    )
                    .forEach(openButton => {

                        if (
                            openButton !== button
                        ) {

                            openButton.setAttribute(
                                "aria-expanded",
                                "false"
                            );

                            const otherCategory =
                                openButton.dataset.category;

                            const otherPanel =
                                document.querySelector(
                                    `[data-panel="${otherCategory}"]`
                                );

                            if (otherPanel) {
                                otherPanel.hidden =
                                    true;
                            }
                        }
                    });

                if (isOpen) {

                    button.setAttribute(
                        "aria-expanded",
                        "false"
                    );

                    panel.hidden = true;

                    return;
                }

                fillCategoryPanel(
                    category,
                    panel
                );

                button.setAttribute(
                    "aria-expanded",
                    "true"
                );

                panel.hidden = false;
            }
        );
    });
}

// ======================================================
// НАПОЛНЕНИЕ ОКНА КАТЕГОРИИ
// ======================================================

function fillCategoryPanel(
    category,
    panel
) {

    const content =
        panel.querySelector(
            ".category-panel-content"
        );

    if (!content) {
        return;
    }

    const result =
        document.querySelector(
            ".analysis-result"
        );

    if (!result) {
        return;
    }

    // --------------------------------------------------
    // Получаем результат из DOM-данных
    // --------------------------------------------------

    const analysis =
        window.__documentAnalysis;

    if (!analysis) {
        return;
    }

    // --------------------------------------------------
    // ВАЖНО
    // --------------------------------------------------

    if (category === "important") {

        content.innerHTML =
            analysis.important
                .map(
                    renderGroupedFinding
                )
                .join("");

        return;
    }

    // --------------------------------------------------
    // СТОИТ ЗНАТЬ
    // --------------------------------------------------

    if (category === "info") {

        content.innerHTML =
            analysis.worthKnowing
                .map(
                    renderGroupedFinding
                )
                .join("");

        return;
    }

    // --------------------------------------------------
    // ДЕНЬГИ
    // --------------------------------------------------

    if (category === "money") {

        content.innerHTML =
            renderMoneyPanel(
                analysis
            );

        return;
    }

    // --------------------------------------------------
    // СРОКИ
    // --------------------------------------------------

    if (category === "duration") {

        content.innerHTML =
            renderDurationPanel(
                analysis
            );

        return;
    }
}

// ======================================================
// НАХОДКА ВНУТРИ КАТЕГОРИИ
// ======================================================

function renderGroupedFinding(item) {

    return `

        <article class="detail-card">

            <div class="detail-card-top">

                <span class="detail-dot"></span>

                <h3>
                    ${escapeHtml(item.title)}
                </h3>

            </div>

            <p class="detail-description">
                ${escapeHtml(item.description)}
            </p>


            ${
                item.sources?.length
                    ? `
                        <div class="detail-sources">

                            <span class="detail-source-label">
                                Что сказано в документе
                            </span>

                            ${item.sources
                                .slice(0, 5)
                                .map(
                                    source => `
                                        <blockquote>
                                            «${escapeHtml(source)}»
                                        </blockquote>
                                    `
                                )
                                .join("")
                            }

                        </div>
                    `
                    : ""
            }

        </article>
    `;
}

// ======================================================
// ДЕНЬГИ ВНУТРИ КАТЕГОРИИ
// ======================================================

function renderMoneyPanel(result) {

    let html = "";

    if (result.payments.length) {

        html += `

            <div class="money-detail-block">

                <span class="detail-source-label">
                    Суммы
                </span>

                <div class="money-values">

                    ${result.payments
                        .map(
                            item => `
                                <span class="money-value">
                                    ${escapeHtml(item)}
                                </span>
                            `
                        )
                        .join("")
                    }

                </div>

            </div>
        `;
    }

    if (result.percentages.length) {

        html += `

            <div class="money-detail-block">

                <span class="detail-source-label">
                    Проценты
                </span>

                <div class="money-values">

                    ${result.percentages
                        .map(
                            item => `
                                <span class="percent-value">
                                    ${escapeHtml(item)}
                                </span>
                            `
                        )
                        .join("")
                    }

                </div>

            </div>
        `;
    }

    return html;
}

// ======================================================
// СРОКИ
// ======================================================

function renderDurationPanel(result) {

    return `

        <div class="duration-detail">

            <span class="detail-source-label">
                Обнаруженные значения
            </span>

            <div class="duration-values-large">

                ${result.duration
                    .map(
                        item => `
                            <span>
                                ${escapeHtml(item)}
                            </span>
                        `
                    )
                    .join("")
                }

            </div>

        </div>
    `;
}

// ======================================================
// СОХРАНЯЕМ РЕЗУЛЬТАТ
// ======================================================

function saveAnalysisResult(result) {

    window.__documentAnalysis =
        result;
}

// ======================================================
// РЕНДЕР — ПЕРЕОПРЕДЕЛЯЕМ ФУНКЦИЮ
// ======================================================

const originalRenderAnalysisResult =
    renderAnalysisResult;

// ======================================================
// ВАЖНО:
// сохраняем результат перед отображением
// ======================================================

function renderAnalysisResultWithData(result) {

    saveAnalysisResult(result);

    originalRenderAnalysisResult(result);
}

// ======================================================
// ПОДМЕНА ВЫЗОВА
// ======================================================

const oldHandleFile =
    handleFile;

// ======================================================
// ВЫБРАННЫЙ ФАЙЛ
// ======================================================

function showSelectedFile(file) {

    if (!uploadCard) {
        return;
    }

    uploadCard.innerHTML = `

        <div class="selected-file">

            <div class="selected-file-icon">

                ${
                    getFileType(file) === "pdf"
                        ? "PDF"
                        : "IMG"
                }

            </div>

            <div class="selected-file-info">

                <strong>
                    ${escapeHtml(file.name)}
                </strong>

                <span>
                    ${formatFileSize(file.size)}
                </span>

            </div>

        </div>


        <div
            class="import-status status-loading"
            id="importStatus"
        >
            Подготавливаем документ...
        </div>


        <button
            class="upload-button secondary-upload-button"
            id="changeFileButton"
            type="button"
        >
            Выбрать другой файл
        </button>
    `;

    const changeFileButton =
        document.getElementById(
            "changeFileButton"
        );

    if (changeFileButton) {

        changeFileButton.addEventListener(
            "click",
            () => {

                if (fileInput) {

                    fileInput.value = "";

                    fileInput.click();
                }
            }
        );
    }
}

// ======================================================
// СТАТУС
// ======================================================

function showStatus(
    message,
    type
) {

    const status =
        document.getElementById(
            "importStatus"
        );

    if (!status) {
        return;
    }

    status.textContent =
        message;

    status.className =
        `import-status status-${type}`;
}

// ======================================================
// ОЧИСТКА
// ======================================================

function clearPreviousResult() {

    const oldResult =
        document.querySelector(
            ".analysis-result"
        );

    if (oldResult) {
        oldResult.remove();
    }

    window.__documentAnalysis =
        null;

    document.body.classList.remove(
        "has-analysis"
    );
}

// ======================================================
// РАЗМЕР ФАЙЛА
// ======================================================

function formatFileSize(bytes) {

    if (bytes < 1024) {
        return `${bytes} Б`;
    }

    if (bytes < 1024 * 1024) {
        return `${Math.round(bytes / 1024)} КБ`;
    }

    return `${(
        bytes /
        (1024 * 1024)
    ).toFixed(1)} МБ`;
}

// ======================================================
// PLURAL
// ======================================================

function pluralize(
    number,
    one,
    few,
    many
) {

    const n =
        Math.abs(number) % 100;

    const n1 =
        n % 10;

    if (
        n >= 11 &&
        n <= 19
    ) {
        return many;
    }

    if (n1 === 1) {
        return one;
    }

    if (
        n1 >= 2 &&
        n1 <= 4
    ) {
        return few;
    }

    return many;
}

// ======================================================
// HTML SECURITY
// ======================================================

function escapeHtml(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

// ======================================================
// SLEEP
// ======================================================

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}

// ======================================================
// ВАЖНЫЙ FIX:
// сохраняем данные анализа
// ======================================================

const originalAnalyzeDocument =
    analyzeDocument;

function analyzeDocumentAndStore(text) {

    const result =
        originalAnalyzeDocument(text);

    saveAnalysisResult(result);

    return result;
}

// ======================================================
// ПЕРЕОПРЕДЕЛЯЕМ ГЛАВНЫЙ АНАЛИЗ
// ======================================================

const originalHandleFileFunction =
    handleFile;

// ------------------------------------------------------
// Исправляем renderAnalysisResult напрямую через
// сохранение результата в существующей функции.
// ------------------------------------------------------

const renderAnalysisResultOriginal =
    window.renderAnalysisResult;

// ======================================================
// ПЕРЕХВАТ РЕЗУЛЬТАТА
// ======================================================

// Так как функции находятся в одном файле,
// переиспользуем сохранение через Mutation-safe подход.
// ======================================================

// Обёртка для текущего результата
const _renderAnalysisResult =
    renderAnalysisResult;

// ======================================================
// ПЕРЕОПРЕДЕЛЕНИЕ
// ======================================================

renderAnalysisResult = function(result) {

    saveAnalysisResult(result);

    _renderAnalysisResult(result);
};