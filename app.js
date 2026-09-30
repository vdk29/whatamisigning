// ======================================================
// ЧТО Я ПОДПИСЫВАЮ?
// APP.JS
// Версия анализатора: 2026-09-30-v3
// ======================================================


// ======================================================
// НАСТРОЙКИ
// ======================================================

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const PDF_JS_VERSION = "3.11.174";
const TESSERACT_VERSION = "5.1.0";

const PDF_JS_URL =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_JS_VERSION}/pdf.min.js`;

const PDF_WORKER_URL =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_JS_VERSION}/pdf.worker.min.js`;

const TESSERACT_URL =
    `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`;


// ======================================================
// DOM
// ======================================================

const uploadCard = document.getElementById("uploadCard");
const uploadButton = document.getElementById("uploadButton");
const fileInput = document.getElementById("fileInput");

const aboutButton = document.getElementById("aboutButton");
const aboutModal = document.getElementById("aboutModal");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");


// ======================================================
// СОСТОЯНИЕ
// ======================================================

let currentFile = null;
let pdfJsLoaded = false;
let tesseractLoaded = false;
let currentWorker = null;


// ======================================================
// ИНИЦИАЛИЗАЦИЯ
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
    initUpload();
    initModal();
});


// ======================================================
// ЗАГРУЗКА ФАЙЛА
// ======================================================

function initUpload() {

    if (uploadButton) {
        uploadButton.addEventListener("click", (event) => {
            event.preventDefault();

            if (fileInput) {
                fileInput.click();
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", async (event) => {

            const file = event.target.files && event.target.files[0];

            if (!file) {
                return;
            }

            await handleFile(file);
        });
    }


    if (uploadCard) {

        uploadCard.addEventListener("dragover", (event) => {
            event.preventDefault();
            uploadCard.classList.add("drag-active");
        });

        uploadCard.addEventListener("dragleave", (event) => {
            event.preventDefault();
            uploadCard.classList.remove("drag-active");
        });

        uploadCard.addEventListener("drop", async (event) => {

            event.preventDefault();

            uploadCard.classList.remove("drag-active");

            const file =
                event.dataTransfer &&
                event.dataTransfer.files &&
                event.dataTransfer.files[0];

            if (!file) {
                return;
            }

            await handleFile(file);
        });
    }
}


// ======================================================
// МОДАЛЬНОЕ ОКНО "КАК ЭТО РАБОТАЕТ"
// ======================================================

function initModal() {

    if (aboutButton) {
        aboutButton.addEventListener("click", () => {
            openAboutModal();
        });
    }

    if (modalOverlay) {
        modalOverlay.addEventListener("click", () => {
            closeAboutModal();
        });
    }

    if (modalClose) {
        modalClose.addEventListener("click", () => {
            closeAboutModal();
        });
    }

    document.addEventListener("keydown", (event) => {

        if (event.key === "Escape") {
            closeAboutModal();
            closeResultModal();
        }
    });
}


function openAboutModal() {

    if (!aboutModal) {
        return;
    }

    aboutModal.classList.add("active");
    document.body.classList.add("modal-open");
}


function closeAboutModal() {

    if (!aboutModal) {
        return;
    }

    aboutModal.classList.remove("active");

    if (!document.querySelector(".result-modal.active")) {
        document.body.classList.remove("modal-open");
    }
}


// ======================================================
// ОСНОВНАЯ ОБРАБОТКА
// ======================================================

async function handleFile(file) {

    clearPreviousResult();

    currentFile = file;

    const validation = validateFile(file);

    if (!validation.valid) {
        showStatus(validation.message, "error");
        return;
    }

    showSelectedFile(file);

    try {

        let extractedText = "";

        const type = getFileType(file);

        if (type === "pdf") {

            showStatus(
                "Читаем PDF…",
                "loading"
            );

            extractedText = await extractPdfText(file);

        } else {

            showStatus(
                "Распознаём изображение…",
                "loading"
            );

            extractedText = await ocrImage(file);
        }


        extractedText = normalizeText(extractedText);


        if (!extractedText || extractedText.length < 20) {

            showStatus(
                "Не удалось получить достаточно текста из документа.",
                "error"
            );

            return;
        }


        const textLength = extractedText.length;

        showStatus(
            `Текст получен · ${formatNumber(textLength)} символов`,
            "loading"
        );


        await sleep(150);


        const analysis = analyzeDocument(extractedText);


        renderAnalysisResult(
            analysis,
            extractedText
        );


        showStatus(
            "Анализ завершён",
            "success"
        );

    } catch (error) {

        console.error("Document analysis error:", error);

        showStatus(
            "Не удалось обработать документ. Попробуйте другой файл.",
            "error"
        );
    }
}


// ======================================================
// ПРОВЕРКА ФАЙЛА
// ======================================================

function validateFile(file) {

    if (!file) {
        return {
            valid: false,
            message: "Файл не выбран."
        };
    }

    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            message: "Файл слишком большой. Максимальный размер — 20 МБ."
        };
    }

    const type = getFileType(file);

    if (!["pdf", "image"].includes(type)) {
        return {
            valid: false,
            message: "Поддерживаются PDF, JPG и PNG."
        };
    }

    return {
        valid: true
    };
}


function getFileType(file) {

    const name = String(file.name || "").toLowerCase();

    if (
        file.type === "application/pdf" ||
        name.endsWith(".pdf")
    ) {
        return "pdf";
    }

    if (
        file.type.startsWith("image/") ||
        /\.(jpg|jpeg|png)$/i.test(name)
    ) {
        return "image";
    }

    return "unknown";
}


// ======================================================
// PDF.JS
// ======================================================

