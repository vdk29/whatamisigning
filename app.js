// ======================================================
// ЧТО Я ПОДПИСЫВАЮ?
// APP.JS
// ======================================================

const SUPABASE_FUNCTION_URL =
    "https://dazniyfntumbljkocjoo.supabase.co/functions/v1/swift-service";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png"
];

const uploadCard = document.getElementById("uploadCard");
const uploadButton = document.getElementById("uploadButton");
const fileInput = document.getElementById("fileInput");
const howItWorksButton = document.getElementById("howItWorksButton");
const modal = document.getElementById("howItWorksModal");
const modalClose = document.getElementById("modalClose");


// ======================================================
// PDF.JS
// ======================================================

let pdfJsLoaded = false;

function loadPdfJs() {
    return new Promise((resolve, reject) => {

        if (pdfJsLoaded && window.pdfjsLib) {
            resolve();
            return;
        }

        const script = document.createElement("script");

        script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

        script.type = "module";

        script.onload = () => {
            setTimeout(() => {

                if (window.pdfjsLib) {
                    pdfJsLoaded = true;
                    resolve();
                } else {
                    reject(
                        new Error("PDF.js не загрузился")
                    );
                }

            }, 500);
        };

        script.onerror = () => {
            reject(
                new Error("Не удалось загрузить PDF.js")
            );
        };

        document.head.appendChild(script);
    });
}


// ======================================================
// ИНИЦИАЛИЗАЦИЯ
// ======================================================

document.addEventListener("DOMContentLoaded", () => {

    setupUploadEvents();
    setupModal();

});


// ======================================================
// UPLOAD
// ======================================================

function setupUploadEvents() {

    if (!uploadCard || !fileInput) {
        console.error("Элементы загрузки не найдены");
        return;
    }

    if (uploadButton) {

        uploadButton.addEventListener("click", (event) => {

            event.preventDefault();

            fileInput.click();

        });

    }

    fileInput.addEventListener("change", () => {

        const file = fileInput.files?.[0];

        if (!file) {
            return;
        }

        handleFile(file);

    });


    // Drag & Drop

    uploadCard.addEventListener("dragover", (event) => {

        event.preventDefault();

        uploadCard.classList.add("dragover");

    });

    uploadCard.addEventListener("dragleave", () => {

        uploadCard.classList.remove("dragover");

    });

    uploadCard.addEventListener("drop", (event) => {

        event.preventDefault();

        uploadCard.classList.remove("dragover");

        const file = event.dataTransfer.files?.[0];

        if (!file) {
            return;
        }

        handleFile(file);

    });

}


// ======================================================
// FILE VALIDATION
// ======================================================

function handleFile(file) {

    if (!ALLOWED_TYPES.includes(file.type)) {

        showError(
            "Неподдерживаемый формат",
            "Загрузите PDF, JPG или PNG."
        );

        return;
    }

    if (file.size > MAX_FILE_SIZE) {

        showError(
            "Файл слишком большой",
            "Максимальный размер документа — 20 МБ."
        );

        return;
    }

    showSelectedFile(file);
}


// ======================================================
// SELECTED FILE
// ======================================================

function showSelectedFile(file) {

    uploadCard.innerHTML = `
        <div class="upload-success">
            <div class="success-icon">✓</div>

            <h3>Документ загружен</h3>

            <div class="selected-file-name">
                ${escapeHtml(file.name)}
            </div>

            <div class="selected-file-size">
                ${formatFileSize(file.size)}
            </div>

            <button
                class="primary-button analyze-button"
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
                Документ обрабатывается безопасно
            </div>
        </div>
    `;


    const analyzeButton =
        document.getElementById("analyzeButton");

    const changeFileButton =
        document.getElementById("changeFileButton");


    if (analyzeButton) {

        analyzeButton.addEventListener(
            "click",
            () => analyzeDocument(file)
        );

    }


    if (changeFileButton) {

        changeFileButton.addEventListener(
            "click",
            () => {

                fileInput.value = "";

                resetUpload();

            }
        );

    }

}


// ======================================================
// ANALYZE DOCUMENT
// ======================================================

