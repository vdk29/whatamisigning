// ======================================================
// ЧТО Я ПОДПИСЫВАЮ?
// LOCAL DOCUMENT ANALYZER
// Версия 1.0
// Без OpenAI / Supabase / внешнего AI
// ======================================================

const fileInput = document.getElementById("fileInput");
const uploadArea = document.querySelector(".upload-area");
const uploadContent = document.querySelector(".upload-content");
const selectedFile = document.querySelector(".selected-file");
const selectedFileName = document.querySelector(".selected-file-name");
const selectedFileSize = document.querySelector(".selected-file-size");
const changeFileButton = document.querySelector(".change-file-button");
const importStatus = document.getElementById("importStatus");

const MAX_FILE_SIZE = 20 * 1024 * 1024;

let currentFile = null;

// ------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ
// ------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    setupUpload();
});

// ------------------------------------------------------
// ЗАГРУЗКА PDF.JS
// ------------------------------------------------------

async function loadPdfJs() {
    if (window.pdfjsLib) {
        return window.pdfjsLib;
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement("script");

        script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";

        script.onload = () => {
            if (!window.pdfjsLib) {
                reject(new Error("PDF.js не загрузился"));
                return;
            }

            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

            resolve(window.pdfjsLib);
        };

        script.onerror = () => {
            reject(new Error("Не удалось загрузить PDF.js"));
        };

        document.head.appendChild(script);
    });
}

// ------------------------------------------------------
// UPLOAD
// ------------------------------------------------------

function setupUpload() {
    if (!fileInput) return;

    fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) {
            handleFile(fileInput.files[0]);
        }
    });

    if (uploadArea) {
        uploadArea.addEventListener("dragover", (event) => {
            event.preventDefault();
            uploadArea.classList.add("drag-active");
        });

        uploadArea.addEventListener("dragleave", () => {
            uploadArea.classList.remove("drag-active");
        });

        uploadArea.addEventListener("drop", (event) => {
            event.preventDefault();

            uploadArea.classList.remove("drag-active");

            const files = event.dataTransfer.files;

            if (files.length > 0) {
                handleFile(files[0]);
            }
        });
    }

    if (changeFileButton) {
        changeFileButton.addEventListener("click", () => {
            resetUpload();
            fileInput.click();
        });
    }
}

// ------------------------------------------------------
// FILE
// ------------------------------------------------------

async function handleFile(file) {
    clearStatus();

    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
        showError("Файл слишком большой. Максимальный размер — 20 МБ.");
        return;
    }

    const fileName = file.name.toLowerCase();

    if (!fileName.endsWith(".pdf")) {
        showError(
            "Пока поддерживаются PDF-файлы. Поддержку JPG и PNG добавим следующим этапом."
        );
        return;
    }

    currentFile = file;

    showSelectedFile(file);

    await analyzePdf(file);
}

// ------------------------------------------------------
// SELECTED FILE
// ------------------------------------------------------

function showSelectedFile(file) {
    if (uploadContent) {
        uploadContent.style.display = "none";
    }

    if (selectedFile) {
        selectedFile.style.display = "block";
    }

    if (selectedFileName) {
        selectedFileName.textContent = file.name;
    }

    if (selectedFileSize) {
        selectedFileSize.textContent = formatFileSize(file.size);
    }

    setStatus("Документ загружен. Подготавливаем анализ…", "loading");
}

function resetUpload() {
    currentFile = null;

    if (fileInput) {
        fileInput.value = "";
    }

    if (uploadContent) {
        uploadContent.style.display = "";
    }

    if (selectedFile) {
        selectedFile.style.display = "none";
    }

    clearStatus();

    const oldResult = document.querySelector(".analysis-result");

    if (oldResult) {
        oldResult.remove();
    }
}

// ------------------------------------------------------
// PDF → TEXT
// ------------------------------------------------------

async function extractPdfText(file) {
    const pdfjsLib = await loadPdfJs();

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer
    }).promise;

    let fullText = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        setStatus(
            `Читаем страницу ${pageNumber} из ${pdf.numPages}…`,
            "loading"
        );

        const page = await pdf.getPage(pageNumber);

        const textContent = await page.getTextContent();

        const pageText = textContent.items
            .map((item) => item.str || "")
            .join(" ");

        fullText += "\n\n" + pageText;
    }

    return normalizeText(fullText);
}

// ------------------------------------------------------
// NORMALIZE
// ------------------------------------------------------