async function loadPdfJs() {

    if (pdfJsLoaded && window.pdfjsLib) {
        return window.pdfjsLib;
    }

    if (window.pdfjsLib) {

        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            PDF_WORKER_URL;

        pdfJsLoaded = true;

        return window.pdfjsLib;
    }


    await loadScript(PDF_JS_URL);

    if (!window.pdfjsLib) {
        throw new Error("PDF.js не загрузился.");
    }


    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        PDF_WORKER_URL;

    pdfJsLoaded = true;

    return window.pdfjsLib;
}


// ======================================================
// ИЗВЛЕЧЕНИЕ ТЕКСТА ИЗ PDF
// ======================================================

async function extractPdfText(file) {

    const pdfjsLib = await loadPdfJs();

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer
    }).promise;


    let fullText = "";

    let pagesWithText = 0;


    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {

        showStatus(
            `Читаем PDF · страница ${pageNumber} из ${pdf.numPages}`,
            "loading"
        );


        const page = await pdf.getPage(pageNumber);

        const textContent = await page.getTextContent();


        const pageText = textContent.items
            .map(item => item.str || "")
            .join(" ")
            .trim();


        if (pageText.length > 30) {
            pagesWithText++;
        }


        fullText +=
            `\n\n[Страница ${pageNumber}]\n` +
            pageText;
    }


    /*
     * Если PDF практически не содержит текста,
     * считаем его сканом и запускаем OCR.
     */

    if (
        pagesWithText === 0 ||
        fullText.replace(/\[Страница \d+\]/g, "").trim().length < 80
    ) {

        showStatus(
            `PDF похож на скан · запускаем OCR`,
            "loading"
        );

        return await ocrPdf(pdf);
    }


    return fullText;
}


// ======================================================
// TESSERACT
// ======================================================

async function loadTesseract() {

    if (tesseractLoaded && window.Tesseract) {
        return window.Tesseract;
    }

    if (window.Tesseract) {
        tesseractLoaded = true;
        return window.Tesseract;
    }

    await loadScript(TESSERACT_URL);

    if (!window.Tesseract) {
        throw new Error("Tesseract.js не загрузился.");
    }

    tesseractLoaded = true;

    return window.Tesseract;
}


// ======================================================
// OCR ИЗОБРАЖЕНИЯ
// ======================================================

async function ocrImage(file) {

    const Tesseract = await loadTesseract();

    showStatus(
        "Подготавливаем распознавание…",
        "loading"
    );


    const result = await Tesseract.recognize(
        file,
        "rus+eng",
        {
            logger: handleOcrProgress
        }
    );


    return result?.data?.text || "";
}


// ======================================================
// OCR PDF
// ======================================================

async function ocrPdf(pdf) {

    const Tesseract = await loadTesseract();

    let fullText = "";


    for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
    ) {

        showStatus(
            `Распознаём страницу ${pageNumber} из ${pdf.numPages}`,
            "loading"
        );


        const page = await pdf.getPage(pageNumber);


        /*
         * Умеренное увеличение качества.
         * Слишком высокий scale сильно замедляет Tesseract.
         */

        const viewport = page.getViewport({
            scale: 1.7
        });


        const canvas = document.createElement("canvas");

        const context = canvas.getContext("2d", {
            willReadFrequently: true
        });


        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);


        await page.render({
            canvasContext: context,
            viewport
        }).promise;


        const result = await Tesseract.recognize(
            canvas,
            "rus+eng",
            {
                logger: handleOcrProgress
            }
        );


        const pageText =
            result?.data?.text || "";


        fullText +=
            `\n\n[Страница ${pageNumber}]\n` +
            pageText;


        canvas.width = 1;
        canvas.height = 1;
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

    if (message.status === "recognizing text") {

        const progress = Math.round(
            (message.progress || 0) * 100
        );

        showStatus(
            `Распознаём документ · ${progress}%`,
            "loading"
        );
    }
}


// ======================================================
// АНАЛИЗ ДОКУМЕНТА
// ======================================================

