// ============================================================
// ЧТО Я ПОДПИСЫВАЮ?
// APP.JS
// VERSION: 2026-09-30-v4
// ============================================================

(() => {

    "use strict";


    // ============================================================
    // НАСТРОЙКИ
    // ============================================================

    const MAX_FILE_SIZE = 20 * 1024 * 1024;

    const PDFJS_URL =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";

    const PDFJS_WORKER_URL =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const TESSERACT_URL =
        "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js";


    // ============================================================
    // DOM
    // ============================================================

    const uploadCard = document.getElementById("uploadCard");
    const uploadButton = document.getElementById("uploadButton");
    const fileInput = document.getElementById("fileInput");

    const analysisResult =
        document.getElementById("analysisResult");

    const aboutButton =
        document.getElementById("aboutButton");

    const aboutModal =
        document.getElementById("aboutModal");

    const modalOverlay =
        document.getElementById("modalOverlay");

    const modalClose =
        document.getElementById("modalClose");


    // ============================================================
    // СОСТОЯНИЕ
    // ============================================================

    let pdfjsPromise = null;
    let tesseractPromise = null;

    let currentFile = null;
    let currentAnalysis = null;


    // ============================================================
    // ЗАПУСК
    // ============================================================

    init();


    function init() {

        if (!uploadButton || !fileInput || !uploadCard) {
            console.error(
                "Не найдены основные элементы интерфейса."
            );
            return;
        }


        uploadButton.addEventListener("click", (event) => {
            event.preventDefault();
            fileInput.click();
        });


        fileInput.addEventListener("change", async () => {

            const file = fileInput.files?.[0];

            if (!file) {
                return;
            }

            await handleFile(file);
        });


        // --------------------------------------------------------
        // DRAG & DROP
        // --------------------------------------------------------

        uploadCard.addEventListener("dragover", (event) => {

            event.preventDefault();

            uploadCard.classList.add("dragging");
        });


        uploadCard.addEventListener("dragleave", () => {

            uploadCard.classList.remove("dragging");
        });


        uploadCard.addEventListener("drop", async (event) => {

            event.preventDefault();

            uploadCard.classList.remove("dragging");

            const file = event.dataTransfer?.files?.[0];

            if (!file) {
                return;
            }

            await handleFile(file);
        });


        // --------------------------------------------------------
        // MODAL "КАК ЭТО РАБОТАЕТ"
        // --------------------------------------------------------

        if (aboutButton && aboutModal) {

            aboutButton.addEventListener("click", () => {

                aboutModal.classList.add("active");

                document.body.classList.add("modal-open");
            });
        }


        if (modalClose && aboutModal) {

            modalClose.addEventListener("click", closeAboutModal);
        }


        if (modalOverlay && aboutModal) {

            modalOverlay.addEventListener(
                "click",
                closeAboutModal
            );
        }


        document.addEventListener("keydown", (event) => {

            if (
                event.key === "Escape" &&
                aboutModal?.classList.contains("active")
            ) {
                closeAboutModal();
            }
        });
    }


    function closeAboutModal() {

        if (!aboutModal) {
            return;
        }

        aboutModal.classList.remove("active");

        document.body.classList.remove("modal-open");
    }


    // ============================================================
    // ОБРАБОТКА ФАЙЛА
    // ============================================================

    async function handleFile(file) {

        currentFile = file;

        clearPreviousResult();

        if (!validateFile(file)) {
            return;
        }


        showProcessingState(file);


        try {

            const text = await extractText(file);

            if (!text || text.trim().length < 20) {

                throw new Error(
                    "Не удалось извлечь текст из документа."
                );
            }


            const normalizedText =
                normalizeText(text);


            currentAnalysis =
                analyzeDocument(normalizedText);


            renderAnalysis(
                currentAnalysis,
                file
            );


            scrollToAnalysis();


        } catch (error) {

            console.error(error);

            showError(
                error?.message ||
                "Не удалось проанализировать документ."
            );
        }
    }


    // ============================================================
    // ПРОВЕРКА ФАЙЛА
    // ============================================================

    function validateFile(file) {

        if (!file) {
            return false;
        }


        if (file.size > MAX_FILE_SIZE) {

            showError(
                "Файл слишком большой. Максимальный размер — 20 МБ."
            );

            return false;
        }


        const allowedTypes = [
            "application/pdf",
            "image/jpeg",
            "image/png"
        ];


        const allowedExtensions = [
            ".pdf",
            ".jpg",
            ".jpeg",
            ".png"
        ];


        const lowerName =
            file.name.toLowerCase();


        const extensionAllowed =
            allowedExtensions.some(
                extension =>
                    lowerName.endsWith(extension)
            );


        if (
            !allowedTypes.includes(file.type) &&
            !extensionAllowed
        ) {

            showError(
                "Поддерживаются только PDF, JPG и PNG."
            );

            return false;
        }


        return true;
    }


    // ============================================================
    // СОСТОЯНИЕ ЗАГРУЗКИ
    // ============================================================

    function showProcessingState(file) {

        uploadCard.classList.add("processing");


        uploadCard.innerHTML = `

            <div class="upload-icon processing-icon">
                ↻
            </div>

            <h2>
                Анализируем документ
            </h2>

            <p class="processing-file">
                ${escapeHtml(file.name)}
            </p>

            <div class="processing-loader">
                <div class="processing-loader-bar"></div>
            </div>

            <div class="upload-note">
                Извлекаем текст и ищем важные условия
            </div>

        `;


        // Возвращаем input внутрь карточки,
        // чтобы повторная загрузка продолжала работать.

        uploadCard.appendChild(fileInput);
    }


    // ============================================================
    // ОЧИСТКА ПРЕДЫДУЩЕГО РЕЗУЛЬТАТА
    // ============================================================

    function clearPreviousResult() {

        if (!analysisResult) {
            return;
        }

        analysisResult.innerHTML = "";

        analysisResult.classList.remove("visible");

        analysisResult.style.display = "none";
    }


    // ============================================================
    // ОШИБКА
    // ============================================================

    function showError(message) {

        if (!analysisResult) {
            alert(message);
            return;
        }


        analysisResult.style.display = "block";

        analysisResult.classList.add("visible");


        analysisResult.innerHTML = `

            <div class="analysis-error">

                <div class="analysis-error-icon">
                    !
                </div>

                <div>
                    <strong>
                        Не удалось проанализировать документ
                    </strong>

                    <p>
                        ${escapeHtml(message)}
                    </p>
                </div>

            </div>

        `;


        scrollToAnalysis();
    }


    // ============================================================
    // PDF.JS
    // ============================================================

    function loadPdfJs() {

        if (window.pdfjsLib) {
            return Promise.resolve(window.pdfjsLib);
        }


        if (pdfjsPromise) {
            return pdfjsPromise;
        }


        pdfjsPromise = new Promise((resolve, reject) => {

            const script =
                document.createElement("script");

            script.src = PDFJS_URL;

            script.onload = () => {

                if (!window.pdfjsLib) {

                    reject(
                        new Error(
                            "PDF.js не загрузился."
                        )
                    );

                    return;
                }


                window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    PDFJS_WORKER_URL;


                resolve(window.pdfjsLib);
            };


            script.onerror = () => {

                reject(
                    new Error(
                        "Не удалось загрузить PDF.js."
                    )
                );
            };


            document.head.appendChild(script);
        });


        return pdfjsPromise;
    }


    // ============================================================
    // TESSERACT
    // ============================================================

    function loadTesseract() {

        if (window.Tesseract) {
            return Promise.resolve(window.Tesseract);
        }


        if (tesseractPromise) {
            return tesseractPromise;
        }


        tesseractPromise = new Promise((resolve, reject) => {

            const script =
                document.createElement("script");

            script.src = TESSERACT_URL;

            script.onload = () => {

                if (!window.Tesseract) {

                    reject(
                        new Error(
                            "Tesseract.js не загрузился."
                        )
                    );

                    return;
                }


                resolve(window.Tesseract);
            };


            script.onerror = () => {

                reject(
                    new Error(
                        "Не удалось загрузить OCR."
                    )
                );
            };


            document.head.appendChild(script);
        });


        return tesseractPromise;
    }


    // ============================================================
    // ИЗВЛЕЧЕНИЕ ТЕКСТА
    // ============================================================

    async function extractText(file) {

        const isPdf =
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf");


        if (isPdf) {

            return await extractPdfText(file);
        }


        return await extractImageText(file);
    }


    // ============================================================
    // PDF TEXT
    // ============================================================

    async function extractPdfText(file) {

        const pdfjs =
            await loadPdfJs();


        const arrayBuffer =
            await file.arrayBuffer();


        const pdf =
            await pdfjs.getDocument({
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
                "\n" +
                pageText;
        }


        const cleaned =
            normalizeText(fullText);


        // --------------------------------------------------------
        // ЕСЛИ PDF СКАН
        // --------------------------------------------------------

        if (cleaned.length < 80) {

            return await ocrPdf(
                pdf
            );
        }


        return cleaned;
    }


    // ============================================================
    // OCR PDF
    // ============================================================

    async function ocrPdf(pdf) {

        const Tesseract =
            await loadTesseract();


        let result = "";


        for (
            let pageNumber = 1;
            pageNumber <= pdf.numPages;
            pageNumber++
        ) {

            const page =
                await pdf.getPage(pageNumber);


            const viewport =
                page.getViewport({
                    scale: 1.8
                });


            const canvas =
                document.createElement("canvas");


            const context =
                canvas.getContext("2d");


            canvas.width =
                Math.ceil(viewport.width);


            canvas.height =
                Math.ceil(viewport.height);


            await page.render({
                canvasContext: context,
                viewport
            }).promise;


            const dataUrl =
                canvas.toDataURL("image/png");


            const ocr =
                await Tesseract.recognize(
                    dataUrl,
                    "rus+eng"
                );


            result +=
                "\n" +
                (ocr?.data?.text || "");
        }


        return normalizeText(result);
    }


    // ============================================================
    // OCR IMAGE
    // ============================================================

    async function extractImageText(file) {

        const Tesseract =
            await loadTesseract();


        const result =
            await Tesseract.recognize(
                file,
                "rus+eng"
            );


        return normalizeText(
            result?.data?.text || ""
        );
    }


    // ============================================================
    // НОРМАЛИЗАЦИЯ
    // ============================================================

    function normalizeText(text) {

        return String(text || "")
            .replace(/\u00A0/g, " ")
            .replace(/\r/g, "\n")
            .replace(/[ \t]+/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/\s+([,.;:!?])/g, "$1")
            .trim();
    }


    // ============================================================
    // ПРЕДЛОЖЕНИЯ
    // ============================================================

    function splitSentences(text) {

        const prepared =
            text
                .replace(/\n+/g, " ")
                .replace(/\s+/g, " ")
                .trim();


        if (!prepared) {
            return [];
        }


        return prepared
            .split(/(?<=[.!?;])\s+(?=[А-ЯA-ZЁ0-9])/u)
            .map(item => item.trim())
            .filter(item => item.length >= 15);
    }


    // ============================================================
    // АНАЛИЗ ДОКУМЕНТА
    // ============================================================

    function analyzeDocument(text) {

        const sentences =
            splitSentences(text);


        const result = {

            important: [],
            worth: [],
            money: [],
            deadlines: [],
            data: [],
            restrictions: []

        };


        // ========================================================
        // ВАЖНО
        // ========================================================

        addRule(
            result.important,
            sentences,
            {
                title: "Автоматическое продление",

                keywords: [
                    "автоматическ",
                    "продлевается",
                    "продляется",
                    "пролонгац",
                    "если не уведом",
                    "считается продленным"
                ],

                description:
                    "Проверьте, продлевается ли договор автоматически и когда его можно прекратить."
            }
        );


        addRule(
            result.important,
            sentences,
            {
                title: "Штрафы и санкции",

                keywords: [
                    "штраф",
                    "штрафн",
                    "санкци",
                    "неустойк"
                ],

                description:
                    "В документе предусмотрены штрафы или другие санкции."
            }
        );


        addRule(
            result.important,
            sentences,
            {
                title: "Пени за просрочку",

                keywords: [
                    "пеня",
                    "пени",
                    "за каждый день просрочки",
                    "за каждый день"
                ],

                description:
                    "Проверьте размер пени и условия её начисления."
            }
        );


        addRule(
            result.important,
            sentences,
            {
                title: "Изменение условий",

                keywords: [
                    "вправе изменить",
                    "может изменить",
                    "изменяет стоимость",
                    "изменение стоимости",
                    "в одностороннем порядке",
                    "без дополнительного соглашения"
                ],

                description:
                    "Проверьте, может ли одна из сторон изменить условия договора без отдельного согласования."
            }
        );


        addRule(
            result.important,
            sentences,
            {
                title: "Расторжение договора",

                keywords: [
                    "расторжени",
                    "расторгнуть",
                    "прекратить договор",
                    "отказаться от договора",
                    "отказ от договора"
                ],

                description:
                    "Проверьте порядок расторжения и возможные условия отказа от договора."
            }
        );


        // ========================================================
        // СТОИТ ЗНАТЬ
        // ========================================================

        addRule(
            result.worth,
            sentences,
            {
                title: "Оплата",

                keywords: [
                    "оплат",
                    "платеж",
                    "внести плату",
                    "внести оплату",
                    "ежемесячн"
                ],

                description:
                    "В документе указаны условия оплаты."
            }
        );


        addRule(
            result.worth,
            sentences,
            {
                title: "Комиссии",

                keywords: [
                    "комисси",
                    "сбор",
                    "дополнительная плата",
                    "сервисный сбор"
                ],

                description:
                    "Проверьте дополнительные комиссии и сборы."
            }
        );


        addRule(
            result.worth,
            sentences,
            {
                title: "Уведомления",

                keywords: [
                    "уведом",
                    "извещ",
                    "сообщить",
                    "сообщени",
                    "направить уведомление"
                ],

                description:
                    "Проверьте, как и в какие сроки стороны должны уведомлять друг друга."
            }
        );


        addRule(
            result.worth,
            sentences,
            {
                title: "Реклама и рассылки",

                keywords: [
                    "реклам",
                    "рассылк",
                    "маркетингов",
                    "информационн",
                    "смс"
                ],

                description:
                    "В документе могут содержаться условия о рекламных или информационных сообщениях."
            }
        );


        // ========================================================
        // ДАННЫЕ
        // ========================================================

        addRule(
            result.data,
            sentences,
            {
                title: "Персональные данные",

                keywords: [
                    "персональн",
                    "обработка персональных",
                    "согласие на обработку",
                    "оператор персональных"
                ],

                description:
                    "Документ содержит условия обработки персональных данных."
            }
        );


        addRule(
            result.data,
            sentences,
            {
                title: "Передача данных третьим лицам",

                keywords: [
                    "третьим лицам",
                    "третьих лиц",
                    "передач",
                    "предоставлени",
                    "партнерам",
                    "партнёрам"
                ],

                description:
                    "Проверьте, кому и при каких условиях могут передаваться данные."
            }
        );


        // ========================================================
        // ОГРАНИЧЕНИЯ
        // ========================================================

        addRule(
            result.restrictions,
            sentences,
            {
                title: "Ограничение ответственности",

                keywords: [
                    "ограничивает ответственность",
                    "ограничение ответственности",
                    "не несет ответственности",
                    "не несёт ответственности",
                    "не отвечает за",
                    "ответственность не распространяется"
                ],

                description:
                    "Проверьте, за какие последствия сторона договора снимает или ограничивает свою ответственность."
            }
        );


        addRule(
            result.restrictions,
            sentences,
            {
                title: "Ограничения для клиента",

                keywords: [
                    "запрещается",
                    "не допускается",
                    "не вправе",
                    "ограничен",
                    "ограничено",
                    "запрет"
                ],

                description:
                    "В документе обнаружены ограничения или запреты."
            }
        );


        // ========================================================
        // ДЕНЬГИ
        // ========================================================

        result.money =
            extractMoneyFindings(sentences);


        // ========================================================
        // СРОКИ
        // ========================================================

        result.deadlines =
            extractDeadlineFindings(sentences);


        // ========================================================
        // УДАЛЯЕМ ДУБЛИКАТЫ
        // ========================================================

        result.important =
            deduplicateFindings(result.important);

        result.worth =
            deduplicateFindings(result.worth);

        result.money =
            deduplicateFindings(result.money);

        result.deadlines =
            deduplicateFindings(result.deadlines);

        result.data =
            deduplicateFindings(result.data);

        result.restrictions =
            deduplicateFindings(result.restrictions);


        return result;
    }


    // ============================================================
    // ПРАВИЛО
    // ============================================================

    function addRule(
        target,
        sentences,
        rule
    ) {

        const matches = [];


        for (const sentence of sentences) {

            const lower =
                sentence.toLowerCase();


            const matched =
                rule.keywords.some(
                    keyword =>
                        lower.includes(
                            keyword.toLowerCase()
                        )
                );


            if (matched) {

                matches.push(
                    cleanSource(sentence)
                );
            }
        }


        if (!matches.length) {
            return;
        }


        target.push({

            title: rule.title,

            description: rule.description,

            sources:
                uniqueSources(matches)

        });
    }


    // ============================================================
    // ДЕНЬГИ
    // ============================================================

    function extractMoneyFindings(sentences) {

        const findings = [];


        const moneyRegex =
            /(\d[\d\s.,]*\s*(?:₽|руб(?:\.|лей|ля)?|р\.))\b/giu;


        const percentRegex =
            /(\d+(?:[.,]\d+)?)\s*%/gu;


        for (const sentence of sentences) {

            const moneyMatches =
                [...sentence.matchAll(moneyRegex)];


            const percentMatches =
                [...sentence.matchAll(percentRegex)];


            // ----------------------------------------------------
            // ДЕНЬГИ
            // ----------------------------------------------------

            for (const match of moneyMatches) {

                const value =
                    normalizeMoneyValue(
                        match[1]
                    );


                if (!value) {
                    continue;
                }


                const title =
                    detectMoneyTitle(
                        sentence
                    );


                findings.push({

                    title,

                    description:
                        buildMoneyDescription(
                            value,
                            sentence
                        ),

                    values: [
                        value
                    ],

                    sources: [
                        cleanSource(sentence)
                    ]

                });
            }


            // ----------------------------------------------------
            // ПРОЦЕНТЫ
            // ----------------------------------------------------

            for (const match of percentMatches) {

                const value =
                    `${match[1].replace(",", ".")}%`;


                const title =
                    detectPercentTitle(
                        sentence
                    );


                findings.push({

                    title,

                    description:
                        buildPercentDescription(
                            value,
                            sentence
                        ),

                    values: [
                        value
                    ],

                    sources: [
                        cleanSource(sentence)
                    ]

                });
            }
        }


        return findings;
    }


    // ============================================================
    // НАЗВАНИЕ ДЕНЕЖНОГО ПУНКТА
    // ============================================================

    function detectMoneyTitle(sentence) {

        const text =
            sentence.toLowerCase();


        if (
            text.includes("штраф") ||
            text.includes("неустой")
        ) {
            return "Штраф или неустойка";
        }


        if (
            text.includes("пеня") ||
            text.includes("пени")
        ) {
            return "Пеня";
        }


        if (
            text.includes("комисси") ||
            text.includes("сбор")
        ) {
            return "Комиссия или сбор";
        }


        if (
            text.includes("ежемесяч") ||
            text.includes("месяц")
        ) {
            return "Стоимость услуги";
        }


        if (
            text.includes("оплат") ||
            text.includes("платеж") ||
            text.includes("стоимост") ||
            text.includes("цена")
        ) {
            return "Стоимость / платёж";
        }


        return "Денежное условие";
    }


    function detectPercentTitle(sentence) {

        const text =
            sentence.toLowerCase();


        if (
            text.includes("штраф") ||
            text.includes("неустой")
        ) {
            return "Процент штрафа";
        }


        if (
            text.includes("пеня") ||
            text.includes("пени")
        ) {
            return "Процент пени";
        }


        if (
            text.includes("комисси")
        ) {
            return "Комиссия";
        }


        if (
            text.includes("скид")
        ) {
            return "Скидка";
        }


        if (
            text.includes("ставк")
        ) {
            return "Ставка";
        }


        return "Процентное условие";
    }


    function normalizeMoneyValue(value) {

        if (!value) {
            return "";
        }


        return value
            .replace(/\s+/g, " ")
            .replace(/\s*руб(?:\.|лей|ля)?/giu, " ₽")
            .replace(/\s*р\./giu, " ₽")
            .replace(/\s*₽/gu, " ₽")
            .trim();
    }


    function buildMoneyDescription(
        value,
        sentence
    ) {

        const context =
            shortenSource(
                sentence,
                260
            );


        return `${value} — ${context}`;
    }


    function buildPercentDescription(
        value,
        sentence
    ) {

        const context =
            shortenSource(
                sentence,
                260
            );


        return `${value} — ${context}`;
    }


    // ============================================================
    // СРОКИ
    // ============================================================

    function extractDeadlineFindings(sentences) {

        const findings = [];


        const durationRegex =
            /(\d+(?:[.,]\d+)?)\s*(дн(?:ей|я)?|день|недел(?:я|и|ь)|месяц(?:а|ев)?|год(?:а|ов)?|час(?:а|ов)?)/giu;


        const dateRegex =
            /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/g;


        for (const sentence of sentences) {

            const durations =
                [...sentence.matchAll(durationRegex)];


            const dates =
                [...sentence.matchAll(dateRegex)];


            for (const match of durations) {

                const value =
                    `${match[1]} ${normalizeUnit(match[2])}`;


                const title =
                    detectDeadlineTitle(
                        sentence
                    );


                findings.push({

                    title,

                    description:
                        `${value} — ${shortenSource(sentence, 260)}`,

                    values: [
                        value
                    ],

                    sources: [
                        cleanSource(sentence)
                    ]

                });
            }


            for (const match of dates) {

                const value =
                    match[1];


                const title =
                    detectDeadlineTitle(
                        sentence
                    );


                findings.push({

                    title,

                    description:
                        `${value} — ${shortenSource(sentence, 260)}`,

                    values: [
                        value
                    ],

                    sources: [
                        cleanSource(sentence)
                    ]

                });
            }
        }


        return findings;
    }


    function normalizeUnit(unit) {

        const value =
            unit.toLowerCase();


        if (
            value.startsWith("дн") ||
            value === "день"
        ) {
            return "дней";
        }


        if (
            value.startsWith("недел")
        ) {
            return "недель";
        }


        if (
            value.startsWith("месяц")
        ) {
            return "месяцев";
        }


        if (
            value.startsWith("год")
        ) {
            return "лет";
        }


        if (
            value.startsWith("час")
        ) {
            return "часов";
        }


        return unit;
    }


    function detectDeadlineTitle(sentence) {

        const text =
            sentence.toLowerCase();


        if (
            text.includes("уведом")
        ) {
            return "Срок уведомления";
        }


        if (
            text.includes("оплат")
        ) {
            return "Срок оплаты";
        }


        if (
            text.includes("расторж")
        ) {
            return "Срок расторжения";
        }


        if (
            text.includes("достав")
        ) {
            return "Срок доставки";
        }


        if (
            text.includes("действ")
        ) {
            return "Срок действия";
        }


        if (
            text.includes("предупред")
        ) {
            return "Срок предупреждения";
        }


        if (
            text.includes("ответ")
        ) {
            return "Срок ответа";
        }


        return "Срок / период";
    }


    // ============================================================
    // ОЧИСТКА ИСТОЧНИКА
    // ============================================================

    function cleanSource(text) {

        return String(text || "")
            .replace(/\s+/g, " ")
            .trim();
    }


    function shortenSource(
        text,
        maxLength = 260
    ) {

        const clean =
            cleanSource(text);


        if (
            clean.length <= maxLength
        ) {
            return clean;
        }


        return (
            clean.slice(0, maxLength - 1)
            .trim() +
            "…"
        );
    }


    function uniqueSources(
        sources
    ) {

        return [
            ...new Set(
                sources
                    .map(cleanSource)
                    .filter(Boolean)
            )
        ];
    }


    // ============================================================
    // ДЕДУПЛИКАЦИЯ
    // ============================================================

    function deduplicateFindings(
        findings
    ) {

        const map =
            new Map();


        for (const finding of findings) {

            const key =
                `${finding.title}::${(finding.description || "").slice(0, 120)}`;


            if (!map.has(key)) {

                map.set(
                    key,
                    {
                        ...finding,

                        sources: [
                            ...(finding.sources || [])
                        ],

                        values: [
                            ...(finding.values || [])
                        ]

                    }
                );

                continue;
            }


            const existing =
                map.get(key);


            existing.sources =
                uniqueSources([
                    ...(existing.sources || []),
                    ...(finding.sources || [])
                ]);


            existing.values =
                [
                    ...new Set([
                        ...(existing.values || []),
                        ...(finding.values || [])
                    ])
                ];
        }


        return [...map.values()];
    }


    // ============================================================
    // РЕНДЕР АНАЛИЗА
    // ============================================================

    function renderAnalysis(
        analysis,
        file
    ) {

        if (!analysisResult) {
            return;
        }


        const groups = [
            {
                key: "important",
                title: "Важно",
                icon: "!",
                className: "danger",
                items: analysis.important
            },

            {
                key: "worth",
                title: "Стоит знать",
                icon: "↻",
                className: "warning",
                items: analysis.worth
            },

            {
                key: "money",
                title: "Деньги",
                icon: "₽",
                className: "money",
                items: analysis.money
            },

            {
                key: "deadlines",
                title: "Сроки",
                icon: "◷",
                className: "deadline",
                items: analysis.deadlines
            },

            {
                key: "data",
                title: "Данные",
                icon: "i",
                className: "data",
                items: analysis.data
            },

            {
                key: "restrictions",
                title: "Ограничения",
                icon: "×",
                className: "restriction",
                items: analysis.restrictions
            }
        ];


        const nonEmptyGroups =
            groups.filter(
                group =>
                    group.items &&
                    group.items.length
            );


        const totalFindings =
            nonEmptyGroups.reduce(
                (sum, group) =>
                    sum + group.items.length,
                0
            );


        const fileName =
            file?.name ||
            "Документ";


        analysisResult.innerHTML = `

            <div class="analysis-dashboard">

                <div class="analysis-header">

                    <div>

                        <div class="section-label">
                            АНАЛИЗ ЗАВЕРШЁН
                        </div>

                        <h2>
                            Что найдено
                        </h2>

                        <p class="analysis-file">
                            ${escapeHtml(fileName)}
                        </p>

                    </div>

                    <div class="analysis-count">

                        <strong>
                            ${totalFindings}
                        </strong>

                        <span>
                            ${
                                pluralize(
                                    totalFindings,
                                    "пункт",
                                    "пункта",
                                    "пунктов"
                                )
                            }
                        </span>

                    </div>

                </div>


                ${
                    nonEmptyGroups.length
                        ? `
                            <div class="analysis-grid">

                                ${nonEmptyGroups
                                    .map(
                                        group =>
                                            renderCategoryCard(
                                                group
                                            )
                                    )
                                    .join("")
                                }

                            </div>
                          `
                        : `
                            <div class="analysis-empty">

                                <div class="analysis-empty-icon">
                                    ✓
                                </div>

                                <div>

                                    <strong>
                                        Явных проблемных условий не найдено
                                    </strong>

                                    <p>
                                        Это не означает, что документ
                                        полностью безопасен — внимательно
                                        ознакомьтесь с его условиями.
                                    </p>

                                </div>

                            </div>
                          `
                }


                <div class="analysis-disclaimer">

                    Анализ носит информационный характер
                    и не является юридической консультацией.

                </div>

            </div>

        `;


        analysisResult.style.display = "block";


        // Небольшая задержка нужна,
        // чтобы браузер успел отрисовать карточки.

        requestAnimationFrame(() => {

            analysisResult.classList.add("visible");

            attachCategoryHandlers();
        });


        restoreUploadCard(file);
    }


    // ============================================================
    // КАРТОЧКА КАТЕГОРИИ
    // ============================================================

    function renderCategoryCard(
        group
    ) {

        const count =
            group.items.length;


        return `

            <button
                class="analysis-category ${group.className}"
                type="button"
                data-category="${escapeHtml(group.key)}"
            >

                <span class="analysis-category-icon">
                    ${escapeHtml(group.icon)}
                </span>

                <span class="analysis-category-content">

                    <strong>
                        ${escapeHtml(group.title)}
                    </strong>

                    <small>
                        ${
                            pluralize(
                                count,
                                "найденный пункт",
                                "найденных пункта",
                                "найденных пунктов"
                            )
                        }
                    </small>

                </span>

                <span class="analysis-category-arrow">
                    →
                </span>

            </button>

        `;
    }


    // ============================================================
    // ОБРАБОТЧИКИ КАТЕГОРИЙ
    // ============================================================

    function attachCategoryHandlers() {

        if (!analysisResult) {
            return;
        }


        const buttons =
            analysisResult.querySelectorAll(
                ".analysis-category"
            );


        buttons.forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const category =
                        button.dataset.category;


                    const group =
                        getAnalysisGroup(
                            category
                        );


                    if (!group) {
                        return;
                    }


                    openResultModal(
                        group
                    );
                }
            );
        });
    }


    function getAnalysisGroup(
        key
    ) {

        if (!currentAnalysis) {
            return null;
        }


        const titles = {

            important: "Важно",
            worth: "Стоит знать",
            money: "Деньги",
            deadlines: "Сроки",
            data: "Данные",
            restrictions: "Ограничения"

        };


        if (
            !currentAnalysis[key]
        ) {
            return null;
        }


        return {

            key,

            title:
                titles[key] ||
                "Результаты",

            items:
                currentAnalysis[key]

        };
    }


    // ============================================================
    // МОДАЛКА РЕЗУЛЬТАТА
    // ============================================================

    function openResultModal(
        group
    ) {

        closeResultModal();


        const modal =
            document.createElement("div");


        modal.className =
            "result-modal";


        modal.innerHTML = `

            <div class="result-modal-overlay"></div>

            <div class="result-modal-card">

                <button
                    class="result-modal-close"
                    type="button"
                    aria-label="Закрыть"
                >
                    ×
                </button>


                <div class="section-label">
                    НАЙДЕНО В ДОКУМЕНТЕ
                </div>


                <h2>
                    ${escapeHtml(group.title)}
                </h2>


                <div class="result-modal-items">

                    ${group.items
                        .map(
                            item =>
                                renderFinding(
                                    item
                                )
                        )
                        .join("")
                    }

                </div>


                <div class="result-modal-footer">

                    Информация приведена
                    в справочных целях.

                </div>

            </div>

        `;


        document.body.appendChild(modal);


        document.body.classList.add(
            "modal-open"
        );


        requestAnimationFrame(() => {

            modal.classList.add("active");
        });


        const closeButton =
            modal.querySelector(
                ".result-modal-close"
            );


        const overlay =
            modal.querySelector(
                ".result-modal-overlay"
            );


        closeButton?.addEventListener(
            "click",
            () => closeResultModal()
        );


        overlay?.addEventListener(
            "click",
            () => closeResultModal()
        );


        modal._escHandler =
            event => {

                if (event.key === "Escape") {

                    closeResultModal();
                }
            };


        document.addEventListener(
            "keydown",
            modal._escHandler
        );
    }


    function closeResultModal() {

        const modal =
            document.querySelector(
                ".result-modal"
            );


        if (!modal) {
            return;
        }


        if (modal._escHandler) {

            document.removeEventListener(
                "keydown",
                modal._escHandler
            );
        }


        modal.classList.remove("active");


        setTimeout(() => {

            modal.remove();

            document.body.classList.remove(
                "modal-open"
            );

        }, 180);
    }


    // ============================================================
    // ОТДЕЛЬНЫЙ РЕЗУЛЬТАТ
    // ============================================================

    function renderFinding(
        finding
    ) {

        const values =
            finding.values || [];


        const sources =
            finding.sources || [];


        return `

            <article class="result-finding">

                <div class="result-finding-top">

                    <h3>
                        ${escapeHtml(finding.title)}
                    </h3>

                    ${
                        values.length
                            ? `
                                <div class="result-values">

                                    ${values
                                        .map(
                                            value =>
                                                `<span>${escapeHtml(value)}</span>`
                                        )
                                        .join("")
                                    }

                                </div>
                              `
                            : ""
                    }

                </div>


                ${
                    finding.description
                        ? `
                            <p class="result-finding-description">
                                ${escapeHtml(
                                    finding.description
                                )}
                            </p>
                          `
                        : ""
                }


                ${
                    sources.length
                        ? `
                            <div class="result-source">

                                <span>
                                    Фрагмент документа
                                </span>

                                ${sources
                                    .slice(0, 3)
                                    .map(
                                        source =>
                                            `
                                            <blockquote>
                                                ${escapeHtml(
                                                    shortenSource(
                                                        source,
                                                        420
                                                    )
                                                )}
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


    // ============================================================
    // ВОЗВРАТ КАРТОЧКИ ЗАГРУЗКИ
    // ============================================================

    function restoreUploadCard(
        file
    ) {

        uploadCard.classList.remove(
            "processing"
        );


        uploadCard.innerHTML = `

            <div class="upload-icon">
                ✓
            </div>

            <h2>
                Документ проанализирован
            </h2>

            <p>
                ${escapeHtml(file.name)}
            </p>

            <button
                class="upload-button"
                id="uploadButton"
                type="button"
            >
                Выбрать другой файл
            </button>

            <div class="upload-note">
                Можно загрузить другой документ
            </div>

        `;


        // --------------------------------------------------------
        // КРИТИЧЕСКИ ВАЖНО:
        // input был сохранён как DOM-объект.
        // Возвращаем его обратно.
        // --------------------------------------------------------

        uploadCard.appendChild(fileInput);


        const newUploadButton =
            document.getElementById(
                "uploadButton"
            );


        newUploadButton?.addEventListener(
            "click",
            () => {

                fileInput.value = "";

                fileInput.click();
            }
        );
    }


    // ============================================================
    // ПРОКРУТКА К АНАЛИЗУ
    // ============================================================

    function scrollToAnalysis() {

        if (!analysisResult) {
            return;
        }


        setTimeout(() => {

            analysisResult.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }, 120);
    }


    // ============================================================
    // PLURALIZE
    // ============================================================

    function pluralize(
        number,
        one,
        few,
        many
    ) {

        const n =
            Math.abs(number) % 100;


        const last =
            n % 10;


        if (
            n >= 11 &&
            n <= 19
        ) {
            return many;
        }


        if (last === 1) {
            return one;
        }


        if (
            last >= 2 &&
            last <= 4
        ) {
            return few;
        }


        return many;
    }


    // ============================================================
    // HTML ESCAPE
    // ============================================================

    function escapeHtml(
        value
    ) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


})();