function normalizeText(text) {
    return text
        .replace(/\u00A0/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// ------------------------------------------------------
// ANALYZE PDF
// ------------------------------------------------------

async function analyzePdf(file) {
    try {
        setStatus("Извлекаем текст из документа…", "loading");

        const text = await extractPdfText(file);

        if (!text || text.length < 50) {
            showError(
                "Не удалось извлечь текст из PDF. Возможно, это скан или изображение. OCR добавим следующим этапом."
            );
            return;
        }

        setStatus("Анализируем условия документа…", "loading");

        const result = analyzeDocument(text);

        renderAnalysisResult(result);

        setStatus(
            `Анализ завершён. Найдено важных условий: ${result.totalFindings}`,
            "success"
        );
    } catch (error) {
        console.error(error);

        showError(
            "Не удалось прочитать документ. Попробуйте другой PDF-файл."
        );
    }
}

// ======================================================
// DOCUMENT ANALYZER
// ======================================================

function analyzeDocument(text) {
    const sentences = splitIntoSentences(text);

    const important = [];
    const worthKnowing = [];
    const clear = [];
    const payments = [];

    // --------------------------------------------------
    // 1. АВТОПРОДЛЕНИЕ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "автоматически продлевается",
            "автоматическое продление",
            "продлевается автоматически",
            "автоматически пролонгируется",
            "пролонгация",
            "если ни одна из сторон не заявит",
            "если не будет направлено уведомление"
        ],
        (sentence) => {
            important.push({
                title: "Автоматическое продление",
                explanation:
                    "Договор может продлиться автоматически, если вовремя не выполнить условия для его прекращения.",
                source: sentence,
                severity: "red"
            });
        }
    );

    // --------------------------------------------------
    // 2. ШТРАФ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "штраф",
            "штрафа",
            "штрафом",
            "штрафные санкции",
            "санкция"
        ],
        (sentence) => {
            important.push({
                title: "Штрафные санкции",
                explanation:
                    "В документе обнаружено условие о штрафе или другой санкции.",
                source: sentence,
                severity: "red"
            });

            payments.push({
                title: "Штраф",
                explanation:
                    "Проверьте размер штрафа и обстоятельства, при которых он начисляется.",
                source: sentence,
                severity: "red"
            });
        }
    );

    // --------------------------------------------------
    // 3. ПЕНЯ / НЕУСТОЙКА
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "пеня",
            "пени",
            "неустойка",
            "неустойки",
            "начисляется за каждый день"
        ],
        (sentence) => {
            important.push({
                title: "Пеня или неустойка",
                explanation:
                    "За определённое нарушение может начисляться дополнительная сумма.",
                source: sentence,
                severity: "red"
            });

            payments.push({
                title: "Дополнительные начисления",
                explanation:
                    "Проверьте размер и порядок начисления пени или неустойки.",
                source: sentence,
                severity: "red"
            });
        }
    );

    // --------------------------------------------------
    // 4. ИЗМЕНЕНИЕ ЦЕНЫ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "изменить стоимость",
            "изменение стоимости",
            "стоимость может быть изменена",
            "цена может быть изменена",
            "изменять тариф",
            "изменение тарифа",
            "вправе изменить тариф",
            "вправе изменить стоимость"
        ],
        (sentence) => {
            important.push({
                title: "Изменение стоимости",
                explanation:
                    "Документ допускает изменение стоимости или тарифа.",
                source: sentence,
                severity: "red"
            });

            payments.push({
                title: "Цена может измениться",
                explanation:
                    "Обратите внимание на условия и порядок изменения цены.",
                source: sentence,
                severity: "red"
            });
        }
    );

    // --------------------------------------------------
    // 5. КОМИССИЯ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "комиссия",
            "комиссионный сбор",
            "дополнительная комиссия",
            "сбор за"
        ],
        (sentence) => {
            payments.push({
                title: "Комиссия или дополнительный сбор",
                explanation:
                    "В документе найдено условие о дополнительном платеже.",
                source: sentence,
                severity: "yellow"
            });
        }
    );

    // --------------------------------------------------
    // 6. ОПЛАТА
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "оплата производится",
            "оплата осуществляется",
            "ежемесячная плата",
            "ежемесячный платеж",
            "ежемесячная оплата",
            "платёж",
            "платеж",
            "абонентская плата"
        ],
        (sentence) => {
            payments.push({
                title: "Платёжное обязательство",
                explanation:
                    "В документе указано обязательство по оплате.",
                source: sentence,
                severity: "yellow"
            });
        }
    );

    // --------------------------------------------------
    // 7. РАСТОРЖЕНИЕ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "расторжение договора",
            "расторгнуть договор",
            "расторгнуть настоящий договор",
            "отказаться от договора",
            "прекратить договор"
        ],
        (sentence) => {
            worthKnowing.push({
                title: "Расторжение договора",
                explanation:
                    "В документе есть условия прекращения или расторжения договора.",
                source: sentence,
                severity: "yellow"
            });
        }
    );

    // --------------------------------------------------
    // 8. УВЕДОМЛЕНИЕ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "уведомить",
            "уведомление",
            "письменно уведомить",
            "предварительно уведомить",
            "не позднее чем за"
        ],
        (sentence) => {
            worthKnowing.push({
                title: "Требуется уведомление",
                explanation:
                    "Для совершения определённого действия может потребоваться предварительное уведомление.",
                source: sentence,
                severity: "yellow"
            });
        }
    );

    // --------------------------------------------------
    // 9. ПЕРСОНАЛЬНЫЕ ДАННЫЕ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "персональные данные",
            "обработка персональных данных",
            "обработку персональных данных",
            "третьим лицам",
            "передача персональных данных"
        ],
        (sentence) => {
            worthKnowing.push({
                title: "Персональные данные",
                explanation:
                    "Документ содержит условия об обработке или передаче персональных данных.",
                source: sentence,
                severity: "yellow"
            });
        }
    );

    // --------------------------------------------------
    // 10. ОГРАНИЧЕНИЕ ОТВЕТСТВЕННОСТИ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "не несет ответственности",
            "не несёт ответственности",
            "ограничивает ответственность",
            "ограничение ответственности",
            "не отвечает за",
            "не отвечает перед"
        ],
        (sentence) => {
            important.push({
                title: "Ограничение ответственности",
                explanation:
                    "Одна из сторон ограничивает свою ответственность за определённые обстоятельства.",
                source: sentence,
                severity: "red"
            });
        }
    );

    // --------------------------------------------------
    // 11. СРОК ДОГОВОРА
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "срок действия договора",
            "договор действует",
            "срок договора",
            "договор заключен сроком",
            "договор заключён сроком"
        ],
        (sentence) => {
            worthKnowing.push({
                title: "Срок действия",
                explanation:
                    "В документе указан срок действия договора.",
                source: sentence,
                severity: "yellow"
            });
        }
    );

    // --------------------------------------------------
    // 12. ОГРАНИЧЕНИЯ
    // --------------------------------------------------

    findMatches(
        sentences,
        [
            "запрещается",
            "запрещено",
            "не допускается",
            "не вправе",
            "вправе отказать"
        ],
        (sentence) => {
            worthKnowing.push({
                title: "Ограничение",
                explanation:
                    "В документе найдено ограничение прав или действий стороны.",
                source: sentence,
                severity: "yellow"
            });
        }
    );

    // --------------------------------------------------
    // 13. СУММЫ ДЕНЕГ
    // --------------------------------------------------

    const moneyMatches = text.match(
        /(?:\d[\d\s]{0,15}(?:[.,]\d{1,2})?\s?(?:₽|руб(?:\.|лей)?|рубля|рублей))/gi
    );

    if (moneyMatches && moneyMatches.length > 0) {
        const uniqueMoney = [...new Set(moneyMatches)];

        payments.push({
            title: "Обнаружены денежные суммы",
            explanation:
                "В документе найдены конкретные суммы. Проверьте, за что именно они взимаются.",
            source: uniqueMoney.slice(0, 10).join(", "),
            severity: "yellow"
        });
    }

    // --------------------------------------------------
    // 14. ПОЛОЖИТЕЛЬНЫЕ / ОБЫЧНЫЕ УСЛОВИЯ
    // --------------------------------------------------

    if (
        important.length === 0 &&
        worthKnowing.length === 0 &&
        payments.length === 0
    ) {
        clear.push({
            title: "Критичных условий не найдено",
            explanation:
                "Автоматический анализ не обнаружил знакомых нам потенциально важных конструкций.",
            source: "",
            severity: "green"
        });
    }

    // --------------------------------------------------
    // УДАЛЯЕМ ДУБЛИКАТЫ
    // --------------------------------------------------

    const result = {
        summary: createSummary(
            important,
            worthKnowing,
            payments
        ),

        important: removeDuplicates(important),

        worthKnowing: removeDuplicates(worthKnowing),

        clear: removeDuplicates(clear),

        payments: removeDuplicates(payments),

        duration: extractDuration(text),

        totalFindings:
            removeDuplicates(important).length +
            removeDuplicates(worthKnowing).length +
            removeDuplicates(payments).length
    };

    return result;
}