function analyzeDocument(text) {

    const cleanText = normalizeText(text);

    const sentences = splitIntoSentences(cleanText);


    const categories = {
        important: [],
        worth: [],
        money: [],
        deadlines: [],
        data: [],
        restrictions: []
    };


    // ==================================================
    // ВАЖНО
    // ==================================================

    addGroupedCategory(
        categories.important,
        "renewal",
        "Автопродление",
        "Договор или услуга могут продлеваться автоматически.",
        "↻",
        sentences,
        [
            /автоматическ\w*\s+(?:продл|пролонг)/i,
            /продлева(?:ется|ть)\s+автоматически/i,
            /если\s+не\s+уведом/i,
            /автоматическ\w*\s+пролонгац/i,
            /пролонгац/i
        ]
    );


    addGroupedCategory(
        categories.important,
        "penalties",
        "Штрафы и санкции",
        "Обнаружены условия о штрафах, пенях или других санкциях.",
        "!",
        sentences,
        [
            /штраф/i,
            /штрафн/i,
            /санкци/i,
            /неустойк/i,
            /пен[яи]\b/i,
            /пени\b/i
        ]
    );


    addGroupedCategory(
        categories.important,
        "price_change",
        "Изменение стоимости",
        "Документ содержит условия изменения цены или тарифа.",
        "₽",
        sentences,
        [
            /стоимост\w*.*измен/i,
            /цен\w*.*измен/i,
            /тариф\w*.*измен/i,
            /измен[яи]ть.*цен/i,
            /измен[яи]ть.*стоим/i,
            /вправе.*измен.*стоим/i,
            /может.*измен.*тариф/i,
            /увелич.*стоим/i
        ]
    );


    addGroupedCategory(
        categories.important,
        "termination_penalty",
        "Расторжение",
        "Обнаружены условия досрочного расторжения или последствия прекращения договора.",
        "×",
        sentences,
        [
            /досрочн\w*\s+расторж/i,
            /расторгнуть\s+договор/i,
            /расторжен\w*\s+договор/i,
            /прекращен\w*\s+договора/i,
            /отказаться\s+от\s+договора/i
        ]
    );


    addGroupedCategory(
        categories.important,
        "liability",
        "Ответственность",
        "Документ содержит условия об ответственности сторон.",
        "!",
        sentences,
        [
            /ответственност/i,
            /возмещени\w*\s+ущерб/i,
            /возместить\s+убыт/i,
            /убытк/i
        ]
    );


    // ==================================================
    // СТОИТ ЗНАТЬ
    // ==================================================

    addGroupedCategory(
        categories.worth,
        "payment",
        "Оплата",
        "Условия внесения оплаты, аванса или платежей.",
        "₽",
        sentences,
        [
            /оплат[аеуы]/i,
            /оплачива/i,
            /платеж/i,
            /плат[аи]ть/i,
            /аванс/i,
            /предоплат/i
        ]
    );


    addGroupedCategory(
        categories.worth,
        "commission",
        "Комиссии",
        "Обнаружены комиссии, сборы или дополнительные платежи.",
        "%",
        sentences,
        [
            /комисси/i,
            /сбор\w*\s+за/i,
            /дополнительн\w*\s+плат/i,
            /сервисн\w*\s+сбор/i
        ]
    );


    addGroupedCategory(
        categories.worth,
        "advertising",
        "Реклама и рассылки",
        "Документ может содержать согласие на рекламу или рассылки.",
        "✉",
        sentences,
        [
            /рекламн\w*\s+(?:сообщ|рассыл)/i,
            /реклам\w*\s+рассыл/i,
            /согласие\s+на\s+получение\s+реклам/i,
            /маркетингов/i,
            /sms[-\s]?сообщ/i
        ]
    );


    addGroupedCategory(
        categories.worth,
        "notifications",
        "Уведомления",
        "Обнаружены условия о способе или сроках уведомления.",
        "i",
        sentences,
        [
            /уведомить/i,
            /уведомлен/i,
            /уведомлени/i,
            /извещен/i,
            /сообщить\s+о/i
        ]
    );


    // ==================================================
    // ДАННЫЕ
    // ==================================================

    addGroupedCategory(
        categories.data,
        "personal_data",
        "Персональные данные",
        "Документ содержит условия обработки или передачи персональных данных.",
        "◎",
        sentences,
        [
            /персональн\w*\s+данн/i,
            /обработк\w*\s+персональн/i,
            /согласие\s+на\s+обработк/i
        ]
    );


    addGroupedCategory(
        categories.data,
        "third_parties",
        "Передача третьим лицам",
        "Обнаружены условия передачи данных другим организациям или партнёрам.",
        "→",
        sentences,
        [
            /третьим\s+лиц/i,
            /партнер\w*/i,
            /партнё\w*/i,
            /передач\w*\s+данн/i,
            /передавать.*данн/i
        ]
    );


    // ==================================================
    // ОГРАНИЧЕНИЯ
    // ==================================================

    addGroupedCategory(
        categories.restrictions,
        "limitations",
        "Ограничение ответственности",
        "Компания ограничивает объём своей ответственности или исключает отдельные случаи.",
        "⛔",
        sentences,
        [
            /ограничива[ея]\s+ответственност/i,
            /ограничен\w*\s+ответственност/i,
            /не\s+нес[её]т\s+ответственност/i,
            /не\s+отвечает\s+за/i,
            /не\s+обязан\w*\s+возмещ/i
        ]
    );


    addGroupedCategory(
        categories.restrictions,
        "restrictions",
        "Ограничения",
        "Обнаружены запреты, ограничения или специальные условия использования.",
        "⊘",
        sentences,
        [
            /запрещается/i,
            /запрещен/i,
            /не\s+допускается/i,
            /ограничива[ея]\s+использован/i,
            /ограничен\w*\s+доступ/i
        ]
    );


    // ==================================================
    // ДЕНЬГИ
    // ==================================================

    const moneyFindings = extractMoneyFindings(
        sentences
    );

    categories.money = groupMoneyFindings(
        moneyFindings
    );


    // ==================================================
    // СРОКИ
    // ==================================================

    categories.deadlines = extractDeadlineFindings(
        sentences
    );


    // ==================================================
    // УДАЛЯЕМ ДУБЛИКАТЫ
    // ==================================================

    for (const key of Object.keys(categories)) {

        categories[key] = removeDuplicateGroups(
            categories[key]
        );
    }


    // ==================================================
    // СТАТИСТИКА
    // ==================================================

    let groupCount = 0;
    let fragmentCount = 0;


    for (const key of Object.keys(categories)) {

        groupCount += categories[key].length;

        categories[key].forEach(group => {

            fragmentCount +=
                Array.isArray(group.sources)
                    ? group.sources.length
                    : 0;
        });
    }


    const summary = createSummary(
        categories,
        groupCount,
        fragmentCount,
        cleanText
    );


    return {
        categories,
        summary,
        stats: {
            groupCount,
            fragmentCount,
            characters: cleanText.length,
            words: cleanText
                .split(/\s+/)
                .filter(Boolean)
                .length
        }
    };
}


// ======================================================
// ДОБАВЛЕНИЕ ГРУППЫ
// ======================================================

function addGroupedCategory(
    target,
    key,
    title,
    description,
    icon,
    sentences,
    patterns
) {

    const matches = [];


    for (const sentence of sentences) {

        if (!sentence || sentence.length < 8) {
            continue;
        }


        const matched = patterns.some(
            pattern => pattern.test(sentence)
        );


        if (!matched) {
            continue;
        }


        matches.push(sentence);
    }


    const uniqueSources =
        removeDuplicateStrings(matches);


    if (!uniqueSources.length) {
        return;
    }


    target.push({
        key,
        title,
        description,
        icon,
        sources: uniqueSources
    });
}


// ======================================================
// ДЕНЬГИ
// ======================================================