async function analyzeDocument(file) {

    const analyzeButton =
        document.getElementById("analyzeButton");

    if (analyzeButton) {

        analyzeButton.disabled = true;

        analyzeButton.textContent =
            "Подготавливаем документ…";

    }


    try {

        let text = "";


        // --------------------------------------------------
        // PDF
        // --------------------------------------------------

        if (file.type === "application/pdf") {

            text = await extractPdfText(file);

        }


        // --------------------------------------------------
        // IMAGE
        // --------------------------------------------------

        else if (
            file.type === "image/jpeg" ||
            file.type === "image/png"
        ) {

            throw new Error(
                "Анализ изображений пока не подключён. Сначала загрузите текстовый PDF."
            );

        }


        if (!text || text.trim().length < 20) {

            throw new Error(
                "Не удалось найти текст в документе. Возможно, это скан или фотография."
            );

        }


        if (analyzeButton) {

            analyzeButton.textContent =
                "AI анализирует документ…";

        }


        const result =
            await sendTextToSupabase(text);


        renderAnalysis(result);


    } catch (error) {

        console.error(error);

        showError(
            "Не удалось проанализировать документ",
            error.message ||
            "Попробуйте ещё раз."
        );

    }

}


// ======================================================
// EXTRACT TEXT FROM PDF
// ======================================================

async function extractPdfText(file) {

    /*
     * Загружаем PDF.js.
     */

    await loadPdfJs();


    if (!window.pdfjsLib) {

        throw new Error(
            "Не удалось загрузить PDF-анализатор."
        );

    }


    const arrayBuffer =
        await file.arrayBuffer();


    const pdf =
        await window.pdfjsLib.getDocument({
            data: arrayBuffer
        }).promise;


    let fullText = "";


    for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
    ) {

        const page =
            await pdf.getPage(pageNumber);


        const content =
            await page.getTextContent();


        const pageText =
            content.items
                .map(item => item.str || "")
                .join(" ");


        fullText +=
            `\n\n--- Страница ${pageNumber} ---\n\n` +
            pageText;


        /*
         * Защита от слишком огромного документа.
         */

        if (fullText.length > 250000) {

            fullText =
                fullText.substring(0, 250000);

            break;

        }

    }


    return fullText.trim();

}


// ======================================================
// SEND TO SUPABASE
// ======================================================

async function sendTextToSupabase(text) {

    const response =
        await fetch(
            SUPABASE_FUNCTION_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    text: text
                })
            }
        );


    let data;

    try {

        data = await response.json();

    } catch {

        throw new Error(
            "Сервер вернул некорректный ответ."
        );

    }


    if (!response.ok) {

        throw new Error(
            data?.error ||
            "Ошибка анализа документа."
        );

    }


    return data;

}


// ======================================================
// RENDER RESULT
// ======================================================

function renderAnalysis(result) {

    uploadCard.innerHTML = `
        <div class="analysis-result">

            <div class="result-header">

                <div class="result-badge">
                    РЕЗУЛЬТАТ АНАЛИЗА
                </div>

                <h2>
                    Документ разобран
                </h2>

                <p class="result-summary">
                    ${escapeHtml(result.summary)}
                </p>

            </div>


            ${
                result.duration
                    ? `
                        <div class="result-duration">
                            <strong>Срок действия:</strong>
                            ${escapeHtml(result.duration)}
                        </div>
                    `
                    : ""
            }


            ${renderFindings(
                result.important,
                "🔴 Важное",
                "result-section important"
            )}


            ${renderFindings(
                result.worthKnowing,
                "🟡 Стоит знать",
                "result-section worth-knowing"
            )}


            ${renderFindings(
                result.payments,
                "💰 Деньги",
                "result-section payments"
            )}


            ${renderFindings(
                result.clear,
                "🟢 Без особенностей",
                "result-section clear"
            )}


            <div class="result-disclaimer">
                ${escapeHtml(result.disclaimer)}
            </div>


            <button
                class="primary-button"
                id="newDocumentButton"
                type="button"
            >
                Проверить другой документ
            </button>

        </div>
    `;


    const newDocumentButton =
        document.getElementById(
            "newDocumentButton"
        );


    if (newDocumentButton) {

        newDocumentButton.addEventListener(
            "click",
            () => {

                fileInput.value = "";

                resetUpload();

            }
        );

    }


    uploadCard.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


// ======================================================
// FINDINGS
// ======================================================

function renderFindings(
    findings,
    title,
    className
) {

    if (
        !Array.isArray(findings) ||
        findings.length === 0
    ) {

        return "";

    }


    return `
        <section class="${className}">

            <h3>
                ${title}
            </h3>

            <div class="findings-list">

                ${findings.map(
                    finding => `
                        <article class="finding-card">

                            <div class="finding-top">

                                <strong>
                                    ${escapeHtml(
                                        finding.title
                                    )}
                                </strong>

                                <span class="severity-dot severity-${escapeHtml(
                                    finding.severity
                                )}"></span>

                            </div>

                            <p>
                                ${escapeHtml(
                                    finding.explanation
                                )}
                            </p>

                            ${
                                finding.source
                                    ? `
                                        <div class="finding-source">
                                            ${escapeHtml(
                                                finding.source
                                            )}
                                        </div>
                                    `
                                    : ""
                            }

                        </article>
                    `
                ).join("")}

            </div>

        </section>
    `;

}