// ======================================================
// SENTENCES
// ======================================================

function splitIntoSentences(text) {
    return text
        .replace(/\s+/g, " ")
        .split(/(?<=[.!?;])\s+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length >= 20);
}

// ======================================================
// MATCHES
// ======================================================

function findMatches(sentences, keywords, callback) {
    for (const sentence of sentences) {
        const lower = sentence.toLowerCase();

        const matched = keywords.some((keyword) =>
            lower.includes(keyword.toLowerCase())
        );

        if (matched) {
            callback(sentence);
        }
    }
}

// ======================================================
// SUMMARY
// ======================================================

function createSummary(important, worthKnowing, payments) {
    const importantCount = important.length;
    const warningCount = worthKnowing.length;
    const paymentCount = payments.length;

    if (importantCount > 0) {
        return `Мы нашли ${importantCount} потенциально важных условий. Обратите особое внимание на красные пункты.`;
    }

    if (paymentCount > 0 || warningCount > 0) {
        return "Критичных условий не обнаружено, но в документе есть пункты, которые стоит внимательно проверить.";
    }

    return "Автоматический анализ не обнаружил известных потенциально проблемных условий.";
}

// ======================================================
// DURATION
// ======================================================

function extractDuration(text) {
    const patterns = [
        /(?:срок действия|срок договора|договор действует)[^.]{0,150}/gi,
        /(?:на срок|сроком на)\s+\d+\s+(?:дн(?:ей|я)?|месяц(?:ев|а)?|год(?:а|лет)?)/gi
    ];

    const results = [];

    for (const pattern of patterns) {
        const matches = text.match(pattern);

        if (matches) {
            results.push(...matches);
        }
    }

    return [...new Set(results)]
        .slice(0, 3)
        .join(". ");
}

