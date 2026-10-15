document.addEventListener('DOMContentLoaded', () => {
    // --- IndexedDB Local Storage Logic ---
    const DB_NAME = 'BitTransferDB';
    const DB_VERSION = 2;
    const STORE_NAME = 'templates';

    const initDB = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    };

    const saveLocalTemplate = async (template) => {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(template);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    };

    const getLocalTemplates = async () => {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    };

    const deleteLocalTemplate = async (id) => {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    };

    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const resultContainer = document.getElementById('result-container');
    const collageCanvas = document.getElementById('collage-canvas');
    const collageImg = document.getElementById('collage-img');
    const downloadBtn = document.getElementById('download-btn');
    
    const configureMaskBtn = document.getElementById('configure-mask-btn');
    const maskConfigContainer = document.getElementById('mask-config-container');
    
    const dynamicTemplatesContainer = document.getElementById('dynamic-templates-container');
    const modeBtnEraser = document.querySelector('.mode-btn[data-mode="mask"]');

    const configureMaskBtn = document.getElementById('configure-mask-btn');
    const configureBtnLabel = document.getElementById('configure-btn-label');
    const maskConfigContainer = document.getElementById('mask-config-container');

    const dynamicTemplatesContainer = document.getElementById('dynamic-templates-container');
    const modeBtnEraser = document.querySelector('.mode-btn[data-mode="mask"]');

    const uploadFinalBtn = document.getElementById('upload-final-btn');
    const finalTemplateInput = document.getElementById('final-template-input');

    // Editor Step Navigation & Controls
    const studioModeIcon = document.getElementById('studio-mode-icon');
    const templateStepsBar = document.getElementById('template-steps-bar');
    const stepSelectBtn = document.getElementById('step-select-btn');
    const stepArrangeBtn = document.getElementById('step-arrange-btn');

    const editorModeText = document.getElementById('editor-mode-text');
    const editorSubtext = document.getElementById('editor-subtext');
    const imageDims = document.getElementById('image-dims');
    const editorHintText = document.getElementById('editor-hint-text');

    const undoBoxBtn = document.getElementById('undo-box-btn');
    const deleteBoxBtn = document.getElementById('delete-box-btn');
    const backToSlipBtn = document.getElementById('back-to-slip-btn');
    const resetPlacementBtn = document.getElementById('reset-placement-btn');
    const clearMasksBtn = document.getElementById('clear-masks-btn');
    const quickApplyBtn = document.getElementById('quick-apply-btn');
    const goToArrangeBtn = document.getElementById('go-to-arrange-btn');
    const saveMasksBtn = document.getElementById('save-masks-btn');
    const saveMasksLabel = document.getElementById('save-masks-label');
    const cancelMaskBtn = document.getElementById('cancel-mask-btn');

    const maskAllBtn = document.getElementById('mask-all-btn');
    const copyRefBtn = document.getElementById('copy-ref-btn');
    const downloadRefBtn = document.getElementById('download-ref-btn');

    const slipViewport = document.getElementById('slip-viewport');
    const maskCanvas = document.getElementById('mask-canvas');
    let maskCtx = maskCanvas ? maskCanvas.getContext('2d') : null;

    const templateArrangeViewport = document.getElementById('template-arrange-viewport');
    const templateStageWrapper = document.getElementById('template-stage-wrapper');
    const templateArrangeCanvas = document.getElementById('template-arrange-canvas');
    const templateSnippetsOverlay = document.getElementById('template-snippets-overlay');
    let templateArrangeCtx = templateArrangeCanvas ? templateArrangeCanvas.getContext('2d') : null;

    const emptyState = document.getElementById('empty-state');
    const emptyWelcome = document.getElementById('empty-welcome');

    // State Variables
    let currentMode = 'template'; // 'mask' (Eraser) or 'template'
    let currentStep = 1; // 1 = select texts on slip, 2 = arrange on template
    let imagesData = []; // { id, file, originalImg, imgElement }
    let refImage = null; // reference slip for extraction

    // Eraser Mode State (kept 100% as is)
    let overlays = []; // absolute { x, y, w, h }
    let tempOverlays = [];
    const savedMasks = localStorage.getItem('saved_slip_masks');
    if (savedMasks) {
        try { overlays = JSON.parse(savedMasks); } catch (e) { overlays = []; }
    }

    // Template Mode State
    let templates = [];
    let selectedTemplateIndex = 0;
    // Working extractions for active template:
    // array of { id, xPct, yPct, wPct, hPct, destXPct, destYPct, destWPct, destHPct }
    let templateExtractions = [];
    let extractionHistory = []; // For Undo
    let selectedBoxIndex = -1; // Index of box selected for move/resize in Step 1

    // Canvas drawing/interaction states for Step 1
    let isDrawingMask = false;
    let isDraggingBox = false;
    let isResizingBox = false;
    let resizeHandleIndex = -1; // 0: TL, 1: TR, 2: BR, 3: BL
    let dragStartX = 0, dragStartY = 0;
    let boxInitialX = 0, boxInitialY = 0, boxInitialW = 0, boxInitialH = 0;
    let startX = 0, startY = 0, currentX = 0, currentY = 0;

    // --- Built-in Default Extraction Presets ---
    const DEFAULT_PRESETS = [
        {
            xPct: 0.12, yPct: 0.28, wPct: 0.76, hPct: 0.08,
            destXPct: 0.12, destYPct: 0.36, destWPct: 0.76, destHPct: 0.08
        },
        {
            xPct: 0.12, yPct: 0.42, wPct: 0.76, hPct: 0.18,
            destXPct: 0.12, destYPct: 0.50, destWPct: 0.76, destHPct: 0.18
        }
    ];

    // Helper: load extractions for a template
    function getTemplateExtractions(t) {
        if (!t) return [];
        if (t.extractions && Array.isArray(t.extractions) && t.extractions.length > 0) {
            return JSON.parse(JSON.stringify(t.extractions));
        }
        // Check localStorage for built-in templates
        const stored = localStorage.getItem('template_extractions_' + t.id);
        if (stored) {
            try { return JSON.parse(stored); } catch (e) { }
        }
        // Fallback to default preset
        return JSON.parse(JSON.stringify(DEFAULT_PRESETS));
    }

    // Helper: save extractions for a template
    async function persistTemplateExtractions(t, extractions) {
        t.extractions = JSON.parse(JSON.stringify(extractions));
        if (t.isLocal && t.id.startsWith('local-')) {
            try {
                await saveLocalTemplate({
                    id: t.id,
                    name: t.name,
                    image_data: t.image_data || t.image.src,
                    extractions: t.extractions,
                    created_at: t.created_at || new Date().toISOString()
                });
            } catch (e) {
                console.error('Failed to save template to IndexedDB:', e);
            }
        } else {
            localStorage.setItem('template_extractions_' + t.id, JSON.stringify(t.extractions));
        }
    }

    // --- Template Library Initialization ---
    const initDefaultTemplates = async () => {
        const builtIns = [
            { id: 'default', name: 'Classic Card', src: 'img/template.png' },
            { id: 'template11', name: 'Barcode Card', src: 'img/template11.png' }
        ];

        const loadedBuiltIns = await Promise.all(builtIns.map(b => {
            return new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    resolve({
                        id: b.id,
                        name: b.name,
                        image: img,
                        image_data: b.src,
                        isLocal: false,
                        extractions: getTemplateExtractions(b)
                    });
                };
                img.onerror = () => resolve(null);
                img.src = b.src;
            });
        }));

        templates = loadedBuiltIns.filter(t => t !== null);

        // Load custom local templates from IndexedDB
        try {
            const localData = await getLocalTemplates();
            if (localData && localData.length > 0) {
                const processedLocal = await Promise.all(localData.map(item => {
                    return new Promise(resolve => {
                        const img = new Image();
                        img.onload = () => {
                            resolve({
                                id: item.id,
                                name: item.name,
                                image: img,
                                image_data: item.image_data,
                                isLocal: true,
                                extractions: item.extractions || getTemplateExtractions(item)
                            });
                        };
                        img.onerror = () => resolve(null);
                        img.src = item.image_data;
                    });
                }));
                templates = [...templates, ...processedLocal.filter(t => t !== null)];
            }
        } catch (err) {
            console.error('Error loading local templates:', err);
        }

        if (templates.length > 0) {
            selectedTemplateIndex = 0;
            templateExtractions = getTemplateExtractions(templates[0]);
        }

        renderLibrary();
    };

    initDefaultTemplates();

    // Mode Switching
    if (modeBtnEraser) {
        modeBtnEraser.addEventListener('click', () => {
            currentMode = 'mask';
            updateToolbarModeUI();
            renderLibrary();
            if (imagesData.length > 0) {
                imagesData.forEach(data => processImageFile(data.file, data.id));
            }
        });
    }

    function updateToolbarModeUI() {
        if (currentMode === 'mask') {
            if (modeBtnEraser) {
                modeBtnEraser.classList.add('active');
                if (!modeBtnEraser.querySelector('.active-badge')) {
                    const badge = document.createElement('div');
                    badge.className = 'active-badge';
                    badge.innerHTML = '<i class="fas fa-check"></i>';
                    const th = modeBtnEraser.querySelector('.effect-thumbnail');
                    if (th) th.appendChild(badge);
                }
            }
            if (configureBtnLabel) configureBtnLabel.textContent = 'Mark Watermarks';
            if (configureMaskBtn) configureMaskBtn.title = 'Mark watermark areas to erase';
        } else {
            if (modeBtnEraser) {
                modeBtnEraser.classList.remove('active');
                const badge = modeBtnEraser.querySelector('.active-badge');
                if (badge) badge.remove();
            }
            if (configureBtnLabel) configureBtnLabel.textContent = 'Extract Texts';
            if (configureMaskBtn) configureMaskBtn.title = 'Configure text extraction & placement for template';
        }
    }

    function renderLibrary() {
        if (!dynamicTemplatesContainer) return;
        dynamicTemplatesContainer.innerHTML = '';
        updateToolbarModeUI();

        templates.forEach((t, idx) => {
            const item = document.createElement('div');
            const isActive = (currentMode === 'template' && idx === selectedTemplateIndex);
            item.className = `effect-item ${isActive ? 'active' : ''}`;
            item.title = t.name;
            item.innerHTML = `
                <div class="effect-thumbnail">
                    <img src="${t.image.src}" alt="${t.name}">
                    ${isActive ? '<div class="active-badge"><i class="fas fa-check"></i></div>' : ''}
                    ${t.isLocal ? '<div class="local-badge" title="Custom Template"><i class="fas fa-hdd"></i></div>' : ''}
                </div>
                <span class="effect-label">${t.name}</span>
                ${t.isLocal ? '<button class="delete-template-btn" title="Delete Template"><i class="fas fa-times"></i></button>' : ''}
            `;

            // Delete Logic for custom templates
            const deleteBtn = item.querySelector('.delete-template-btn');
            if (deleteBtn) {
                deleteBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Are you sure you want to delete "${t.name}"?`)) return;

                    try {
                        await deleteLocalTemplate(t.id);
                        templates.splice(idx, 1);
                        if (selectedTemplateIndex === idx) {
                            selectedTemplateIndex = templates.length > 0 ? 0 : -1;
                        } else if (selectedTemplateIndex > idx) {
                            selectedTemplateIndex--;
                        }

                        renderLibrary();
                        if (imagesData.length > 0) {
                            imagesData.forEach(d => processImageFile(d.file, d.id));
                        }
                        showToast(`"${t.name}" deleted.`);
                    } catch (err) {
                        console.error('Delete error:', err);
                        showToast('Failed to delete template.');
                    }
                };
            }

            item.onclick = () => {
                currentMode = 'template';
                selectedTemplateIndex = idx;
                templateExtractions = getTemplateExtractions(templates[selectedTemplateIndex]);

                renderLibrary();
                if (imagesData.length > 0) {
                    imagesData.forEach(d => processImageFile(d.file, d.id));
                }
                showToast(`Template "${t.name}" applied`);
            };

            dynamicTemplatesContainer.appendChild(item);
        });
    }

    // --- Upload New Template ---
    if (uploadFinalBtn) {
        uploadFinalBtn.addEventListener('click', () => finalTemplateInput.click());
    }

    if (finalTemplateInput) {
        finalTemplateInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = async () => {
                        const name = prompt('Enter a name for this template:', `Template ${templates.length + 1}`) || `Template ${templates.length + 1}`;
                        const templateId = 'local-' + Date.now();
                        const initialExtractions = JSON.parse(JSON.stringify(DEFAULT_PRESETS));

                        showToast('Saving template to storage...');
                        await saveLocalTemplate({
                            id: templateId,
                            name: name,
                            image_data: event.target.result,
                            extractions: initialExtractions,
                            created_at: new Date().toISOString()
                        });

                        const newT = {
                            id: templateId,
                            name: name,
                            image: img,
                            image_data: event.target.result,
                            isLocal: true,
                            extractions: initialExtractions
                        };

                        templates.push(newT);
                        selectedTemplateIndex = templates.length - 1;
                        currentMode = 'template';
                        templateExtractions = initialExtractions;

                        renderLibrary();
                        if (imagesData.length > 0) {
                            imagesData.forEach(d => processImageFile(d.file, d.id));
                        }
                        showToast(`Template "${name}" added!`);
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
            finalTemplateInput.value = '';
        });
    }

    // --- File Handling & Drag & Drop ---
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-active'); });
    dropzone.addEventListener('dragleave', (e) => { e.preventDefault(); dropzone.classList.remove('drag-active'); });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-active');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        fileInput.value = '';
    });

    document.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                handleFiles([item.getAsFile()]);
            }
        }
    });

    const mobilePasteBtn = document.getElementById('mobile-paste-btn');
    const sessionPasteBtn = document.getElementById('session-paste-btn');

    const handlePasteAction = async (e) => {
        if (e) e.preventDefault();
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                for (const type of item.types) {
                    if (type.startsWith('image/')) {
                        const blob = await item.getType(type);
                        handleFiles([blob]);
                        showToast('Image pasted from clipboard');
                        return;
                    }
                }
            }
            alert('No image found in clipboard.');
        } catch (err) {
            alert('Could not access clipboard. Please use Browse button.');
        }
    };

    if (mobilePasteBtn) mobilePasteBtn.addEventListener('click', handlePasteAction);
    if (sessionPasteBtn) sessionPasteBtn.addEventListener('click', handlePasteAction);

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) processImageFile(file);
        });
    }

    // --- Image Processing (Eraser vs Template) ---
    function processImageFile(file, existingId = null) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const originalImg = new Image();
            originalImg.onload = () => {
                if (!refImage && !existingId) refImage = originalImg;

                if (currentMode === 'template') {
                    // --- MODE: TEMPLATE SMART HARVEST ---
                    const activeT = templates[selectedTemplateIndex] || templates[0];
                    if (!activeT) {
                        showToast('Please select or add a template first.');
                        return;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = activeT.image.width;
                    canvas.height = activeT.image.height;
                    const ctx = canvas.getContext('2d');

                    // 1. Draw Clean Template Background
                    ctx.drawImage(activeT.image, 0, 0, canvas.width, canvas.height);

                    // 2. Extract and Inject Each Text Region Using Proportional Coordinates
                    const currentExtractions = getTemplateExtractions(activeT);

                    if (currentExtractions && currentExtractions.length > 0) {
                        currentExtractions.forEach(ext => {
                            // Normalized source coordinates on ANY incoming slip
                            const srcX = Math.round(ext.xPct * originalImg.width);
                            const srcY = Math.round(ext.yPct * originalImg.height);
                            const srcW = Math.round(ext.wPct * originalImg.width);
                            const srcH = Math.round(ext.hPct * originalImg.height);

                            // Normalized destination coordinates on the template
                            const destX = Math.round(ext.destXPct * canvas.width);
                            const destY = Math.round(ext.destYPct * canvas.height);
                            const destW = Math.round(ext.destWPct * canvas.width);
                            const destH = Math.round(ext.destHPct * canvas.height);

                            if (srcW > 0 && srcH > 0 && destW > 0 && destH > 0) {
                                ctx.drawImage(
                                    originalImg,
                                    srcX, srcY, srcW, srcH,
                                    destX, destY, destW, destH
                                );
                            }
                        });
                    }

                    finishProcessing(canvas, file, originalImg, existingId);
                } else {
                    // --- MODE: ERASER (WATERMARK REMOVAL) ---
                    // Preserved 100% as is
                    const canvas = document.createElement('canvas');
                    canvas.width = originalImg.width;
                    canvas.height = originalImg.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(originalImg, 0, 0);
                    ctx.fillStyle = '#ffffff';
                    overlays.forEach(o => ctx.fillRect(o.x, o.y, o.w, o.h));
                    finishProcessing(canvas, file, originalImg, existingId);
                }
            };
            originalImg.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function finishProcessing(canvas, file, originalImg, existingId) {
        const editedImg = new Image();
        editedImg.onload = () => {
            if (existingId) {
                const index = imagesData.findIndex(d => d.id === existingId);
                if (index !== -1) imagesData[index].imgElement = editedImg;
            } else {
                imagesData.push({
                    id: Date.now() + Math.random().toString(36).substr(2, 9),
                    file,
                    originalImg,
                    imgElement: editedImg
                });
            }
            renderPreviews();
        };
        editedImg.src = canvas.toDataURL('image/png');
    }

    function renderPreviews() {
        const isConfiguring = !maskConfigContainer.classList.contains('hidden');

        if (imagesData.length > 0) {
            if (emptyState) emptyState.classList.add('hidden');
            if (!isConfiguring) {
                resultContainer.classList.remove('hidden');
            } else {
                resultContainer.classList.add('hidden');
            }
            generateCollage(true);
        } else {
            if (emptyWelcome) emptyWelcome.classList.remove('hidden');
            if (emptyState) {
                emptyState.classList.remove('has-content');
                if (!isConfiguring) emptyState.classList.remove('hidden');
                else emptyState.classList.add('hidden');
            }
            resultContainer.classList.add('hidden');
        }
    }

    clearAllBtn.addEventListener('click', () => {
        imagesData = [];
        refImage = null;
        maskConfigContainer.classList.add('hidden');
        renderPreviews();
    });

    // --- Collage Grid Generation ---
    function generateCollage(isAuto = false) {
        if (imagesData.length === 0) return;
        const ctx = collageCanvas.getContext('2d');
        let maxWidth = 0;
        imagesData.forEach(d => {
            if (d.imgElement && d.imgElement.width > maxWidth) maxWidth = d.imgElement.width;
        });

        if (maxWidth === 0) return;
        const cellWidth = Math.min(maxWidth, 1500);
        const scaledHeights = imagesData.map(d => (cellWidth / d.imgElement.width) * d.imgElement.height);

        const N = imagesData.length;
        let cols = (N === 1) ? 1 : (N <= 3) ? N : (N === 4) ? 2 : 3;
        if (N > 9) cols = Math.ceil(Math.sqrt(N));

        let totalH = 0, rowHeights = [];
        for (let i = 0; i < N; i += cols) {
            let maxH = 0;
            for (let j = 0; j < cols && (i + j) < N; j++) {
                if (scaledHeights[i + j] > maxH) maxH = scaledHeights[i + j];
            }
            totalH += maxH;
            rowHeights.push(maxH);
        }

        collageCanvas.width = cols * cellWidth;
        collageCanvas.height = totalH;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, collageCanvas.width, collageCanvas.height);

        let curY = 0, rowIdx = 0;
        for (let i = 0; i < N; i += cols) {
            for (let j = 0; j < cols && (i + j) < N; j++) {
                ctx.drawImage(imagesData[i + j].imgElement, j * cellWidth, curY, cellWidth, scaledHeights[i + j]);
            }
            curY += rowHeights[rowIdx++];
        }

        const dataUrl = collageCanvas.toDataURL('image/png');
        downloadBtn.href = dataUrl;
        if (collageImg) collageImg.src = dataUrl;
    }

    // --- Configurator Opening Logic ---
    if (configureMaskBtn) {
        configureMaskBtn.addEventListener('click', () => {
            if (!refImage && imagesData.length > 0) refImage = imagesData[0].originalImg;
            if (!refImage) {
                alert('Please upload or paste a slip image first to configure.');
                return;
            }
            openConfigurator();
        });
    }

    function openConfigurator() {
        if (!refImage) return;

        maskConfigContainer.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        if (emptyState) emptyState.classList.add('hidden');

        if (currentMode === 'mask') {
            // --- ERASER MODE ---
            if (studioModeIcon) studioModeIcon.className = 'fas fa-eraser';
            templateStepsBar.classList.add('hidden');
            undoBoxBtn.classList.add('hidden');
            deleteBoxBtn.classList.add('hidden');
            backToSlipBtn.classList.add('hidden');
            resetPlacementBtn.classList.add('hidden');
            goToArrangeBtn.classList.add('hidden');
            if (quickApplyBtn) quickApplyBtn.classList.add('hidden');

            maskAllBtn.classList.remove('hidden');
            clearMasksBtn.classList.remove('hidden');
            saveMasksBtn.classList.remove('hidden');
            if (saveMasksLabel) saveMasksLabel.textContent = 'Apply Eraser';

            slipViewport.classList.remove('hidden');
            templateArrangeViewport.classList.add('hidden');

            editorModeText.textContent = 'Watermark Eraser';
            editorSubtext.textContent = 'Drag whiteout boxes over unwanted watermarks or stamps.';
            if (editorHintText) editorHintText.innerHTML = '<strong>Watermark Eraser:</strong> Draw whiteout boxes to cover and hide unwanted watermarks on your slips.';

            tempOverlays = [...overlays];
            if (imageDims) imageDims.textContent = `${refImage.width} × ${refImage.height} px`;
            redrawSlipCanvas();
        } else {
            // --- TEMPLATE EXTRACTION MODE ---
            const activeT = templates[selectedTemplateIndex] || templates[0];
            templateExtractions = getTemplateExtractions(activeT);
            extractionHistory = [JSON.parse(JSON.stringify(templateExtractions))];
            selectedBoxIndex = -1;

            templateStepsBar.classList.remove('hidden');
            setEditorStep(1);
        }

        maskConfigContainer.scrollIntoView({ behavior: 'smooth' });
    }

    function setEditorStep(step) {
        currentStep = step;
        const activeT = templates[selectedTemplateIndex] || templates[0];

        if (step === 1) {
            stepSelectBtn.classList.add('active');
            stepArrangeBtn.classList.remove('active');

            slipViewport.classList.remove('hidden');
            templateArrangeViewport.classList.add('hidden');

            undoBoxBtn.classList.remove('hidden');
            deleteBoxBtn.classList.toggle('hidden', selectedBoxIndex < 0);
            backToSlipBtn.classList.add('hidden');
            resetPlacementBtn.classList.add('hidden');
            clearMasksBtn.classList.remove('hidden');
            goToArrangeBtn.classList.remove('hidden');
            if (quickApplyBtn) quickApplyBtn.classList.remove('hidden');
            saveMasksBtn.classList.add('hidden');
            maskAllBtn.classList.add('hidden');

            if (studioModeIcon) studioModeIcon.className = 'fas fa-vector-square';
            editorModeText.textContent = `Extract Texts for "${activeT.name}"`;
            editorSubtext.textContent = 'Step 1: Draw boxes over each text block you want to extract from the slip.';
            if (imageDims) imageDims.textContent = `${refImage.width} × ${refImage.height} px`;
            if (editorHintText) editorHintText.innerHTML = '<strong>Proportional Extraction:</strong> Boxes automatically scale and adapt to ANY slip resolution or size you paste!';

            redrawSlipCanvas();
        } else {
            stepSelectBtn.classList.remove('active');
            stepArrangeBtn.classList.add('active');

            slipViewport.classList.add('hidden');
            templateArrangeViewport.classList.remove('hidden');

            undoBoxBtn.classList.add('hidden');
            deleteBoxBtn.classList.add('hidden');
            backToSlipBtn.classList.remove('hidden');
            resetPlacementBtn.classList.remove('hidden');
            clearMasksBtn.classList.add('hidden');
            goToArrangeBtn.classList.add('hidden');
            if (quickApplyBtn) quickApplyBtn.classList.add('hidden');
            maskAllBtn.classList.add('hidden');
            saveMasksBtn.classList.remove('hidden');
            if (saveMasksLabel) saveMasksLabel.textContent = 'Save & Apply Template';

            if (studioModeIcon) studioModeIcon.className = 'fas fa-object-ungroup';
            editorModeText.textContent = `Position Texts on "${activeT.name}"`;
            editorSubtext.textContent = 'Step 2: Drag snippet boxes to place them on your template. Resize corner handles to fit.';
            if (imageDims) imageDims.textContent = `Template: ${activeT.image.width} × ${activeT.image.height} px`;
            if (editorHintText) editorHintText.innerHTML = '<strong>Live Positioning:</strong> Drag snippet boxes to align on template. Drag bottom-right corner handles to resize.';

            renderTemplateArrangement();
        }
    }

    if (stepSelectBtn) stepSelectBtn.addEventListener('click', () => setEditorStep(1));
    if (stepArrangeBtn) stepArrangeBtn.addEventListener('click', () => setEditorStep(2));
    if (goToArrangeBtn) goToArrangeBtn.addEventListener('click', () => setEditorStep(2));
    if (backToSlipBtn) backToSlipBtn.addEventListener('click', () => setEditorStep(1));

    if (quickApplyBtn) {
        quickApplyBtn.addEventListener('click', async () => {
            const activeT = templates[selectedTemplateIndex] || templates[0];
            if (activeT) {
                await persistTemplateExtractions(activeT, templateExtractions);
            }
            if (imagesData.length > 0) {
                imagesData.forEach(d => processImageFile(d.file, d.id));
            }
            showToast(`Template "${activeT.name}" applied directly!`);
            maskConfigContainer.classList.add('hidden');
            renderPreviews();
        });
    }

    if (resetPlacementBtn) {
        resetPlacementBtn.addEventListener('click', () => {
            templateExtractions.forEach(ext => {
                ext.destXPct = ext.xPct;
                ext.destYPct = ext.yPct;
                ext.destWPct = ext.wPct;
                ext.destHPct = ext.hPct;
            });
            renderTemplateArrangement();
            showToast('Reset snippets to default proportional alignment.');
        });
    }

    if (cancelMaskBtn) {
        cancelMaskBtn.addEventListener('click', () => {
            maskConfigContainer.classList.add('hidden');
            renderPreviews();
        });
    }

    // --- Step 1: Canvas Drawing & Box Interaction on Slip ---
    function redrawSlipCanvas() {
        if (!refImage || !maskCtx) return;

        const containerWidth = maskConfigContainer.offsetWidth - 40;
        const scale = Math.min(1, containerWidth / refImage.width);

        maskCanvas.width = refImage.width * scale;
        maskCanvas.height = refImage.height * scale;
        maskCanvas.dataset.scale = scale;

        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskCtx.drawImage(refImage, 0, 0, maskCanvas.width, maskCanvas.height);

        if (currentMode === 'mask') {
            // ERASER MODE: Red boxes
            maskCtx.fillStyle = 'rgba(239, 68, 68, 0.4)';
            maskCtx.strokeStyle = '#ef4444';
            maskCtx.lineWidth = 2;
            tempOverlays.forEach(o => {
                maskCtx.fillRect(o.x * scale, o.y * scale, o.w * scale, o.h * scale);
                maskCtx.strokeRect(o.x * scale, o.y * scale, o.w * scale, o.h * scale);
            });

            if (isDrawingMask) {
                const w = currentX - startX, h = currentY - startY;
                maskCtx.fillStyle = 'rgba(59, 130, 246, 0.4)';
                maskCtx.strokeStyle = '#3b82f6';
                maskCtx.fillRect(startX * scale, startY * scale, w * scale, h * scale);
                maskCtx.strokeRect(startX * scale, startY * scale, w * scale, h * scale);
            }
        } else {
            // TEMPLATE EXTRACTION MODE: Indigo boxes with numbered pills & handles
            templateExtractions.forEach((ext, i) => {
                const bx = ext.xPct * refImage.width * scale;
                const by = ext.yPct * refImage.height * scale;
                const bw = ext.wPct * refImage.width * scale;
                const bh = ext.hPct * refImage.height * scale;

                const isSelected = (i === selectedBoxIndex);

                // Box Fill
                maskCtx.fillStyle = isSelected ? 'rgba(99, 102, 241, 0.35)' : 'rgba(99, 102, 241, 0.18)';
                maskCtx.fillRect(bx, by, bw, bh);

                // Box Border
                maskCtx.lineWidth = isSelected ? 2.5 : 1.5;
                maskCtx.strokeStyle = isSelected ? '#4338ca' : '#6366f1';
                maskCtx.strokeRect(bx, by, bw, bh);

                // Corner Handles if selected
                if (isSelected) {
                    maskCtx.fillStyle = '#ffffff';
                    maskCtx.strokeStyle = '#4338ca';
                    maskCtx.lineWidth = 2;
                    const hs = 7;
                    const handles = [
                        { x: bx - hs / 2, y: by - hs / 2 },
                        { x: bx + bw - hs / 2, y: by - hs / 2 },
                        { x: bx + bw - hs / 2, y: by + bh - hs / 2 },
                        { x: bx - hs / 2, y: by + bh - hs / 2 }
                    ];
                    handles.forEach(h => {
                        maskCtx.fillRect(h.x, h.y, hs, hs);
                        maskCtx.strokeRect(h.x, h.y, hs, hs);
                    });
                }

                // Numbered Badge (#1, #2, ...)
                const badgeText = `#${i + 1}`;
                maskCtx.font = 'bold 11px sans-serif';
                const textWidth = maskCtx.measureText(badgeText).width;
                const badgeW = textWidth + 10;
                const badgeH = 18;
                const badgeX = bx;
                const badgeY = Math.max(0, by - badgeH);

                maskCtx.fillStyle = isSelected ? '#4338ca' : '#6366f1';
                maskCtx.beginPath();
                maskCtx.roundRect(badgeX, badgeY, badgeW, badgeH, [4, 4, 0, 0]);
                maskCtx.fill();

                maskCtx.fillStyle = '#ffffff';
                maskCtx.textAlign = 'center';
                maskCtx.textBaseline = 'middle';
                maskCtx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);
            });

            // Currently dragging new box
            if (isDrawingMask) {
                const rx = Math.min(startX, currentX) * scale;
                const ry = Math.min(startY, currentY) * scale;
                const rw = Math.abs(currentX - startX) * scale;
                const rh = Math.abs(currentY - startY) * scale;

                maskCtx.fillStyle = 'rgba(59, 130, 246, 0.3)';
                maskCtx.strokeStyle = '#3b82f6';
                maskCtx.lineWidth = 2;
                maskCtx.fillRect(rx, ry, rw, rh);
                maskCtx.strokeRect(rx, ry, rw, rh);
            }
        }
    }

    function getMousePosSlip(e) {
        const rect = maskCanvas.getBoundingClientRect();
        const scale = parseFloat(maskCanvas.dataset.scale) || 1;
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        return {
            x: ((clientX - rect.left) * (maskCanvas.width / rect.width)) / scale,
            y: ((clientY - rect.top) * (maskCanvas.height / rect.height)) / scale
        };
    }

    function findHandleAtPos(pos) {
        if (selectedBoxIndex < 0 || selectedBoxIndex >= templateExtractions.length) return -1;
        const ext = templateExtractions[selectedBoxIndex];
        const bx = ext.xPct * refImage.width;
        const by = ext.yPct * refImage.height;
        const bw = ext.wPct * refImage.width;
        const bh = ext.hPct * refImage.height;

        const tol = 12 / (parseFloat(maskCanvas.dataset.scale) || 1);
        const corners = [
            { x: bx, y: by },
            { x: bx + bw, y: by },
            { x: bx + bw, y: by + bh },
            { x: bx, y: by + bh }
        ];

        for (let i = 0; i < corners.length; i++) {
            if (Math.abs(pos.x - corners[i].x) <= tol && Math.abs(pos.y - corners[i].y) <= tol) {
                return i;
            }
        }
        return -1;
    }

    function findBoxAtPos(pos) {
        for (let i = templateExtractions.length - 1; i >= 0; i--) {
            const ext = templateExtractions[i];
            const bx = ext.xPct * refImage.width;
            const by = ext.yPct * refImage.height;
            const bw = ext.wPct * refImage.width;
            const bh = ext.hPct * refImage.height;

            if (pos.x >= bx && pos.x <= bx + bw && pos.y >= by && pos.y <= by + bh) {
                return i;
            }
        }
        return -1;
    }

    function pushExtractionHistory() {
        extractionHistory.push(JSON.parse(JSON.stringify(templateExtractions)));
        if (extractionHistory.length > 20) extractionHistory.shift();
    }

    // Step 1 Events
    maskCanvas.addEventListener('mousedown', (e) => {
        if (!refImage) return;
        const p = getMousePosSlip(e);

        if (currentMode === 'template') {
            const handleIdx = findHandleAtPos(p);
            if (handleIdx !== -1) {
                isResizingBox = true;
                resizeHandleIndex = handleIdx;
                dragStartX = p.x;
                dragStartY = p.y;
                const ext = templateExtractions[selectedBoxIndex];
                boxInitialX = ext.xPct * refImage.width;
                boxInitialY = ext.yPct * refImage.height;
                boxInitialW = ext.wPct * refImage.width;
                boxInitialH = ext.hPct * refImage.height;
                return;
            }

            const boxIdx = findBoxAtPos(p);
            if (boxIdx !== -1) {
                selectedBoxIndex = boxIdx;
                isDraggingBox = true;
                dragStartX = p.x;
                dragStartY = p.y;
                const ext = templateExtractions[selectedBoxIndex];
                boxInitialX = ext.xPct * refImage.width;
                boxInitialY = ext.yPct * refImage.height;
                deleteBoxBtn.classList.remove('hidden');
                redrawSlipCanvas();
                return;
            }

            // Clicked outside: unselect and begin drawing new box
            selectedBoxIndex = -1;
            deleteBoxBtn.classList.add('hidden');
        }

        startX = p.x;
        startY = p.y;
        currentX = p.x;
        currentY = p.y;
        isDrawingMask = true;
        redrawSlipCanvas();
    });

    maskCanvas.addEventListener('mousemove', (e) => {
        const p = getMousePosSlip(e);

        if (currentMode === 'template') {
            if (isResizingBox && selectedBoxIndex !== -1) {
                const dx = p.x - dragStartX;
                const dy = p.y - dragStartY;
                const ext = templateExtractions[selectedBoxIndex];

                let nx = boxInitialX, ny = boxInitialY, nw = boxInitialW, nh = boxInitialH;
                if (resizeHandleIndex === 0) { // TL
                    nx += dx; ny += dy; nw -= dx; nh -= dy;
                } else if (resizeHandleIndex === 1) { // TR
                    ny += dy; nw += dx; nh -= dy;
                } else if (resizeHandleIndex === 2) { // BR
                    nw += dx; nh += dy;
                } else if (resizeHandleIndex === 3) { // BL
                    nx += dx; nw -= dx; nh += dy;
                }

                if (nw > 10 && nh > 10) {
                    ext.xPct = Math.max(0, nx / refImage.width);
                    ext.yPct = Math.max(0, ny / refImage.height);
                    ext.wPct = Math.min(1 - ext.xPct, nw / refImage.width);
                    ext.hPct = Math.min(1 - ext.yPct, nh / refImage.height);
                    redrawSlipCanvas();
                }
                return;
            }

            if (isDraggingBox && selectedBoxIndex !== -1) {
                const dx = p.x - dragStartX;
                const dy = p.y - dragStartY;
                const ext = templateExtractions[selectedBoxIndex];

                let nx = Math.max(0, Math.min(refImage.width - (ext.wPct * refImage.width), boxInitialX + dx));
                let ny = Math.max(0, Math.min(refImage.height - (ext.hPct * refImage.height), boxInitialY + dy));

                ext.xPct = nx / refImage.width;
                ext.yPct = ny / refImage.height;
                redrawSlipCanvas();
                return;
            }
        }

        if (isDrawingMask) {
            currentX = p.x;
            currentY = p.y;
            redrawSlipCanvas();
        }
    });

    function finishSlipCanvasAction() {
        if (isResizingBox || isDraggingBox) {
            isResizingBox = false;
            isDraggingBox = false;
            pushExtractionHistory();
            return;
        }

        if (!isDrawingMask) return;
        isDrawingMask = false;

        const w = currentX - startX;
        const h = currentY - startY;

        if (Math.abs(w) > 8 && Math.abs(h) > 8) {
            const rx = Math.min(startX, currentX);
            const ry = Math.min(startY, currentY);
            const rw = Math.abs(w);
            const rh = Math.abs(h);

            if (currentMode === 'mask') {
                tempOverlays.push({
                    x: Math.round(rx),
                    y: Math.round(ry),
                    w: Math.round(rw),
                    h: Math.round(rh)
                });
            } else {
                pushExtractionHistory();

                const xPct = Math.max(0, Math.min(1, rx / refImage.width));
                const yPct = Math.max(0, Math.min(1, ry / refImage.height));
                const wPct = Math.max(0, Math.min(1 - xPct, rw / refImage.width));
                const hPct = Math.max(0, Math.min(1 - yPct, rh / refImage.height));

                templateExtractions.push({
                    id: Date.now() + Math.random().toString(36).substr(2, 5),
                    xPct,
                    yPct,
                    wPct,
                    hPct,
                    destXPct: xPct,
                    destYPct: yPct,
                    destWPct: wPct,
                    destHPct: hPct
                });

                selectedBoxIndex = templateExtractions.length - 1;
                deleteBoxBtn.classList.remove('hidden');
            }
        }
        redrawSlipCanvas();
    }

    window.addEventListener('mouseup', finishSlipCanvasAction);

    // Touch Support for Slip Canvas
    maskCanvas.addEventListener('touchstart', (e) => {
        if (!refImage) return;
        if (e.target === maskCanvas) e.preventDefault();
        const p = getMousePosSlip(e);

        if (currentMode === 'template') {
            const handleIdx = findHandleAtPos(p);
            if (handleIdx !== -1) {
                isResizingBox = true;
                resizeHandleIndex = handleIdx;
                dragStartX = p.x;
                dragStartY = p.y;
                const ext = templateExtractions[selectedBoxIndex];
                boxInitialX = ext.xPct * refImage.width;
                boxInitialY = ext.yPct * refImage.height;
                boxInitialW = ext.wPct * refImage.width;
                boxInitialH = ext.hPct * refImage.height;
                return;
            }

            const boxIdx = findBoxAtPos(p);
            if (boxIdx !== -1) {
                selectedBoxIndex = boxIdx;
                isDraggingBox = true;
                dragStartX = p.x;
                dragStartY = p.y;
                const ext = templateExtractions[selectedBoxIndex];
                boxInitialX = ext.xPct * refImage.width;
                boxInitialY = ext.yPct * refImage.height;
                deleteBoxBtn.classList.remove('hidden');
                redrawSlipCanvas();
                return;
            }
            selectedBoxIndex = -1;
            deleteBoxBtn.classList.add('hidden');
        }

        startX = p.x; startY = p.y; currentX = p.x; currentY = p.y;
        isDrawingMask = true;
    }, { passive: false });

    maskCanvas.addEventListener('touchmove', (e) => {
        if (!isDrawingMask && !isDraggingBox && !isResizingBox) return;
        if (e.target === maskCanvas) e.preventDefault();
        const p = getMousePosSlip(e);

        if (currentMode === 'template') {
            if (isResizingBox && selectedBoxIndex !== -1) {
                const dx = p.x - dragStartX;
                const dy = p.y - dragStartY;
                const ext = templateExtractions[selectedBoxIndex];
                let nx = boxInitialX, ny = boxInitialY, nw = boxInitialW, nh = boxInitialH;
                if (resizeHandleIndex === 0) { nx += dx; ny += dy; nw -= dx; nh -= dy; }
                else if (resizeHandleIndex === 1) { ny += dy; nw += dx; nh -= dy; }
                else if (resizeHandleIndex === 2) { nw += dx; nh += dy; }
                else if (resizeHandleIndex === 3) { nx += dx; nw -= dx; nh += dy; }

                if (nw > 10 && nh > 10) {
                    ext.xPct = Math.max(0, nx / refImage.width);
                    ext.yPct = Math.max(0, ny / refImage.height);
                    ext.wPct = Math.min(1 - ext.xPct, nw / refImage.width);
                    ext.hPct = Math.min(1 - ext.yPct, nh / refImage.height);
                    redrawSlipCanvas();
                }
                return;
            }

            if (isDraggingBox && selectedBoxIndex !== -1) {
                const dx = p.x - dragStartX;
                const dy = p.y - dragStartY;
                const ext = templateExtractions[selectedBoxIndex];
                let nx = Math.max(0, Math.min(refImage.width - (ext.wPct * refImage.width), boxInitialX + dx));
                let ny = Math.max(0, Math.min(refImage.height - (ext.hPct * refImage.height), boxInitialY + dy));
                ext.xPct = nx / refImage.width;
                ext.yPct = ny / refImage.height;
                redrawSlipCanvas();
                return;
            }
        }

        if (isDrawingMask) {
            currentX = p.x;
            currentY = p.y;
            redrawSlipCanvas();
        }
    }, { passive: false });

    window.addEventListener('touchend', finishSlipCanvasAction);

    // Keyboard support: Delete / Backspace removes selected box
    window.addEventListener('keydown', (e) => {
        if (!maskConfigContainer.classList.contains('hidden') && currentMode === 'template' && currentStep === 1) {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBoxIndex !== -1) {
                e.preventDefault();
                deleteSelectedBox();
            }
        }
    });

    function deleteSelectedBox() {
        if (selectedBoxIndex >= 0 && selectedBoxIndex < templateExtractions.length) {
            pushExtractionHistory();
            templateExtractions.splice(selectedBoxIndex, 1);
            selectedBoxIndex = -1;
            deleteBoxBtn.classList.add('hidden');
            redrawSlipCanvas();
            showToast('Extracted box deleted');
        }
    }

    if (deleteBoxBtn) {
        deleteBoxBtn.addEventListener('click', deleteSelectedBox);
    }

    if (undoBoxBtn) {
        undoBoxBtn.addEventListener('click', () => {
            if (extractionHistory.length > 0) {
                templateExtractions = extractionHistory.pop();
                selectedBoxIndex = -1;
                deleteBoxBtn.classList.add('hidden');
                redrawSlipCanvas();
                showToast('Undo successful');
            } else {
                showToast('Nothing to undo');
            }
        });
    }

    if (clearMasksBtn) {
        clearMasksBtn.addEventListener('click', () => {
            if (currentMode === 'mask') {
                tempOverlays = [];
                redrawSlipCanvas();
            } else {
                pushExtractionHistory();
                templateExtractions = [];
                selectedBoxIndex = -1;
                deleteBoxBtn.classList.add('hidden');
                redrawSlipCanvas();
                showToast('All extraction boxes cleared');
            }
        });
    }

    if (maskAllBtn) {
        maskAllBtn.addEventListener('click', () => {
            if (!refImage) return;
            tempOverlays = [{ x: 0, y: 0, w: refImage.width, h: refImage.height }];
            redrawSlipCanvas();
        });
    }

    // --- Step 2: Interactive Arrangement on Template ---
    function renderTemplateArrangement() {
        const activeT = templates[selectedTemplateIndex] || templates[0];
        if (!activeT || !templateArrangeCanvas) return;

        const containerWidth = maskConfigContainer.offsetWidth - 40;
        const scale = Math.min(1, containerWidth / activeT.image.width);

        const stageWidth = Math.round(activeT.image.width * scale);
        const stageHeight = Math.round(activeT.image.height * scale);

        templateArrangeCanvas.width = stageWidth;
        templateArrangeCanvas.height = stageHeight;
        templateArrangeCtx.clearRect(0, 0, stageWidth, stageHeight);
        templateArrangeCtx.drawImage(activeT.image, 0, 0, stageWidth, stageHeight);

        templateStageWrapper.style.width = stageWidth + 'px';
        templateStageWrapper.style.height = stageHeight + 'px';

        templateSnippetsOverlay.innerHTML = '';

        templateExtractions.forEach((ext, i) => {
            const cropCanvas = document.createElement('canvas');
            const srcX = Math.round(ext.xPct * refImage.width);
            const srcY = Math.round(ext.yPct * refImage.height);
            const srcW = Math.max(1, Math.round(ext.wPct * refImage.width));
            const srcH = Math.max(1, Math.round(ext.hPct * refImage.height));

            cropCanvas.width = srcW;
            cropCanvas.height = srcH;
            const cropCtx = cropCanvas.getContext('2d');
            cropCtx.drawImage(refImage, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

            const snippetBox = document.createElement('div');
            snippetBox.className = 'snippet-box';
            snippetBox.dataset.index = i;

            const boxLeft = Math.round(ext.destXPct * stageWidth);
            const boxTop = Math.round(ext.destYPct * stageHeight);
            const boxWidth = Math.round(ext.destWPct * stageWidth);
            const boxHeight = Math.round(ext.destHPct * stageHeight);

            snippetBox.style.left = boxLeft + 'px';
            snippetBox.style.top = boxTop + 'px';
            snippetBox.style.width = boxWidth + 'px';
            snippetBox.style.height = boxHeight + 'px';

            snippetBox.innerHTML = `
                <div class="snippet-tag">#${i + 1}</div>
                <img src="${cropCanvas.toDataURL('image/png')}" class="snippet-preview-img" alt="Snippet #${i + 1}">
                <div class="snippet-resize-handle"></div>
            `;

            setupSnippetDraggable(snippetBox, ext, stageWidth, stageHeight);
            templateSnippetsOverlay.appendChild(snippetBox);
        });
    }

    function setupSnippetDraggable(boxEl, ext, stageW, stageH) {
        let isMoving = false;
        let isResizing = false;
        let startClientX = 0, startClientY = 0;
        let initLeft = 0, initTop = 0, initW = 0, initH = 0;

        const handle = boxEl.querySelector('.snippet-resize-handle');

        // Mouse Drag to Move
        boxEl.addEventListener('mousedown', (e) => {
            if (e.target === handle) return;
            e.preventDefault();
            isMoving = true;
            startClientX = e.clientX;
            startClientY = e.clientY;
            initLeft = parseFloat(boxEl.style.left) || 0;
            initTop = parseFloat(boxEl.style.top) || 0;

            document.querySelectorAll('.snippet-box').forEach(b => b.classList.remove('active'));
            boxEl.classList.add('active');

            const onMouseMove = (ev) => {
                if (!isMoving) return;
                const dx = ev.clientX - startClientX;
                const dy = ev.clientY - startClientY;

                const curW = parseFloat(boxEl.style.width) || 50;
                const curH = parseFloat(boxEl.style.height) || 30;

                const maxLeft = stageW - curW;
                const maxTop = stageH - curH;

                const newLeft = Math.max(0, Math.min(maxLeft, initLeft + dx));
                const newTop = Math.max(0, Math.min(maxTop, initTop + dy));

                boxEl.style.left = newLeft + 'px';
                boxEl.style.top = newTop + 'px';

                ext.destXPct = newLeft / stageW;
                ext.destYPct = newTop / stageH;
            };

            const onMouseUp = () => {
                isMoving = false;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        // Mouse Drag to Resize
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            isResizing = true;
            startClientX = e.clientX;
            startClientY = e.clientY;
            initW = parseFloat(boxEl.style.width) || 50;
            initH = parseFloat(boxEl.style.height) || 30;

            const onResizeMove = (ev) => {
                if (!isResizing) return;
                const dx = ev.clientX - startClientX;
                const dy = ev.clientY - startClientY;

                const curLeft = parseFloat(boxEl.style.left) || 0;
                const curTop = parseFloat(boxEl.style.top) || 0;

                const maxW = stageW - curLeft;
                const maxH = stageH - curTop;

                const newW = Math.max(20, Math.min(maxW, initW + dx));
                const newH = Math.max(15, Math.min(maxH, initH + dy));

                boxEl.style.width = newW + 'px';
                boxEl.style.height = newH + 'px';

                ext.destWPct = newW / stageW;
                ext.destHPct = newH / stageH;
            };

            const onResizeUp = () => {
                isResizing = false;
                window.removeEventListener('mousemove', onResizeMove);
                window.removeEventListener('mouseup', onResizeUp);
            };

            window.addEventListener('mousemove', onResizeMove);
            window.addEventListener('mouseup', onResizeUp);
        });

        // Touch Support for Snippet Moving & Resizing
        boxEl.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            if (e.target === handle) return;

            isMoving = true;
            startClientX = touch.clientX;
            startClientY = touch.clientY;
            initLeft = parseFloat(boxEl.style.left) || 0;
            initTop = parseFloat(boxEl.style.top) || 0;

            const onTouchMove = (ev) => {
                if (!isMoving || ev.touches.length !== 1) return;
                const t = ev.touches[0];
                const dx = t.clientX - startClientX;
                const dy = t.clientY - startClientY;

                const curW = parseFloat(boxEl.style.width) || 50;
                const curH = parseFloat(boxEl.style.height) || 30;

                const newLeft = Math.max(0, Math.min(stageW - curW, initLeft + dx));
                const newTop = Math.max(0, Math.min(stageH - curH, initTop + dy));

                boxEl.style.left = newLeft + 'px';
                boxEl.style.top = newTop + 'px';

                ext.destXPct = newLeft / stageW;
                ext.destYPct = newTop / stageH;
            };

            const onTouchEnd = () => {
                isMoving = false;
                window.removeEventListener('touchmove', onTouchMove);
                window.removeEventListener('touchend', onTouchEnd);
            };

            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('touchend', onTouchEnd);
        }, { passive: false });

        handle.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            e.stopPropagation();
            const touch = e.touches[0];
            isResizing = true;
            startClientX = touch.clientX;
            startClientY = touch.clientY;
            initW = parseFloat(boxEl.style.width) || 50;
            initH = parseFloat(boxEl.style.height) || 30;

            const onTouchResize = (ev) => {
                if (!isResizing || ev.touches.length !== 1) return;
                const t = ev.touches[0];
                const dx = t.clientX - startClientX;
                const dy = t.clientY - startClientY;

                const curLeft = parseFloat(boxEl.style.left) || 0;
                const curTop = parseFloat(boxEl.style.top) || 0;

                const newW = Math.max(20, Math.min(stageW - curLeft, initW + dx));
                const newH = Math.max(15, Math.min(stageH - curTop, initH + dy));

                boxEl.style.width = newW + 'px';
                boxEl.style.height = newH + 'px';

                ext.destWPct = newW / stageW;
                ext.destHPct = newH / stageH;
            };

            const onTouchResizeEnd = () => {
                isResizing = false;
                window.removeEventListener('touchmove', onTouchResize);
                window.removeEventListener('touchend', onTouchResizeEnd);
            };

            window.addEventListener('touchmove', onTouchResize, { passive: false });
            window.addEventListener('touchend', onTouchResizeEnd);
        }, { passive: false });
    }

    // --- Save Button Handler ---
    if (saveMasksBtn) {
        saveMasksBtn.addEventListener('click', async () => {
            if (currentMode === 'mask') {
                // ERASER MODE: Save whiteout overlays
                overlays = [...tempOverlays];
                localStorage.setItem('saved_slip_masks', JSON.stringify(overlays));

                if (imagesData.length > 0) {
                    imagesData.forEach(d => processImageFile(d.file, d.id));
                }
                showToast('Watermark mask applied! Collage updated.');
            } else {
                // TEMPLATE MODE: Persist extractions & positions for active template
                const activeT = templates[selectedTemplateIndex] || templates[0];
                if (activeT) {
                    await persistTemplateExtractions(activeT, templateExtractions);
                }

                if (imagesData.length > 0) {
                    imagesData.forEach(d => processImageFile(d.file, d.id));
                }
                showToast('Template extraction saved & applied to all slips!');
            }

            maskConfigContainer.classList.add('hidden');
            renderPreviews();
        });
    }

    // --- Toast Notifications ---
    function showToast(message, icon = 'fa-check-circle') {
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
});