function extractMoneyFindings(sentences) {

    const results = [];


    for (const sentence of sentences) {

        const moneyMatches =
            findMoneyExpressions(sentence);

        const percentMatches =
            findPercentExpressions(sentence);


        if (
            moneyMatches.length === 0 &&
            percentMatches.length === 0
        ) {
            continue;
        }


        const context =
            cleanFindingText(sentence);


        /*
         * Если в предложении есть деньги —
         * создаём конкретные денежные условия.
         */

        for (const money of moneyMatches) {

            const title =
                classifyMoneyContext(
                    sentence
                );


            results.push({
                key: createMoneyKey(title),
                title,
                value: money,
                source: context,
                kind: "money"
            });
        }


        /*
         * Проценты связываем с предложением,
         * а не показываем как отдельное число.
         */

        for (const percent of percentMatches) {

            const title =
                classifyPercentContext(
                    sentence
                );


            results.push({
                key: createMoneyKey(title),
                title,
                value: percent,
                source: context,
                kind: "percent"
            });
        }
    }


    return results;
}


// ======================================================
// ДЕНЕЖНЫЕ ВЫРАЖЕНИЯ
// ======================================================

function findMoneyExpressions(text) {

    const results = [];


    /*
     * 4 990 рублей
     * 4990 руб.
     * 4.990,50 ₽
     * 5 000 р
     */

    const patterns = [

        /(?:\d{1,3}(?:[ .]\d{3})+(?:[,.]\d{1,2})?|\d+(?:[,.]\d{1,2})?)\s*(?:₽|руб(?:лей|ля|ль)?\.?|р\.)(?!\w)/gi,

        /(?:₽|руб(?:лей|ля|ль)?\.?|р\.)\s*(?:\d{1,3}(?:[ .]\d{3})+(?:[,.]\d{1,2})?|\d+(?:[,.]\d{1,2})?)/gi

    ];


    for (const pattern of patterns) {

        const matches = text.match(pattern) || [];

        results.push(...matches);
    }


    return removeDuplicateStrings(
        results.map(normalizeMoneyExpression)
    );
}


// ======================================================
// ПРОЦЕНТЫ
// ======================================================

function findPercentExpressions(text) {

    const results = [];


    const percentPatterns = [

        /\d+(?:[,.]\d+)?\s*%/gi,

        /\d+(?:[,.]\d+)?\s*процент(?:а|ов)?/gi

    ];


    for (const pattern of percentPatterns) {

        const matches =
            text.match(pattern) || [];

        results.push(...matches);
    }


    return removeDuplicateStrings(
        results.map(value =>
            value
                .replace(/\s+/g, " ")
                .trim()
        )
    );
}


// ======================================================
// КЛАССИФИКАЦИЯ ДЕНЕГ
// ======================================================

function classifyMoneyContext(sentence) {

    const text =
        sentence.toLowerCase();


    if (
        /штраф|неустойк|пен[яи]\b|санкци/.test(text)
    ) {
        return "Штраф или санкция";
    }


    if (
        /комисси|сбор/.test(text)
    ) {
        return "Комиссия";
    }


    if (
        /аванс|предоплат/.test(text)
    ) {
        return "Аванс или предоплата";
    }


    if (
        /оплат|платеж|плат[аи]ть/.test(text)
    ) {
        return "Оплата";
    }


    if (
        /стоимост|цен[аеы]|тариф/.test(text)
    ) {
        return "Стоимость";
    }


    if (
        /возмещ|убыт|ущерб/.test(text)
    ) {
        return "Возмещение";
    }


    return "Денежное условие";
}


function classifyPercentContext(sentence) {

    const text =
        sentence.toLowerCase();


    if (
        /штраф|неустойк|пен[яи]\b|санкци/.test(text)
    ) {
        return "Штраф или санкция";
    }


    if (
        /комисси|сбор/.test(text)
    ) {
        return "Комиссия";
    }


    if (
        /стоимост|цен[аеы]|тариф/.test(text)
    ) {
        return "Изменение стоимости";
    }


    if (
        /оплат|платеж|задолженност|долг/.test(text)
    ) {
        return "Условие оплаты";
    }


    return "Процентное условие";
}


