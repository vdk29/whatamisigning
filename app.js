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
        showStatus(validationError, "error");
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

            // Если PDF практически пустой —
            // считаем, что это скан.
            if (!text || text.trim().length < 80) {
                showStatus(
                    "Текстовый слой не найден. Запускаем распознавание...",
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

        // Небольшая пауза, чтобы браузер успел показать статус
        await sleep(150);

        const result = analyzeDocument(text);

        renderAnalysisResult(result);

        showStatus(
            `Готово. Найдено важных пунктов: ${result.totalFindings}`,
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
        const existing = document.querySelector(
            'script[data-pdfjs="true"]'
        );

        if (existing) {
            existing.addEventListener("load", () => {
                resolve(window.pdfjsLib);
            });

            existing.addEventListener("error", () => {
                reject(
                    new Error("Не удалось загрузить модуль чтения PDF.")
                );
            });

            return;
        }

        const script = document.createElement("script");

        script.src = PDFJS_URL;
        script.dataset.pdfjs = "true";

        script.onload = () => {
            if (!window.pdfjsLib) {
                reject(
                    new Error("PDF.js загрузился некорректно.")
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
// ИЗВЛЕЧЕНИЕ ТЕКСТА ИЗ ОБЫЧНОГО PDF
// ======================================================

async function extractPdfText(file) {
    const pdfjsLib = await loadPdfJs();

    pdfjsLib.GlobalWorkerOptions.workerSrc =
        PDFJS_WORKER_URL;

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer
    }).promise;

    let fullText = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        showStatus(
            `Читаем страницу ${pageNumber} из ${pdf.numPages}...`,
            "loading"
        );

        const page = await pdf.getPage(pageNumber);

        const textContent = await page.getTextContent();

        const pageText = textContent.items
            .map(item => item.str || "")
            .join(" ");

        fullText += "\n" + pageText;
    }

    return fullText;
}

// ======================================================
// TESSERACT.JS
// ======================================================

async function loadTesseract() {
    if (window.Tesseract) {
        return window.Tesseract;
    }

    return new Promise((resolve, reject) => {
        const existing = document.querySelector(
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

        const script = document.createElement("script");

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
    const Tesseract = await loadTesseract();

    showStatus(
        "Запускаем распознавание русского текста...",
        "loading"
    );

    const worker = await Tesseract.createWorker("rus", 1, {
        logger: (message) => {
            handleOcrProgress(message);
        }
    });

    try {
        const result = await worker.recognize(file);

        return result?.data?.text || "";
    } finally {
        await worker.terminate();
    }
}

// ======================================================
// OCR СКАНИРОВАННОГО PDF
// ======================================================

async function ocrPdf(file) {
    const pdfjsLib = await loadPdfJs();
    const Tesseract = await loadTesseract();

    pdfjsLib.GlobalWorkerOptions.workerSrc =
        PDFJS_WORKER_URL;

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer
    }).promise;

    const worker = await Tesseract.createWorker("rus", 1, {
        logger: (message) => {
            handleOcrProgress(message);
        }
    });

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

            const page = await pdf.getPage(pageNumber);

            // Масштаб OCR.
            // 1.5 даёт хороший баланс между качеством
            // и скоростью на телефоне.
            const scale = 1.5;

            const viewport = page.getViewport({
                scale
            });

            const canvas = document.createElement("canvas");

            const context = canvas.getContext("2d", {
                alpha: false
            });

            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);

            await page.render({
                canvasContext: context,
                viewport
            }).promise;

            const result = await worker.recognize(canvas);

            const pageText =
                result?.data?.text || "";

            fullText +=
                "\n\n" +
                `СТРАНИЦА ${pageNumber}\n` +
                pageText;

            // Освобождаем память телефона
            canvas.width = 1;
            canvas.height = 1;
        }
    } finally {
        await worker.terminate();
    }

    return fullText;
}

// ======================================================
// OCR ПРОГРЕСС
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
            Math.round(message.progress * 100);

        showStatus(
            `Распознаём текст... ${percent}%`,
            "loading"
        );
    }
}

