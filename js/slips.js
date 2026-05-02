document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const resultContainer = document.getElementById('result-container');
    const collageCanvas = document.getElementById('collage-canvas');
    const downloadBtn = document.getElementById('download-btn');
    
    const featureSelector = document.getElementById('feature-selector');
    const configureMaskBtn = document.getElementById('configure-mask-btn');
    const maskConfigContainer = document.getElementById('mask-config-container');
    const maskCanvas = document.getElementById('mask-canvas');
    const clearMasksBtn = document.getElementById('clear-masks-btn');
    const saveMasksBtn = document.getElementById('save-masks-btn');
    const cancelMaskBtn = document.getElementById('cancel-mask-btn');

    const emptyState = document.getElementById('empty-state');
    
    let currentMode = 'mask'; // 'mask' or 'template'
    let imagesData = []; // Store image objects: { id, file, originalImg, imgElement }
    let refImage = null; // Always the first slip for session
    let overlays = [];
    let tempOverlays = [];
    let isDrawingMask = false;
    let startX = 0, startY = 0, currentX = 0, currentY = 0;
    
    // Shared template image object
    let fixedTemplateImg = null;

    // Load saved masks
    const savedMasks = localStorage.getItem('saved_slip_masks');
    if (savedMasks) {
        try { overlays = JSON.parse(savedMasks); } catch(e) { overlays = []; }
    }

    // --- Toolbar Actions ---
    if (featureSelector) {
        featureSelector.addEventListener('change', (e) => {
            currentMode = e.target.value;
            // Re-process all images when mode changes
            if (imagesData.length > 0) {
                imagesData.forEach(data => processImageFile(data.file, data.id));
            }
        });
    }

    // --- File Handling ---
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-active'); });
    dropzone.addEventListener('dragleave', (e) => { e.preventDefault(); dropzone.classList.remove('drag-active'); });
    dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('drag-active'); handleFiles(e.dataTransfer.files); });

    fileInput.addEventListener('change', (e) => { handleFiles(e.target.files); fileInput.value = ''; });

    document.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                handleFiles([item.getAsFile()]);
            }
        }
    });

    const mobilePasteBtn = document.getElementById('mobile-paste-btn');
    if (mobilePasteBtn) {
        mobilePasteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const clipboardItems = await navigator.clipboard.read();
                for (const item of clipboardItems) {
                    for (const type of item.types) {
                        if (type.startsWith('image/')) {
                            const blob = await item.getType(type);
                            handleFiles([blob]);
                            return;
                        }
                    }
                }
                alert('No image found in clipboard.');
            } catch (err) { alert('Could not access clipboard. Please use Browse button.'); }
        });
    }

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) processImageFile(file);
        });
    }

    function processImageFile(file, existingId = null) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const originalImg = new Image();
            originalImg.onload = () => {
                // Set first slip as reference for the whole session
                if (!refImage && !existingId) refImage = originalImg;

                if (currentMode === 'template') {
                    // --- MODE: CUSTOM TEMPLATE ---
                    const useTemplate = (tImg) => {
                        const canvas = document.createElement('canvas');
                        canvas.width = tImg.width; canvas.height = tImg.height;
                        const ctx = canvas.getContext('2d');
                        
                        // 1. Draw Template Base
                        ctx.drawImage(tImg, 0, 0);

                        // 2. Harvest areas from SLIP and place on TEMPLATE
                        // Ratios to match coordinates if sizes differ
                        const ratioX = tImg.width / originalImg.width;
                        const ratioY = tImg.height / originalImg.height;

                        overlays.forEach(o => {
                            ctx.drawImage(
                                originalImg, 
                                o.x, o.y, o.w, o.h, // Source (Slip)
                                o.x * ratioX, o.y * ratioY, o.w * ratioX, o.h * ratioY // Destination (Template)
                            );
                        });
                        finishProcessing(canvas, file, originalImg, existingId);
                    };

                    if (fixedTemplateImg) useTemplate(fixedTemplateImg);
                    else {
                        const img = new Image();
                        img.onload = () => { fixedTemplateImg = img; useTemplate(img); };
                        img.src = 'img/template.png';
                    }
                } else {
                    // --- MODE: WATERMARK REMOVAL ---
                    const canvas = document.createElement('canvas');
                    canvas.width = originalImg.width; canvas.height = originalImg.height;
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
                imagesData.push({ id: Date.now() + Math.random().toString(36).substr(2, 9), file, originalImg, imgElement: editedImg });
            }
            renderPreviews();
        };
        editedImg.src = canvas.toDataURL('image/png');
    }

    function renderPreviews() {
        if (imagesData.length > 0) {
            if (emptyState) emptyState.classList.add('hidden');
            if (maskConfigContainer.classList.contains('hidden')) resultContainer.classList.remove('hidden');
            generateCollage(true);
        } else {
            if (emptyState) emptyState.classList.remove('hidden');
            resultContainer.classList.add('hidden');
        }
    }

    clearAllBtn.addEventListener('click', () => {
        imagesData = []; refImage = null;
        maskConfigContainer.classList.add('hidden');
        renderPreviews();
    });

    function generateCollage(isAuto = false) {
        if (imagesData.length === 0) return;
        const ctx = collageCanvas.getContext('2d');
        let maxWidth = 0;
        imagesData.forEach(d => { if (d.imgElement.width > maxWidth) maxWidth = d.imgElement.width; });
        const cellWidth = Math.min(maxWidth, 1500);
        const scaledHeights = imagesData.map(d => (cellWidth / d.imgElement.width) * d.imgElement.height);

        const N = imagesData.length;
        let cols = (N === 1) ? 1 : (N <= 3) ? N : (N === 4) ? 2 : 3;
        if (N > 9) cols = Math.ceil(Math.sqrt(N));

        let totalH = 0, rowHeights = [];
        for (let i = 0; i < N; i += cols) {
            let maxH = 0;
            for (let j = 0; j < cols && (i + j) < N; j++) if (scaledHeights[i + j] > maxH) maxH = scaledHeights[i + j];
            totalH += maxH; rowHeights.push(maxH);
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
        downloadBtn.href = collageCanvas.toDataURL('image/png');
    }

    // --- Mask Config Logic ---
    let maskCtx = maskCanvas.getContext('2d');

    if (configureMaskBtn) {
        configureMaskBtn.addEventListener('click', () => {
            // Always use the first slip as the reference for marking areas
            if (!refImage && imagesData.length > 0) refImage = imagesData[0].originalImg;

            if (!refImage) { alert('Upload a slip first to mark areas.'); return; }
            openConfigurator();
        });
    }

    function openConfigurator() {
        tempOverlays = [...overlays];
        maskConfigContainer.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        if (emptyState) emptyState.classList.add('hidden');
        redrawMaskCanvas();
        maskConfigContainer.scrollIntoView({ behavior: 'smooth' });
    }

    if (cancelMaskBtn) cancelMaskBtn.addEventListener('click', () => { maskConfigContainer.classList.add('hidden'); renderPreviews(); });

    function redrawMaskCanvas() {
        if (!refImage) return;
        const scale = (maskConfigContainer.offsetWidth - 60) / refImage.width;
        maskCanvas.width = refImage.width * scale;
        maskCanvas.height = refImage.height * scale;
        maskCanvas.dataset.scale = scale;
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskCtx.drawImage(refImage, 0, 0, maskCanvas.width, maskCanvas.height);
        
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
    }

    function getMousePos(e) {
        const rect = maskCanvas.getBoundingClientRect();
        const scale = parseFloat(maskCanvas.dataset.scale) || 1;
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        return { x: (clientX - rect.left) * (maskCanvas.width / rect.width) / scale, y: (clientY - rect.top) * (maskCanvas.height / rect.height) / scale };
    }

    maskCanvas.addEventListener('mousedown', (e) => { if (!refImage) return; const p = getMousePos(e); startX = p.x; startY = p.y; isDrawingMask = true; });
    maskCanvas.addEventListener('mousemove', (e) => { if (!isDrawingMask) return; const p = getMousePos(e); currentX = p.x; currentY = p.y; redrawMaskCanvas(); });
    window.addEventListener('mouseup', () => {
        if (!isDrawingMask) return;
        isDrawingMask = false;
        const w = currentX - startX, h = currentY - startY;
        if (Math.abs(w) > 5 && Math.abs(h) > 5) {
            tempOverlays.push({ x: Math.round(w < 0 ? currentX : startX), y: Math.round(h < 0 ? currentY : startY), w: Math.round(Math.abs(w)), h: Math.round(Math.abs(h)) });
        }
        redrawMaskCanvas();
    });

    maskCanvas.addEventListener('touchstart', (e) => { if (e.target === maskCanvas) e.preventDefault(); const p = getMousePos(e); startX = p.x; startY = p.y; isDrawingMask = true; }, {passive: false});
    maskCanvas.addEventListener('touchmove', (e) => { if (isDrawingMask) { if (e.target === maskCanvas) e.preventDefault(); const p = getMousePos(e); currentX = p.x; currentY = p.y; redrawMaskCanvas(); } }, {passive: false});
    window.addEventListener('touchend', () => { if (isDrawingMask) { isDrawingMask = false; redrawMaskCanvas(); } });

    clearMasksBtn.addEventListener('click', () => { tempOverlays = []; redrawMaskCanvas(); });
    saveMasksBtn.addEventListener('click', () => {
        overlays = [...tempOverlays];
        localStorage.setItem('saved_slip_masks', JSON.stringify(overlays));
        maskConfigContainer.classList.add('hidden');
        if (imagesData.length > 0) imagesData.forEach(d => processImageFile(d.file, d.id));
        showToast('Configuration applied!');
    });

    function showToast(m) {
        let t = document.querySelector('.toast') || document.createElement('div');
        t.className = 'toast'; t.innerHTML = `<i class="fas fa-check-circle"></i> ${m}`;
        if (!t.parentElement) document.body.appendChild(t);
        t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000);
    }
});