function createMoneyKey(title) {

    return title
        .toLowerCase()
        .replace(/[^а-яёa-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "");
}


// ======================================================
// ГРУППИРОВКА ДЕНЕГ
// ======================================================

function groupMoneyFindings(findings) {

    const map = new Map();


    for (const item of findings) {

        const key = item.key;


        if (!map.has(key)) {

            map.set(key, {
                key,
                title: item.title,
                description: moneyGroupDescription(
                    item.title
                ),
                icon: moneyGroupIcon(
                    item.title
                ),
                sources: [],
                values: []
            });
        }


        const group = map.get(key);


        if (!group.values.includes(item.value)) {
            group.values.push(item.value);
        }


        if (!group.sources.includes(item.source)) {
            group.sources.push(item.source);
        }
    }


    return Array.from(map.values());
}


function moneyGroupDescription(title) {

    switch (title) {

        case "Стоимость":
            return "Цена или стоимость услуги.";

        case "Оплата":
            return "Условия внесения платежей.";

        case "Комиссия":
            return "Комиссии и дополнительные сборы.";

        case "Штраф или санкция":
            return "Штрафы, пени и другие денежные последствия.";

        case "Аванс или предоплата":
            return "Условия предварительной оплаты.";

        case "Изменение стоимости":
            return "Процентные условия, связанные с ценой.";

        case "Условие оплаты":
            return "Процент, связанный с оплатой или задолженностью.";

        case "Возмещение":
            return "Денежное возмещение или компенсация.";

        default:
            return "Денежное условие документа.";
    }
}


function moneyGroupIcon(title) {

    if (
        /штраф|санкци/i.test(title)
    ) {
        return "!";
    }

    if (
        /комисси/i.test(title)
    ) {
        return "%";
    }

    return "₽";
}


// ======================================================
// СРОКИ И ДАТЫ
// ======================================================

function extractDeadlineFindings(sentences) {

    const groups = new Map();


    for (const sentence of sentences) {

        const durations =
            findDurationExpressions(sentence);

        const dates =
            findDateExpressions(sentence);


        if (
            durations.length === 0 &&
            dates.length === 0
        ) {
            continue;
        }


        const title =
            classifyDeadlineContext(sentence);


        const key =
            createDeadlineKey(title);


        if (!groups.has(key)) {

            groups.set(key, {
                key,
                title,
                description:
                    deadlineDescription(title),
                icon: "◷",
                sources: [],
                values: []
            });
        }


        const group = groups.get(key);


        for (const value of durations) {

            if (!group.values.includes(value)) {
                group.values.push(value);
            }
        }


        for (const value of dates) {

            if (!group.values.includes(value)) {
                group.values.push(value);
            }
        }


        if (!group.sources.includes(sentence)) {
            group.sources.push(sentence);
        }
    }


    return Array.from(groups.values());
}


// ======================================================
// ДЛИТЕЛЬНОСТИ
// ======================================================

function findDurationExpressions(text) {

    const results = [];


    const patterns = [

        /\b\d+(?:[,.]\d+)?\s*(?:день|дня|дней)\b/gi,

        /\b\d+(?:[,.]\d+)?\s*(?:сутки|суток)\b/gi,

        /\b\d+(?:[,.]\d+)?\s*(?:недел[яьи])\b/gi,

        /\b\d+(?:[,.]\d+)?\s*(?:месяц(?:а|ев)?)\b/gi,

        /\b\d+(?:[,.]\d+)?\s*(?:год(?:а|ов)?)\b/gi,

        /\b\d+(?:[,.]\d+)?\s*(?:час(?:а|ов)?)\b/gi,

        /\b\d+(?:[,.]\d+)?\s*(?:минут(?:а|ы)?)\b/gi

    ];


    for (const pattern of patterns) {

        const matches =
            text.match(pattern) || [];

        results.push(...matches);
    }


    return removeDuplicateStrings(
        results.map(value =>
            value
                .replace(/\s+/g, " ")
                .trim()
        )
    );
}


// ======================================================
// ДАТЫ
// ======================================================

function findDateExpressions(text) {

    const results = [];


    const patterns = [

        /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g,

        /\b\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{4}\s*(?:г\.?)?/gi,

        /\b(?:с|до|по|не позднее|не ранее)\s+\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/gi

    ];


    for (const pattern of patterns) {

        const matches =
            text.match(pattern) || [];

        results.push(...matches);
    }


    return removeDuplicateStrings(
        results.map(value =>
            value
                .replace(/\s+/g, " ")
                .trim()
        )
    );
}


// ======================================================
// КЛАССИФИКАЦИЯ СРОКОВ
// ======================================================

function classifyDeadlineContext(sentence) {

    const text =
        sentence.toLowerCase();


    if (
        /расторг|прекращен|отказаться/.test(text)
    ) {
        return "Срок расторжения";
    }


    if (
        /уведом/.test(text)
    ) {
        return "Срок уведомления";
    }


    if (
        /оплат|платеж|аванс|предоплат/.test(text)
    ) {
        return "Срок оплаты";
    }


    if (
        /продл|пролонг|срок действия/.test(text)
    ) {
        return "Срок действия";
    }


    if (
        /действует|действия договора/.test(text)
    ) {
        return "Срок действия";
    }


    if (
        /исполн|оказания услуг|предоставлен/.test(text)
    ) {
        return "Срок исполнения";
    }


    return "Срок или период";
}


function createDeadlineKey(title) {

    return title
        .toLowerCase()
        .replace(/[^а-яёa-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "");
}


function deadlineDescription(title) {

    switch (title) {

        case "Срок расторжения":
            return "Период или дата, связанные с прекращением договора.";

        case "Срок уведомления":
            return "Когда необходимо предупредить другую сторону.";

        case "Срок оплаты":
            return "Когда необходимо внести оплату.";

        case "Срок действия":
            return "Период действия договора или услуги.";

        case "Срок исполнения":
            return "Срок выполнения обязательства или оказания услуги.";

        default:
            return "Найденный срок, период или дата.";
    }
}


// ======================================================
// РАЗБИЕНИЕ НА ПРЕДЛОЖЕНИЯ
// ======================================================

function splitIntoSentences(text) {

    const cleaned =
        text
            .replace(/\[Страница\s+\d+\]/gi, " ")
            .replace(/\r/g, " ")
            .replace(/\n+/g, " ")
            .replace(/\s+/g, " ")
            .trim();


    /*
     * Сначала разбиваем по обычной пунктуации.
     */

    const raw =
        cleaned
            .split(/(?<=[.!?;])\s+(?=[А-ЯЁA-Z0-9«"„])/)
            .map(value => value.trim())
            .filter(value => value.length >= 8);


    /*
     * Если PDF плохо расставил точки,
     * дополнительно режем чрезмерно длинные куски.
     */

    const result = [];


    for (const sentence of raw) {

        if (sentence.length <= 650) {

            result.push(sentence);

            continue;
        }


        const parts =
            sentence.split(
                /(?=\b(?:при|если|в случае|в течение|не позднее|не ранее|не менее|не более|стоимость|оплата|штраф|пеня|комиссия)\b)/i
            );


        if (parts.length <= 1) {

            result.push(
                sentence.slice(0, 900)
            );

        } else {

            for (const part of parts) {

                const trimmed =
                    part.trim();

                if (trimmed.length >= 8) {
                    result.push(trimmed);
                }
            }
        }
    }


    return removeDuplicateStrings(result);
}


// ======================================================
// НОРМАЛИЗАЦИЯ
// ======================================================

function normalizeText(text) {

    if (!text) {
        return "";
    }


    return String(text)

        // типичные ошибки OCR
        .replace(/\u00A0/g, " ")

        .replace(/[ \t]+/g, " ")

        .replace(/\n[ \t]+/g, "\n")

        .replace(/[ \t]+\n/g, "\n")

        .replace(/\n{3,}/g, "\n\n")

        // странные OCR-разрывы
        .replace(/(\w)-\s*\n\s*(\w)/g, "$1$2")

        .trim();
}


// ======================================================
// СВОДКА
// ======================================================

function createSummary(
    categories,
    groupCount,
    fragmentCount,
    text
) {

    if (groupCount === 0) {

        return {
            title: "Явных условий не найдено",
            description:
                "В тексте не удалось обнаружить знакомые нам формулировки. Это не означает, что документ не содержит важных условий."
        };
    }


    const categoryNames = [];


    if (categories.important.length) {
        categoryNames.push("важные условия");
    }

    if (categories.worth.length) {
        categoryNames.push("дополнительные условия");
    }

    if (categories.money.length) {
        categoryNames.push("денежные условия");
    }

    if (categories.deadlines.length) {
        categoryNames.push("сроки");
    }

    if (categories.data.length) {
        categoryNames.push("данные");
    }

    if (categories.restrictions.length) {
        categoryNames.push("ограничения");
    }


    return {
        title:
            `Найдено ${groupCount} ${plural(
                groupCount,
                "группа",
                "группы",
                "групп"
            )} условий`,

        description:
            `Мы нашли ${fragmentCount} ${plural(
                fragmentCount,
                "фрагмент",
                "фрагмента",
                "фрагментов"
            )} в категориях: ${categoryNames.join(", ")}.`
    };
}


// ======================================================
// УДАЛЕНИЕ ДУБЛИКАТОВ ГРУПП
// ======================================================

function removeDuplicateGroups(groups) {

    const result = [];
    const seen = new Set();


    for (const group of groups) {

        if (!group) {
            continue;
        }


        const normalizedTitle =
            String(group.title || "")
                .toLowerCase()
                .replace(/\s+/g, " ")
                .trim();


        const key =
            `${group.key || normalizedTitle}`;


        if (seen.has(key)) {

            const existing =
                result.find(
                    item => item.key === group.key
                );


            if (existing) {

                existing.sources = removeDuplicateStrings([
                    ...existing.sources,
                    ...(group.sources || [])
                ]);


                existing.values = removeDuplicateStrings([
                    ...(existing.values || []),
                    ...(group.values || [])
                ]);
            }


            continue;
        }


        seen.add(key);


        group.sources =
            removeDuplicateStrings(
                group.sources || []
            );


        if (group.values) {

            group.values =
                removeDuplicateStrings(
                    group.values
                );
        }


        result.push(group);
    }


    return result;
}


// ======================================================
// УДАЛЕНИЕ ДУБЛИКАТОВ СТРОК
// ======================================================

function removeDuplicateStrings(items) {

    const result = [];
    const seen = new Set();


    for (const item of items || []) {

        const value =
            String(item || "")
                .replace(/\s+/g, " ")
                .trim();


        if (!value) {
            continue;
        }


        const key =
            value.toLowerCase();


        if (seen.has(key)) {
            continue;
        }


        seen.add(key);
        result.push(value);
    }


    return result;
}


// ======================================================
// ОТОБРАЖЕНИЕ РЕЗУЛЬТАТА
// ======================================================

function renderAnalysisResult(
    analysis,
    originalText
) {

    const existing =
        document.querySelector(".analysis-result");


    if (existing) {
        existing.remove();
    }


    const categories =
        analysis.categories;


    const result =
        document.createElement("section");


    result.className =
        "analysis-result";


    result.id =
        "analysisResult";


    const totalGroups =
        analysis.stats.groupCount;


    const totalFragments =
        analysis.stats.fragmentCount;


    result.innerHTML = `

        <div class="analysis-result-inner">

            <div class="result-heading">

                <div class="result-heading-left">

                    <div class="section-label">
                        РЕЗУЛЬТАТ АНАЛИЗА
                    </div>

                    <h2>
                        Что найдено
                    </h2>

                    <p class="result-description">
                        ${escapeHtml(
                            analysis.summary.description
                        )}
                    </p>

                </div>

                <div class="result-stats">

                    <div class="result-stat">

                        <strong>
                            ${totalGroups}
                        </strong>

                        <span>
                            ${plural(
                                totalGroups,
                                "группа",
                                "группы",
                                "групп"
                            )}
                        </span>

                    </div>

                    <div class="result-stat">

                        <strong>
                            ${totalFragments}
                        </strong>

                        <span>
                            ${plural(
                                totalFragments,
                                "фрагмент",
                                "фрагмента",
                                "фрагментов"
                            )}
                        </span>

                    </div>

                </div>

            </div>


            <div class="result-grid">

                ${renderResultCategoryCard(
                    "important",
                    "Важно",
                    "Условия, которые стоит проверить в первую очередь.",
                    categories.important,
                    "!"
                )}

                ${renderResultCategoryCard(
                    "worth",
                    "Стоит знать",
                    "Другие существенные условия документа.",
                    categories.worth,
                    "i"
                )}

                ${renderResultCategoryCard(
                    "money",
                    "Деньги",
                    "Стоимость, платежи, комиссии, штрафы и проценты.",
                    categories.money,
                    "₽"
                )}

                ${renderResultCategoryCard(
                    "deadlines",
                    "Сроки",
                    "Даты, периоды и сроки уведомления или оплаты.",
                    categories.deadlines,
                    "◷"
                )}

                ${renderResultCategoryCard(
                    "data",
                    "Данные",
                    "Персональные данные и их возможная передача.",
                    categories.data,
                    "◎"
                )}

                ${renderResultCategoryCard(
                    "restrictions",
                    "Ограничения",
                    "Запреты и ограничения ответственности.",
                    categories.restrictions,
                    "⊘"
                )}

            </div>


            <div class="result-hint">
                Нажмите на категорию, чтобы посмотреть подробности
            </div>


            <div class="result-note">

                <strong>
                    Важно
                </strong>

                <span>
                    Автоматический анализ помогает обратить
                    внимание на условия документа, но не заменяет
                    юридическую консультацию.
                </span>

            </div>

        </div>

    `;


    /*
     * Вставляем после hero/features/example,
     * но перед footer.
     */

    const footer =
        document.querySelector(".footer");


    if (footer && footer.parentNode) {

        footer.parentNode.insertBefore(
            result,
            footer
        );

    } else {

        document.body.appendChild(result);
    }


    initResultCards(
        analysis
    );
}


// ======================================================
// КАРТОЧКА КАТЕГОРИИ
// ======================================================

function renderResultCategoryCard(
    key,
    title,
    description,
    groups,
    icon
) {

    const groupCount =
        Array.isArray(groups)
            ? groups.length
            : 0;


    if (groupCount === 0) {

        return "";
    }


    const fragmentCount =
        groups.reduce(
            (sum, group) =>
                sum +
                (group.sources
                    ? group.sources.length
                    : 0),
            0
        );


    let meta = "";


    if (key === "money") {

        const values =
            groups.reduce(
                (sum, group) =>
                    sum +
                    (group.values
                        ? group.values.length
                        : 0),
                0
            );


        meta =
            `${groupCount} ${plural(
                groupCount,
                "условие",
                "условия",
                "условий"
            )}` +
            (values
                ? ` · ${values} ${plural(
                    values,
                    "значение",
                    "значения",
                    "значений"
                )}`
                : "");

    } else {

        meta =
            `${groupCount} ${plural(
                groupCount,
                "группа",
                "группы",
                "групп"
            )}`;
    }


    return `

        <button
            class="result-category-card result-category-${key}"
            data-result-category="${key}"
            type="button"
        >

            <span class="result-card-icon">
                ${icon}
            </span>

            <span class="result-card-content">

                <strong>
                    ${escapeHtml(title)}
                </strong>

                <span class="result-card-description">
                    ${escapeHtml(description)}
                </span>

                <span class="result-card-meta">
                    ${escapeHtml(meta)}
                </span>

            </span>

            <span class="result-card-arrow">
                →
            </span>

        </button>

    `;
}


// ======================================================
// КЛИКИ ПО КАТЕГОРИЯМ
// ======================================================

function initResultCards(analysis) {

    const cards =
        document.querySelectorAll(
            "[data-result-category]"
        );


    cards.forEach(card => {

        card.addEventListener(
            "click",
            () => {

                const category =
                    card.dataset.resultCategory;


                const groups =
                    analysis.categories[
                        category
                    ] || [];


                openResultModal(
                    category,
                    groups
                );
            }
        );
    });
}


// ======================================================
// МОДАЛКА РЕЗУЛЬТАТА
// ======================================================

function openResultModal(
    category,
    groups
) {

    closeResultModal();


    const modal =
        document.createElement("div");


    modal.className =
        `result-modal result-modal-${category}`;


    modal.innerHTML = `

        <div class="result-modal-overlay"></div>

        <div
            class="result-modal-card"
            role="dialog"
            aria-modal="true"
        >

            <button
                class="result-modal-close"
                type="button"
                aria-label="Закрыть"
            >
                ×
            </button>


            <div class="result-modal-header">

                <div class="result-modal-label">
                    ${getCategoryLabel(category)}
                </div>

                <h3>
                    ${escapeHtml(
                        getCategoryTitle(category)
                    )}
                </h3>

                <p>
                    ${escapeHtml(
                        getCategoryDescription(
                            category
                        )
                    )}
                </p>

            </div>


            <div class="result-detail-list">

                ${
                    groups.length
                        ? groups
                            .map(group =>
                                renderDetailGroup(
                                    group
                                )
                            )
                            .join("")
                        : renderEmptyDetail()
                }

            </div>


            <div class="result-modal-footer">

                ${groups.length}

                ${plural(
                    groups.length,
                    "группа условия",
                    "группы условий",
                    "групп условий"
                )}

            </div>

        </div>

    `;


    document.body.appendChild(modal);


    requestAnimationFrame(() => {
        modal.classList.add("active");
    });


    document.body.classList.add("modal-open");


    const overlay =
        modal.querySelector(
            ".result-modal-overlay"
        );


    const closeButton =
        modal.querySelector(
            ".result-modal-close"
        );


    if (overlay) {

        overlay.addEventListener(
            "click",
            closeResultModal
        );
    }


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeResultModal
        );
    }
}


function closeResultModal() {

    const modal =
        document.querySelector(
            ".result-modal"
        );


    if (!modal) {

        if (!aboutModal?.classList.contains("active")) {
            document.body.classList.remove("modal-open");
        }

        return;
    }


    modal.classList.remove("active");


    setTimeout(() => {

        modal.remove();

        if (
            !aboutModal?.classList.contains("active")
        ) {
            document.body.classList.remove(
                "modal-open"
            );
        }

    }, 180);
}


// ======================================================
// ДЕТАЛЬНАЯ ГРУППА
// ======================================================

function renderDetailGroup(group) {

    const values =
        Array.isArray(group.values)
            ? group.values
            : [];


    const sources =
        Array.isArray(group.sources)
            ? group.sources
            : [];


    return `

        <article class="result-detail-group">

            <div class="detail-group-top">

                <div class="detail-group-icon">
                    ${escapeHtml(
                        group.icon || "i"
                    )}
                </div>

                <div class="detail-group-heading">

                    <span>
                        УСЛОВИЕ
                    </span>

                    <h4>
                        ${escapeHtml(
                            group.title
                        )}
                    </h4>

                </div>

            </div>


            <p class="detail-group-description">
                ${escapeHtml(
                    group.description || ""
                )}
            </p>


            ${
                values.length
                    ? `
                        <div class="detail-values">

                            ${values
                                .map(
                                    value => `
                                        <span class="detail-value">
                                            ${escapeHtml(
                                                value
                                            )}
                                        </span>
                                    `
                                )
                                .join("")}

                        </div>
                    `
                    : ""
            }


            <div class="detail-sources">

                <div class="detail-source-label">
                    ФРАГМЕНТЫ ДОКУМЕНТА
                </div>

                ${
                    sources
                        .slice(0, 8)
                        .map(
                            source => `
                                <div class="detail-source">
                                    ${escapeHtml(
                                        source
                                    )}
                                </div>
                            `
                        )
                        .join("")
                }

                ${
                    sources.length > 8
                        ? `
                            <div class="detail-more">
                                Ещё ${sources.length - 8}
                                ${plural(
                                    sources.length - 8,
                                    "фрагмент",
                                    "фрагмента",
                                    "фрагментов"
                                )}
                            </div>
                        `
                        : ""
                }

            </div>

        </article>

    `;
}


function renderEmptyDetail() {

    return `

        <div class="result-empty">
            В этой категории ничего не найдено.
        </div>

    `;
}


// ======================================================
// НАЗВАНИЯ КАТЕГОРИЙ
// ======================================================

function getCategoryLabel(category) {

    switch (category) {

        case "important":
            return "ПРОВЕРЬТЕ";

        case "worth":
            return "СТОИТ ЗНАТЬ";

        case "money":
            return "ФИНАНСЫ";

        case "deadlines":
            return "СРОКИ";

        case "data":
            return "ПЕРСОНАЛЬНЫЕ ДАННЫЕ";

        case "restrictions":
            return "ОГРАНИЧЕНИЯ";

        default:
            return "РЕЗУЛЬТАТ";
    }
}


function getCategoryTitle(category) {

    switch (category) {

        case "important":
            return "Важные условия";

        case "worth":
            return "Стоит знать";

        case "money":
            return "Деньги";

        case "deadlines":
            return "Сроки";

        case "data":
            return "Данные";

        case "restrictions":
            return "Ограничения";

        default:
            return "Результат";
    }
}


function getCategoryDescription(category) {

    switch (category) {

        case "important":
            return "Условия, которые могут существенно повлиять на ваши обязательства.";

        case "worth":
            return "Другие условия, на которые стоит обратить внимание.";

        case "money":
            return "Стоимость, платежи, комиссии, штрафы и процентные условия.";

        case "deadlines":
            return "Сроки, даты, периоды и требования к уведомлению.";

        case "data":
            return "Условия обработки и передачи персональных данных.";

        case "restrictions":
            return "Ограничения, запреты и условия ответственности.";

        default:
            return "";
    }
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
            class="upload-status"
            id="uploadStatus"
        >
            Подготавливаем документ…
        </div>

    `;


    /*
     * Важно:
     * input удалился через innerHTML,
     * поэтому возвращаем его обратно в карточку.
     */

    if (fileInput) {

        fileInput.hidden = true;

        uploadCard.appendChild(
            fileInput
        );
    }
}


// ======================================================
// СТАТУС
// ======================================================

function showStatus(
    message,
    type = "loading"
) {

    const status =
        document.getElementById(
            "uploadStatus"
        );


    if (!status) {
        return;
    }


    status.textContent =
        message;


    status.dataset.status =
        type;
}


// ======================================================
// ОЧИСТКА ПРЕДЫДУЩЕГО РЕЗУЛЬТАТА
// ======================================================

function clearPreviousResult() {

    const result =
        document.querySelector(
            ".analysis-result"
        );


    if (result) {
        result.remove();
    }


    closeResultModal();


    if (aboutModal) {
        aboutModal.classList.remove("active");
    }


    document.body.classList.remove(
        "modal-open"
    );
}


// ======================================================
// ЗАГРУЗКА SCRIPT
// ======================================================

function loadScript(src) {

    return new Promise(
        (resolve, reject) => {

            const existing =
                document.querySelector(
                    `script[src="${src}"]`
                );


            if (existing) {

                existing.addEventListener(
                    "load",
                    resolve,
                    { once: true }
                );

                existing.addEventListener(
                    "error",
                    reject,
                    { once: true }
                );

                return;
            }


            const script =
                document.createElement(
                    "script"
                );


            script.src = src;

            script.async = true;


            script.onload =
                () => resolve();

            script.onerror =
                () =>
                    reject(
                        new Error(
                            `Не удалось загрузить ${src}`
                        )
                    );


            document.head.appendChild(
                script
            );
        }
    );
}


// ======================================================
// УТИЛИТЫ
// ======================================================

function cleanFindingText(text) {

    return String(text || "")
        .replace(/\s+/g, " ")
        .replace(/\[Страница\s+\d+\]/gi, "")
        .trim();
}


function normalizeMoneyExpression(value) {

    return String(value || "")
        .replace(/\s+/g, " ")
        .replace(
            /\bруб(?:лей|ля|ль)?\.?\b/gi,
            "₽"
        )
        .replace(/\s*р\.\s*$/i, " ₽")
        .replace(/\s+/g, " ")
        .trim();
}


function formatNumber(value) {

    return Number(value || 0)
        .toLocaleString("ru-RU");
}


function formatFileSize(bytes) {

    if (!bytes) {
        return "0 Б";
    }


    if (bytes < 1024) {
        return `${bytes} Б`;
    }


    if (bytes < 1024 * 1024) {

        return `${(
            bytes / 1024
        ).toFixed(1)} КБ`;
    }


    return `${(
        bytes / (1024 * 1024)
    ).toFixed(1)} МБ`;
}


function plural(
    number,
    one,
    few,
    many
) {

    const n =
        Math.abs(Number(number)) % 100;

    const n1 =
        n % 10;


    if (n > 10 && n < 20) {
        return many;
    }


    if (n1 > 1 && n1 < 5) {
        return few;
    }


    if (n1 === 1) {
        return one;
    }


    return many;
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}