// ======================================================
// НОРМАЛИЗАЦИЯ ТЕКСТА
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
    const sentences = splitIntoSentences(text);

    const important = [];
    const worthKnowing = [];
    const clear = [];

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
            "считается продленным"
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
        "Штраф или санкция",
        "В документе предусмотрена денежная ответственность."
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
        "Дополнительная комиссия",
        "Помимо основной оплаты может взиматься дополнительная комиссия."
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
        "Ограничение",
        "В документе есть ограничения или действия, которые запрещены."
    );

    // --------------------------------------------------
    // ДЕНЬГИ
    // --------------------------------------------------

    const moneyMatches = extractMoney(text);

    if (moneyMatches.length > 0) {
        clear.push({
            title: "Денежные суммы",
            description:
                "В документе обнаружены конкретные суммы денег.",
            source:
                moneyMatches.slice(0, 8).join(", ")
        });
    }

    // --------------------------------------------------
    // ПРОЦЕНТЫ
    // --------------------------------------------------

    const percentages = extractPercentages(text);

    if (percentages.length > 0) {
        important.push({
            title: "Процентные условия",
            description:
                "В документе обнаружены процентные значения, которые могут влиять на оплату или ответственность.",
            source:
                percentages.slice(0, 10).join(", ")
        });
    }

    // --------------------------------------------------
    // УДАЛЯЕМ ДУБЛИКАТЫ
    // --------------------------------------------------

    const uniqueImportant =
        removeDuplicates(important);

    const uniqueWorthKnowing =
        removeDuplicates(worthKnowing);

    const uniqueClear =
        removeDuplicates(clear);

    const totalFindings =
        uniqueImportant.length +
        uniqueWorthKnowing.length;

    return {
        summary: createSummary(
            uniqueImportant,
            uniqueWorthKnowing,
            uniqueClear
        ),

        important: uniqueImportant,

        worthKnowing: uniqueWorthKnowing,

        clear: uniqueClear,

        payments: moneyMatches,

        percentages,

        duration: detectDuration(text),

        totalFindings
    };
}

// ======================================================
// ПОИСК КЛЮЧЕВЫХ ФРАЗ
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
                lower.includes(keyword.toLowerCase())
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
// ПРЕДЛОЖЕНИЯ
// ======================================================

function splitIntoSentences(text) {
    return text
        .replace(/\n+/g, " ")
        .split(/(?<=[.!?;])\s+/)
        .map(sentence => sentence.trim())
        .filter(sentence => sentence.length >= 15);
}

// ======================================================
// ДЕНЕЖНЫЕ СУММЫ
// ======================================================

function extractMoney(text) {
    const matches = text.match(
        /\b\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{1,2})?\s*(?:₽|руб\.?|рублей|р\.)\b/gi
    );

    if (!matches) {
        return [];
    }

    return [...new Set(
        matches.map(item => item.trim())
    )];
}

// ======================================================
// ПРОЦЕНТЫ
// ======================================================

function extractPercentages(text) {
    const matches = text.match(
        /\b\d+(?:[.,]\d+)?\s*%/gi
    );

    if (!matches) {
        return [];
    }

    return [...new Set(
        matches.map(item => item.trim())
    )];
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

    return [...new Set(found)];
}

// ======================================================
// SUMMARY
// ======================================================

function createSummary(
    important,
    worthKnowing,
    clear
) {
    if (
        important.length === 0 &&
        worthKnowing.length === 0
    ) {
        return "Явных рискованных условий по текущим правилам не обнаружено.";
    }

    if (important.length >= 3) {
        return "В документе обнаружено несколько условий, на которые стоит обратить особое внимание перед подписанием.";
    }

    if (important.length > 0) {
        return "В документе есть условия, которые стоит внимательно проверить перед подписанием.";
    }

    return "Документ содержит несколько условий, которые полезно учитывать.";
}

// ======================================================
// УДАЛЕНИЕ ДУБЛИКАТОВ
// ======================================================

function removeDuplicates(items) {
    const result = [];
    const seen = new Set();

    for (const item of items) {
        const key =
            `${item.title}|${item.source}`;

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        result.push(item);
    }

    return result;
}

// ======================================================
// РЕНДЕР РЕЗУЛЬТАТА
// ======================================================

function renderAnalysisResult(result) {
    clearPreviousResult();

    const container =
        document.createElement("section");

    container.className = "analysis-result";

    container.innerHTML = `
        <div class="result-header">
            <div class="result-label">
                Результат анализа
            </div>

            <h2>
                Что найдено в документе
            </h2>

            <p class="result-summary">
                ${escapeHtml(result.summary)}
            </p>
        </div>

        ${renderDuration(result)}

        ${renderImportant(result.important)}

        ${renderWorthKnowing(result.worthKnowing)}

        ${renderMoney(result)}

        ${renderClear(result.clear)}

        <div class="result-disclaimer">
            Анализ выполняется автоматически и носит
            справочный характер. Он не является юридической
            консультацией и не заменяет проверку документа
            специалистом.
        </div>
    `;

    if (uploadCard) {
        uploadCard.insertAdjacentElement(
            "afterend",
            container
        );
    } else {
        document.body.appendChild(container);
    }

    setTimeout(() => {
        container.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }, 100);
}