// ======================================================
// DUPLICATES
// ======================================================

function removeDuplicates(items) {
    const seen = new Set();

    return items.filter((item) => {
        const key =
            `${item.title}|${item.source}`.toLowerCase();

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

// ======================================================
// RENDER
// ======================================================

function renderAnalysisResult(result) {
    const oldResult = document.querySelector(".analysis-result");

    if (oldResult) {
        oldResult.remove();
    }

    const resultElement = document.createElement("section");

    resultElement.className = "analysis-result";

    resultElement.innerHTML = `
        <div class="result-header">
            <div>
                <div class="result-label">ПАСПОРТ ДОКУМЕНТА</div>
                <h2>Что мы нашли</h2>
            </div>
        </div>

        <div class="result-summary">
            ${escapeHtml(result.summary)}
        </div>

        ${
            result.duration
                ? `
                <div class="result-duration">
                    <div class="result-section-title">
                        📅 Срок
                    </div>
                    <p>${escapeHtml(result.duration)}</p>
                </div>
                `
                : ""
        }

        ${renderSection(
            "🔴",
            "Важно",
            result.important,
            "result-red"
        )}

        ${renderSection(
            "🟡",
            "Стоит знать",
            result.worthKnowing,
            "result-yellow"
        )}

        ${renderSection(
            "💰",
            "Деньги",
            result.payments,
            "result-money"
        )}

        ${renderSection(
            "🟢",
            "Явно важных рисков не найдено",
            result.clear,
            "result-green"
        )}

        <div class="result-disclaimer">
            Автоматический анализ носит справочный характер
            и не является юридической консультацией.
        </div>
    `;

    const uploadSection =
        document.querySelector(".upload-card") ||
        document.querySelector(".upload-section") ||
        uploadArea?.parentElement;

    if (uploadSection && uploadSection.parentElement) {
        uploadSection.parentElement.insertBefore(
            resultElement,
            uploadSection.nextSibling
        );
    } else {
        document.body.appendChild(resultElement);
    }

    resultElement.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// ======================================================
// SECTION
// ======================================================

function renderSection(icon, title, items, className) {
    if (!items || items.length === 0) {
        return "";
    }

    return `
        <div class="result-section ${className}">
            <div class="result-section-title">
                <span>${icon}</span>
                <span>${escapeHtml(title)}</span>
            </div>

            <div class="finding-list">
                ${items
                    .map(
                        (item) => `
                            <article class="finding-card">
                                <h3>
                                    ${escapeHtml(item.title)}
                                </h3>

                                <p>
                                    ${escapeHtml(item.explanation)}
                                </p>

                                ${
                                    item.source
                                        ? `
                                            <details>
                                                <summary>
                                                    Почему мы это отметили
                                                </summary>

                                                <div class="finding-source">
                                                    «${escapeHtml(
                                                        item.source
                                                    )}»
                                                </div>
                                            </details>
                                        `
                                        : ""
                                }
                            </article>
                        `
                    )
                    .join("")}
            </div>
        </div>
    `;
}

// ======================================================
// STATUS
// ======================================================

function setStatus(message, type = "") {
    if (!importStatus) return;

    importStatus.textContent = message;

    importStatus.className = "";

    if (type) {
        importStatus.classList.add(`status-${type}`);
    }
}

function clearStatus() {
    if (!importStatus) return;

    importStatus.textContent = "";
    importStatus.className = "";
}

function showError(message) {
    setStatus(message, "error");
}

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} Б`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} КБ`;
    }

    return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
}

// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}