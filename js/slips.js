document.addEventListener('DOMContentLoaded', () => {
    const APP_URL = window.location.origin;

    // Supabase Configuration
    const SUPABASE_URL = 'https://pjbcoagmqiimadfzupmc.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_CLyMUTRwiH_jdwJzHJ-AAg_y_OedlRh';
    const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

    // --- IndexedDB Local Storage Logic ---
    const DB_NAME = 'BitTransferDB';
    const DB_VERSION = 1;
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

    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const resultContainer = document.getElementById('result-container');
    const collageCanvas = document.getElementById('collage-canvas');
    const downloadBtn = document.getElementById('download-btn');
    
    const featureSelector = document.getElementById('feature-selector');
    const configureMaskBtn = document.getElementById('configure-mask-btn');
    const maskConfigContainer = document.getElementById('mask-config-container');
    
    const libraryContainer = document.getElementById('library-container');

    const uploadFinalBtn = document.getElementById('upload-final-btn');
    const finalTemplateInput = document.getElementById('final-template-input');

    const maskAllBtn = document.getElementById('mask-all-btn');
    const saveAsTemplateBtn = document.getElementById('save-as-template-btn');
    const copyRefBtn = document.getElementById('copy-ref-btn');
    const downloadRefBtn = document.getElementById('download-ref-btn');
    const imageDims = document.getElementById('image-dims');
    const editorModeText = document.getElementById('editor-mode-text');
    const editorSubtext = document.getElementById('editor-subtext');

    const maskCanvas = document.getElementById('mask-canvas');
    const clearMasksBtn = document.getElementById('clear-masks-btn');
    const saveMasksBtn = document.getElementById('save-masks-btn');
    const cancelMaskBtn = document.getElementById('cancel-mask-btn');

    const emptyState = document.getElementById('empty-state');
    
    let currentMode = 'template'; // 'mask' or 'template'
    let imagesData = []; // Store image objects: { id, file, originalImg, imgElement }
    let refImage = null; // Always the first slip for session
    let overlays = [];
    let tempOverlays = [];
    let isDrawingMask = false;
    let startX = 0, startY = 0, currentX = 0, currentY = 0;
    let isEditingReference = false;
    let referenceToEdit = null;
    
    // Multi-template system
    let templates = [];
    let selectedTemplateIndex = -1;

    // Load templates from Supabase AND Local Storage
    const loadAllTemplates = async () => {
        let allTemplates = [];

        // 1. Load Local Templates
        try {
            const localData = await getLocalTemplates();
            if (localData && localData.length > 0) {
                const processedLocal = await Promise.all(localData.map(async (item) => {
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => resolve({ image: img, name: item.name, id: item.id, isLocal: true });
                        img.onerror = () => resolve(null);
                        img.src = item.image_data; // This is a data URL or Blob
                    });
                }));
                allTemplates = [...allTemplates, ...processedLocal.filter(t => t !== null)];
            }
        } catch (err) {
            console.error('Error loading local templates:', err);
        }

        // 2. Load Cloud Templates
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('templates')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                if (data && data.length > 0) {
                    const cloudTemplates = await Promise.all(data.map(async (item) => {
                        // Avoid duplicates if already in local (by name or ID if shared)
                        if (allTemplates.some(t => t.id === item.id)) return null;

                        return new Promise((resolve) => {
                            const img = new Image();
                            img.crossOrigin = "anonymous";
                            img.onload = () => resolve({ image: img, name: item.name, id: item.id, isLocal: false });
                            img.onerror = () => resolve(null);
                            img.src = item.image_url;
                        });
                    }));
                    allTemplates = [...allTemplates, ...cloudTemplates.filter(t => t !== null)];
                }
            } catch (err) {
                console.error('Error loading cloud templates:', err);
                showToast('Failed to load cloud templates.');
            }
        }

        templates = allTemplates;
        if (selectedTemplateIndex === -1 && templates.length > 0) {
            selectedTemplateIndex = 0;
        }
        renderLibrary();
    };

    // Load initial template
    const initDefaultTemplate = () => {
        const img = new Image();
        img.onload = () => {
            // Only add default if library is empty
            if (templates.length === 0) {
                templates.push({ image: img, name: 'Default', isLocal: true });
                selectedTemplateIndex = 0;
                renderLibrary();
            }
            loadAllTemplates(); // Load local + cloud after default
        };
        img.src = 'img/template.png';
    };
    initDefaultTemplate();

    const uploadToSupabase = async (blob, name, dimensions) => {
        if (!supabase) {
            showToast('Supabase not initialized.');
            return null;
        }

        try {
            const fileName = `${Date.now()}-${name.replace(/\s+/g, '-').toLowerCase()}.png`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('template-images')
                .upload(fileName, blob, { contentType: 'image/png' });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('template-images')
                .getPublicUrl(fileName);

            const { data: dbData, error: dbError } = await supabase
                .from('templates')
                .insert([{
                    name: name,
                    image_url: urlData.publicUrl,
                    dimensions: dimensions
                }])
                .select();

            if (dbError) throw dbError;
            return { image_url: urlData.publicUrl, id: dbData[0].id };
        } catch (err) {
            console.error('Supabase error:', err);
            showToast(`Upload failed: ${err.message}`);
            return null;
        }
    };

    // Load saved masks
    const savedMasks = localStorage.getItem('saved_slip_masks');
    if (savedMasks) {
        try { overlays = JSON.parse(savedMasks); } catch(e) { overlays = []; }
    }

    // --- Toolbar Actions ---
    if (featureSelector) {
        featureSelector.addEventListener('change', (e) => {
            currentMode = e.target.value;
            toggleModeUI();
            // Re-process all images when mode changes
            if (imagesData.length > 0) {
                imagesData.forEach(data => processImageFile(data.file, data.id));
            }
        });
    }

    function toggleModeUI() {
        if (currentMode === 'template') {
            uploadFinalBtn.classList.remove('hidden');
            libraryContainer.classList.remove('hidden');
        } else {
            uploadFinalBtn.classList.add('hidden');
            libraryContainer.classList.add('hidden');
        }
    }

    // Initial UI Setup
    toggleModeUI();

    function renderLibrary() {
        if (!libraryContainer) return;
        libraryContainer.innerHTML = '';
        templates.forEach((t, idx) => {
            const item = document.createElement('div');
            item.className = `library-item ${idx === selectedTemplateIndex ? 'active' : ''}`;
            item.title = t.name;
            item.innerHTML = `
                <img src="${t.image.src}" alt="${t.name}">
                <div class="template-label">${t.name}</div>
                ${t.isLocal ? '<div class="local-badge"><i class="fas fa-hdd"></i></div>' : '<div class="cloud-badge"><i class="fas fa-cloud"></i></div>'}
            `;
            item.onclick = () => {
                selectedTemplateIndex = idx;
                renderLibrary();
                if (imagesData.length > 0) {
                    imagesData.forEach(d => processImageFile(d.file, d.id));
                }
                showToast(`Template "${t.name}" selected`);
            };
            libraryContainer.appendChild(item);
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

                    if (selectedTemplateIndex >= 0 && templates[selectedTemplateIndex]) {
                        useTemplate(templates[selectedTemplateIndex].image);
                    } else {
                        // Fallback or wait for template
                        showToast('Please select or add a template first.');
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

            if (!refImage) { alert('Upload an image first to mark areas.'); return; }
            openConfigurator();
        });
    }

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

                        // 1. Save Locally (Instant)
                        showToast('Saving to browser storage...');
                        await saveLocalTemplate({
                            id: templateId,
                            name: name,
                            image_data: event.target.result,
                            created_at: new Date().toISOString()
                        });

                        // 2. Add to UI immediately
                        templates.unshift({ image: img, name: name, id: templateId, isLocal: true });
                        selectedTemplateIndex = 0;
                        renderLibrary();
                        if (imagesData.length > 0) {
                            imagesData.forEach(d => processImageFile(d.file, d.id));
                        }
                        
                        // 3. Try Supabase (Background)
                        if (supabase) {
                            const response = await fetch(event.target.result);
                            const blob = await response.blob();
                            const cloudRes = await uploadToSupabase(blob, name, { w: img.width, h: img.height });
                            if (cloudRes) {
                                showToast(`"${name}" also synced to cloud!`);
                            }
                        }
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
            finalTemplateInput.value = '';
        });
    }

    if (maskAllBtn) {
        maskAllBtn.addEventListener('click', () => {
            const img = isEditingReference ? referenceToEdit : refImage;
            if (!img) return;
            tempOverlays = [{ x: 0, y: 0, w: img.width, h: img.height }];
            redrawMaskCanvas();
        });
    }


    function openConfigurator(img = null, forReference = false) {
        isEditingReference = forReference;
        if (forReference && img) referenceToEdit = img;
        const targetImg = isEditingReference ? referenceToEdit : refImage;
        
        if (!targetImg) { alert('No image to configure.'); return; }
        
        tempOverlays = forReference ? [] : [...overlays];
        
        // Update UI for mode
        if (forReference) {
            editorModeText.textContent = 'Prepare Reference Template';
            editorSubtext.textContent = 'Mask areas you want to hide in the template';
        } else {
            editorModeText.textContent = 'Mark Areas to Cover';
            editorSubtext.textContent = 'Drag on image to mark areas for white boxes';
        }

        copyRefBtn.classList.add('hidden');
        downloadRefBtn.classList.add('hidden');
        
        maskAllBtn.classList.remove('hidden');

        const maskAllSpan = maskAllBtn.querySelector('span');
        if (maskAllSpan) maskAllSpan.textContent = `Mask Full (${targetImg.width}x${targetImg.height})`;

        maskConfigContainer.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        if (emptyState) emptyState.classList.add('hidden');
        
        // Set dims
        if (imageDims) imageDims.textContent = `${targetImg.width} × ${targetImg.height} px`;
        
        redrawMaskCanvas();
        maskConfigContainer.scrollIntoView({ behavior: 'smooth' });
    }

    if (cancelMaskBtn) cancelMaskBtn.addEventListener('click', () => { 
        maskConfigContainer.classList.add('hidden'); 
        isEditingReference = false;
        renderPreviews(); 
    });

    function redrawMaskCanvas() {
        const img = isEditingReference ? referenceToEdit : refImage;
        if (!img) return;
        
        const scale = (maskConfigContainer.offsetWidth - 60) / img.width;
        maskCanvas.width = img.width * scale;
        maskCanvas.height = img.height * scale;
        maskCanvas.dataset.scale = scale;
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskCtx.drawImage(img, 0, 0, maskCanvas.width, maskCanvas.height);
        
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

    maskCanvas.addEventListener('mousedown', (e) => { 
        const img = isEditingReference ? referenceToEdit : refImage;
        if (!img) return; 
        const p = getMousePos(e); 
        startX = p.x; startY = p.y; 
        currentX = p.x; currentY = p.y;
        isDrawingMask = true; 
    });
    maskCanvas.addEventListener('mousemove', (e) => { 
        if (!isDrawingMask) return; 
        const p = getMousePos(e); 
        currentX = p.x; currentY = p.y; 
        redrawMaskCanvas(); 
    });
    window.addEventListener('mouseup', () => {
        if (!isDrawingMask) return;
        isDrawingMask = false;
        const w = currentX - startX, h = currentY - startY;
        if (Math.abs(w) > 5 && Math.abs(h) > 5) {
            tempOverlays.push({ x: Math.round(w < 0 ? currentX : startX), y: Math.round(h < 0 ? currentY : startY), w: Math.round(Math.abs(w)), h: Math.round(Math.abs(h)) });
        }
        redrawMaskCanvas();
    });

    maskCanvas.addEventListener('touchstart', (e) => { 
        if (e.target === maskCanvas) e.preventDefault(); 
        const img = (isEditingReference ? referenceToEdit : refImage); 
        if(!img) return; 
        const p = getMousePos(e); 
        startX = p.x; startY = p.y; 
        currentX = p.x; currentY = p.y;
        isDrawingMask = true; 
    }, {passive: false});
    maskCanvas.addEventListener('touchmove', (e) => { if (isDrawingMask) { if (e.target === maskCanvas) e.preventDefault(); const p = getMousePos(e); currentX = p.x; currentY = p.y; redrawMaskCanvas(); } }, {passive: false});
    window.addEventListener('touchend', () => { if (isDrawingMask) { isDrawingMask = false; redrawMaskCanvas(); } });

    clearMasksBtn.addEventListener('click', () => { tempOverlays = []; redrawMaskCanvas(); });
    
    saveMasksBtn.addEventListener('click', () => {
        if (isEditingReference) {
            // Apply masks to reference image to create the template
            const canvas = document.createElement('canvas');
            canvas.width = referenceToEdit.width; canvas.height = referenceToEdit.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(referenceToEdit, 0, 0);
            ctx.fillStyle = '#ffffff';
            tempOverlays.forEach(o => ctx.fillRect(o.x, o.y, o.w, o.h));
            
            const resultImg = new Image();
            resultImg.onload = async () => {
                const name = prompt('Enter a name for this template:', `Template ${templates.length + 1}`) || `Template ${templates.length + 1}`;
                const templateId = 'local-' + Date.now();
                const dataUrl = canvas.toDataURL('image/png');

                // 1. Save Locally
                showToast('Saving locally...');
                await saveLocalTemplate({
                    id: templateId,
                    name: name,
                    image_data: dataUrl,
                    created_at: new Date().toISOString()
                });

                // 2. Update UI
                templates.unshift({ image: resultImg, name: name, id: templateId, isLocal: true });
                selectedTemplateIndex = 0;
                renderLibrary();
                
                if (imagesData.length > 0) {
                    imagesData.forEach(d => processImageFile(d.file, d.id));
                }

                // 3. Try Cloud Sync
                if (supabase) {
                    canvas.toBlob(async (blob) => {
                        const cloudRes = await uploadToSupabase(blob, name, { w: resultImg.width, h: resultImg.height });
                        if (cloudRes) showToast(`"${name}" saved & synced!`);
                    }, 'image/png');
                }

                // Show download/copy buttons for the prepared reference
                copyRefBtn.classList.remove('hidden');
                downloadRefBtn.classList.remove('hidden');
                // ... (rest of the download/copy logic remains same)
                downloadRefBtn.onclick = () => {
                    const link = document.createElement('a');
                    link.download = `${name.replace(/\s+/g, '-').toLowerCase()}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                };
                
                copyRefBtn.onclick = async () => {
                    canvas.toBlob(async (blob) => {
                        try {
                            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                            showToast('Template copied! Now upload back in Step 2.');
                        } catch (err) { showToast('Copy failed.'); }
                    });
                };
            };
            resultImg.src = canvas.toDataURL('image/png');
            
            showToast('Template ready for download.');
        } else {
            overlays = [...tempOverlays];
            localStorage.setItem('saved_slip_masks', JSON.stringify(overlays));
            
            // Generate preview for current slip
            const canvas = document.createElement('canvas');
            canvas.width = refImage.width; canvas.height = refImage.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(refImage, 0, 0);
            ctx.fillStyle = '#ffffff';
            overlays.forEach(o => ctx.fillRect(o.x, o.y, o.w, o.h));
            
            // Show download/copy buttons for the masked slip
            copyRefBtn.classList.remove('hidden');
            downloadRefBtn.classList.remove('hidden');
            
            downloadRefBtn.onclick = () => {
                const link = document.createElement('a');
                link.download = 'masked-slip.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            
            copyRefBtn.onclick = async () => {
                canvas.toBlob(async (blob) => {
                    try {
                        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                        showToast('Masked image copied!');
                    } catch (err) { showToast('Copy failed.'); }
                });
            };

            if (imagesData.length > 0) imagesData.forEach(d => processImageFile(d.file, d.id));
            showToast('Configuration applied to all slips! You can also download this preview.');
        }
    });

    function showToast(m) {
        let t = document.querySelector('.toast') || document.createElement('div');
        t.className = 'toast'; t.innerHTML = `<i class="fas fa-check-circle"></i> ${m}`;
        if (!t.parentElement) document.body.appendChild(t);
        t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000);
    }
});