// ======================================================
// ВАЖНОЕ
// ======================================================

function renderImportant(items) {
    if (!items.length) {
        return "";
    }

    return `
        <div class="result-section result-important">
            <div class="result-section-title">
                <span>🔴</span>
                Важно
            </div>

            ${items.map(renderFinding).join("")}
        </div>
    `;
}

// ======================================================
// СТОИТ ЗНАТЬ
// ======================================================

function renderWorthKnowing(items) {
    if (!items.length) {
        return "";
    }

    return `
        <div class="result-section result-worth-knowing">
            <div class="result-section-title">
                <span>🟡</span>
                Стоит знать
            </div>

            ${items.map(renderFinding).join("")}
        </div>
    `;
}

// ======================================================
// ПОНЯТНО
// ======================================================

function renderClear(items) {
    if (!items.length) {
        return "";
    }

    return `
        <div class="result-section result-clear">
            <div class="result-section-title">
                <span>🟢</span>
                Обнаружено
            </div>

            ${items.map(renderFinding).join("")}
        </div>
    `;
}

// ======================================================
// ДЕНЬГИ
// ======================================================

function renderMoney(result) {
    if (
        (!result.payments || result.payments.length === 0) &&
        (!result.percentages || result.percentages.length === 0)
    ) {
        return "";
    }

    return `
        <div class="result-section result-money">
            <div class="result-section-title">
                <span>₽</span>
                Деньги
            </div>

            ${
                result.payments?.length
                    ? `
                        <div class="result-money-block">
                            <strong>Найденные суммы</strong>
                            <div class="money-list">
                                ${result.payments
                                    .map(item =>
                                        `<span>${escapeHtml(item)}</span>`
                                    )
                                    .join("")}
                            </div>
                        </div>
                    `
                    : ""
            }

            ${
                result.percentages?.length
                    ? `
                        <div class="result-money-block">
                            <strong>Проценты</strong>
                            <div class="money-list">
                                ${result.percentages
                                    .map(item =>
                                        `<span>${escapeHtml(item)}</span>`
                                    )
                                    .join("")}
                            </div>
                        </div>
                    `
                    : ""
            }
        </div>
    `;
}

// ======================================================
// СРОК
// ======================================================

function renderDuration(result) {
    if (!result.duration?.length) {
        return "";
    }

    return `
        <div class="result-duration">
            <span class="result-duration-label">
                Сроки
            </span>

            <div class="duration-values">
                ${result.duration
                    .map(item =>
                        `<span>${escapeHtml(item)}</span>`
                    )
                    .join("")}
            </div>
        </div>
    `;
}

// ======================================================
// КАРТОЧКА НАЙДЕННОГО ПУНКТА
// ======================================================

function renderFinding(item) {
    return `
        <article class="finding-card">
            <h3>
                ${escapeHtml(item.title)}
            </h3>

            <p>
                ${escapeHtml(item.description)}
            </p>

            ${
                item.source
                    ? `
                        <div class="finding-source">
                            <span>
                                Фрагмент документа
                            </span>

                            <blockquote>
                                «${escapeHtml(item.source)}»
                            </blockquote>
                        </div>
                    `
                    : ""
            }
        </article>
    `;
}

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
                ${getFileType(file) === "pdf" ? "PDF" : "IMG"}
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
        document.getElementById("changeFileButton");

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

function showStatus(message, type) {
    const status =
        document.getElementById("importStatus");

    if (!status) {
        return;
    }

    status.textContent = message;

    status.className =
        `import-status status-${type}`;
}

// ======================================================
// ОЧИСТКА ПРЕДЫДУЩЕГО РЕЗУЛЬТАТА
// ======================================================

function clearPreviousResult() {
    const oldResult =
        document.querySelector(".analysis-result");

    if (oldResult) {
        oldResult.remove();
    }
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

    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

// ======================================================
// HTML SECURITY
// ======================================================

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ======================================================
// SLEEP
// ======================================================

function sleep(ms) {
    return new Promise(resolve =>
        setTimeout(resolve, ms)
    );
}