// ======================================================
// RESET
// ======================================================

function resetUpload() {

    uploadCard.innerHTML = `
        <div class="upload-icon">
            ↑
        </div>

        <h3>
            Загрузите документ
        </h3>

        <p>
            PDF, JPG или PNG
        </p>

        <button
            class="primary-button"
            id="uploadButton"
            type="button"
        >
            Выбрать файл
        </button>

        <div class="upload-note">
            Документ анализируется автоматически
        </div>
    `;


    reconnectUploadEvents();

}


// ======================================================
// RECONNECT EVENTS
// ======================================================

function reconnectUploadEvents() {

    const newUploadButton =
        document.getElementById("uploadButton");


    if (newUploadButton) {

        newUploadButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                fileInput.click();

            }
        );

    }


    uploadCard.addEventListener(
        "dragover",
        (event) => {

            event.preventDefault();

            uploadCard.classList.add(
                "dragover"
            );

        }
    );


    uploadCard.addEventListener(
        "dragleave",
        () => {

            uploadCard.classList.remove(
                "dragover"
            );

        }
    );


    uploadCard.addEventListener(
        "drop",
        (event) => {

            event.preventDefault();

            uploadCard.classList.remove(
                "dragover"
            );

            const file =
                event.dataTransfer.files?.[0];

            if (file) {

                handleFile(file);

            }

        }
    );

}


// ======================================================
// ERROR
// ======================================================

function showError(
    title,
    message
) {

    uploadCard.innerHTML = `
        <div class="upload-error">

            <div class="error-icon">
                !
            </div>

            <h3>
                ${escapeHtml(title)}
            </h3>

            <p>
                ${escapeHtml(message)}
            </p>

            <button
                class="primary-button"
                id="errorBackButton"
                type="button"
            >
                Попробовать снова
            </button>

        </div>
    `;


    const errorBackButton =
        document.getElementById(
            "errorBackButton"
        );


    if (errorBackButton) {

        errorBackButton.addEventListener(
            "click",
            () => {

                fileInput.value = "";

                resetUpload();

            }
        );

    }

}


// ======================================================
// MODAL
// ======================================================

function setupModal() {

    if (
        !howItWorksButton ||
        !modal
    ) {
        return;
    }


    howItWorksButton.addEventListener(
        "click",
        () => {

            modal.classList.add(
                "active"
            );

        }
    );


    if (modalClose) {

        modalClose.addEventListener(
            "click",
            () => {

                modal.classList.remove(
                    "active"
                );

            }
        );

    }


    modal.addEventListener(
        "click",
        (event) => {

            if (
                event.target === modal
            ) {

                modal.classList.remove(
                    "active"
                );

            }

        }
    );


    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Escape"
            ) {

                modal.classList.remove(
                    "active"
                );

            }

        }
    );

}


// ======================================================
// HELPERS
// ======================================================

function formatFileSize(bytes) {

    if (bytes < 1024) {

        return `${bytes} Б`;

    }


    if (bytes < 1024 * 1024) {

        return `${(
            bytes / 1024
        ).toFixed(1)} КБ`;

    }


    return `${(
        bytes /
        (1024 * 1024)
    ).toFixed(1)} МБ`;

}


function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}