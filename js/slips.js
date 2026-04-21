document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const previewGrid = document.getElementById('preview-grid');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const generateBtn = document.getElementById('generate-btn');
    const resultContainer = document.getElementById('result-container');
    const collageCanvas = document.getElementById('collage-canvas');
    const downloadBtn = document.getElementById('download-btn');

    let imagesData = []; // Store image objects: { id, file, imgElement }

    // Define areas to automatically cover with white boxes globally
    let overlays = [];
    const savedMasks = localStorage.getItem('saved_slip_masks');
    if (savedMasks) {
        try {
            overlays = JSON.parse(savedMasks);
        } catch(e) {
            overlays = [];
        }
    } else {
        overlays = []; // Blank slate by default
    }

    // Drag and Drop Events
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-active');
    });

    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-active');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-active');
        handleFiles(e.dataTransfer.files);
    });

    // File Input Event
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        fileInput.value = ''; // Reset
    });

    // Paste Event (Keyboard/Desktop)
    document.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        handleClipboardItems(items);
    });

    // Mobile Paste Feature
    const mobilePasteBtn = document.getElementById('mobile-paste-btn');

    async function triggerMobilePaste() {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const clipboardItem of clipboardItems) {
                for (const type of clipboardItem.types) {
                    if (type.startsWith('image/')) {
                        const blob = await clipboardItem.getType(type);
                        handleFiles([blob]);
                        return;
                    }
                }
            }
            alert('No image found in clipboard.');
        } catch (err) {
            console.error(err);
            alert('Could not access clipboard directly. Please ensure you allowed permission when prompted, or use the Browse button.');
        }
    }

    if (mobilePasteBtn) {
        mobilePasteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            triggerMobilePaste();
        });
    }

    // Long Press on dropzone triggers paste natively
    let dropzonePressTimer;
    dropzone.addEventListener('touchstart', (e) => {
        dropzonePressTimer = setTimeout(() => {
            triggerMobilePaste();
        }, 800); // 800ms long press
    });
    dropzone.addEventListener('touchend', () => clearTimeout(dropzonePressTimer));
    dropzone.addEventListener('touchmove', () => clearTimeout(dropzonePressTimer));

    function handleClipboardItems(items) {
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                handleFiles([blob]);
            }
        }
    }

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                processImageFile(file);
            }
        });
    }

    function processImageFile(file, existingId = null) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                // Draw original image
                ctx.drawImage(img, 0, 0);

                // Add cover blocks based on configured masks
                ctx.fillStyle = '#ffffff'; 
                overlays.forEach(overlay => {
                    ctx.fillRect(overlay.x, overlay.y, overlay.w, overlay.h);
                });

                const editedImg = new Image();
                editedImg.onload = () => {
                    if (existingId) {
                        // Update existing entry
                        const index = imagesData.findIndex(d => d.id === existingId);
                        if (index !== -1) {
                            imagesData[index].imgElement = editedImg;
                        }
                    } else {
                        // Add new entry
                        const id = Date.now() + Math.random().toString(36).substr(2, 9);
                        imagesData.push({ id, file, imgElement: editedImg });
                    }
                    renderPreviews();
                };
                editedImg.src = canvas.toDataURL(file.type);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function renderPreviews() {
        previewGrid.innerHTML = '';
        imagesData.forEach(data => {
            const div = document.createElement('div');
            div.className = 'preview-item';

            const img = document.createElement('img');
            img.src = data.imgElement.src;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.onclick = () => {
                imagesData = imagesData.filter(d => d.id !== data.id);
                renderPreviews();
                // hide result if images change
                resultContainer.classList.add('hidden');
            };

            div.appendChild(img);
            div.appendChild(removeBtn);
            previewGrid.appendChild(div);
        });

        // hide result if new images added
        resultContainer.classList.add('hidden');
    }

    clearAllBtn.addEventListener('click', () => {
        imagesData = [];
        renderPreviews();
        resultContainer.classList.add('hidden');
    });

    generateBtn.addEventListener('click', () => {
        if (imagesData.length === 0) {
            alert('Please add some images first.');
            return;
        }

        const ctx = collageCanvas.getContext('2d');

        // Find max width to keep all details
        let maxWidth = 0;
        imagesData.forEach(data => {
            if (data.imgElement.width > maxWidth) {
                maxWidth = data.imgElement.width;
            }
        });

        // Cell width - we scale everything to match the widest image (capped at 1500 to avoid crash)
        const cellWidth = Math.min(maxWidth, 1500);

        // Precalculate scaled heights
        const scaledHeights = imagesData.map(data => {
            const scale = cellWidth / data.imgElement.width;
            return data.imgElement.height * scale;
        });

        // Determine layout based on specific user rules
        const N = imagesData.length;
        let bestCols = 1;

        if (N === 1) {
            bestCols = 1;
        } else if (N === 2 || N === 3) {
            bestCols = N; // Side-by-side
        } else if (N === 4) {
            bestCols = 2; // 2x2 grid
        } else if (N === 5 || N === 6) {
            bestCols = 3; // 3x2 grid layout
        } else if (N >= 7 && N <= 9) {
            bestCols = 3; // 3x3 grid layout
        } else {
            // Generalize for more than 9 images
            bestCols = Math.ceil(Math.sqrt(N));
        }

        let bestLayout = {
            totalWidth: bestCols * cellWidth,
            totalHeight: 0,
            rowHeights: []
        };

        // Calculate total rows height
        for (let i = 0; i < N; i += bestCols) {
            let maxH = 0;
            for (let j = 0; j < bestCols && (i + j) < N; j++) {
                if (scaledHeights[i + j] > maxH) maxH = scaledHeights[i + j];
            }
            bestLayout.totalHeight += maxH;
            bestLayout.rowHeights.push(maxH);
        }

        // Apply best layout
        collageCanvas.width = bestLayout.totalWidth;
        collageCanvas.height = bestLayout.totalHeight;

        // Fill background (white looks best for slips so gaps aren't transparent)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, collageCanvas.width, collageCanvas.height);

        // Draw images in the optimal grid
        let currentY = 0;
        let rowIndex = 0;
        for (let i = 0; i < N; i += bestCols) {
            let rowH = bestLayout.rowHeights[rowIndex];
            for (let j = 0; j < bestCols && (i + j) < N; j++) {
                let imgData = imagesData[i + j];
                let currentX = j * cellWidth;

                let sHeight = scaledHeights[i + j];

                // Draw image aligned to the top of its row cell
                ctx.drawImage(imgData.imgElement, currentX, currentY, cellWidth, sHeight);
            }
            currentY += rowH;
            rowIndex++;
        }

        // Show result and setup download
        resultContainer.classList.remove('hidden');
        downloadBtn.href = collageCanvas.toDataURL('image/png');

        // Scroll to result
        resultContainer.scrollIntoView({ behavior: 'smooth' });
    });

    // --- Clipboard & Long Press Features ---

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

    async function copyCanvasToClipboard() {
        try {
            // Check if ClipboardItem is supported (needed for image copy)
            if (!window.ClipboardItem) {
                throw new Error('Your browser does not support copying images to the clipboard.');
            }

            collageCanvas.toBlob(async (blob) => {
                if (!blob) {
                    showToast('Failed to create image', 'fa-exclamation-triangle');
                    return;
                }
                const data = [new ClipboardItem({ [blob.type]: blob })];
                await navigator.clipboard.write(data);
                showToast('Collage copied to clipboard!');
                
                // Add a little visual pulse to the canvas
                collageCanvas.classList.add('copy-pulse');
                setTimeout(() => collageCanvas.classList.remove('copy-pulse'), 500);
            }, 'image/png');
        } catch (err) {
            console.error('Copy failed:', err);
            alert('Clipboard access denied or unsupported. Ensure you are on a secure (HTTPS) connection.');
        }
    }

    let collagePressTimer;
    const LONG_PRESS_DURATION = 700;

    const startPress = (e) => {
        // Only trigger on left click (0) or touch
        if (e.type === 'mousedown' && e.button !== 0) return;
        
        collagePressTimer = setTimeout(() => {
            copyCanvasToClipboard();
        }, LONG_PRESS_DURATION);
    };

    const cancelPress = () => {
        clearTimeout(collagePressTimer);
    };

    collageCanvas.addEventListener('mousedown', startPress);
    collageCanvas.addEventListener('touchstart', startPress, { passive: true });
    
    collageCanvas.addEventListener('mouseup', cancelPress);
    collageCanvas.addEventListener('mouseleave', cancelPress);
    collageCanvas.addEventListener('touchend', cancelPress);
    collageCanvas.addEventListener('touchmove', cancelPress);
    
    // Prevent context menu on long press on mobile to avoid interference
    collageCanvas.addEventListener('contextmenu', (e) => {
        if (window.innerWidth < 768) {
            e.preventDefault();
        }
    });

    // --- Mask Configurator Feature ---
    const configureMaskBtn = document.getElementById('configure-mask-btn');
    const maskModal = document.getElementById('mask-modal');
    const closeMaskModalBtn = document.getElementById('close-mask-modal-btn');
    const maskCanvas = document.getElementById('mask-canvas');
    const refUpload = document.getElementById('reference-upload');
    const clearMasksBtn = document.getElementById('clear-masks-btn');
    const saveMasksBtn = document.getElementById('save-masks-btn');

    let maskCtx = null;
    if (maskCanvas) maskCtx = maskCanvas.getContext('2d');
    
    let refImage = null;
    let tempOverlays = [];
    let isDrawingMask = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;

    if (configureMaskBtn) {
        configureMaskBtn.addEventListener('click', () => {
            tempOverlays = [...overlays];
            maskModal.classList.remove('hidden');
            
            // If we have an image in imagesData, use the first one as reference if none loaded
            if (!refImage && imagesData.length > 0) {
                refImage = imagesData[0].imgElement;
            }
            redrawMaskCanvas();
        });
    }

    if (closeMaskModalBtn) {
        closeMaskModalBtn.addEventListener('click', () => {
            maskModal.classList.add('hidden');
        });
    }

    if (refUpload) {
        refUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    refImage = img;
                    redrawMaskCanvas();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
            refUpload.value = ''; // Reset
        });
    }

    function redrawMaskCanvas() {
        if (!maskCtx) return;
        if (!refImage) {
            maskCanvas.width = 600;
            maskCanvas.height = 600;
            maskCtx.fillStyle = '#f1f5f9';
            maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
            maskCtx.fillStyle = '#64748b';
            maskCtx.font = '20px Arial';
            maskCtx.textAlign = 'center';
            maskCtx.fillText('Upload a reference image or add a slip first', 300, 300);
        } else {
            // Scale if it's too large for viewport
            const maxWidth = window.innerWidth * 0.8;
            let scale = 1;
            if (refImage.width > maxWidth) {
                scale = maxWidth / refImage.width;
            }
            
            maskCanvas.width = refImage.width * scale;
            maskCanvas.height = refImage.height * scale;
            maskCanvas.dataset.scale = scale; // store scale 
            
            maskCtx.drawImage(refImage, 0, 0, maskCanvas.width, maskCanvas.height);
            
            // Adjust zoom transform for drawing masks relatively
            maskCtx.scale(scale, scale);
        }

        // Draw existing masks
        maskCtx.fillStyle = 'rgba(239, 68, 68, 0.4)'; // Semi-transparent red
        maskCtx.strokeStyle = '#ef4444';
        maskCtx.lineWidth = 2;
        
        tempOverlays.forEach(overlay => {
            maskCtx.fillRect(overlay.x, overlay.y, overlay.w, overlay.h);
            maskCtx.strokeRect(overlay.x, overlay.y, overlay.w, overlay.h);
        });

        // Draw current dragging box
        if (isDrawingMask) {
            const w = currentX - startX;
            const h = currentY - startY;
            maskCtx.fillStyle = 'rgba(59, 130, 246, 0.4)'; // Blue while drawing
            maskCtx.strokeStyle = '#3b82f6';
            maskCtx.fillRect(startX, startY, w, h);
            maskCtx.strokeRect(startX, startY, w, h);
        }
    }

    function getMousePosRef(e) {
        const rect = maskCanvas.getBoundingClientRect();
        let scaleX = maskCanvas.dataset.scale ? parseFloat(maskCanvas.dataset.scale) : 1;
        let scaleY = scaleX; // Maintaining uniform scale

        // The displayed canvas bounds vs original image size resolving
        // `rect.width` is the rendered CSS width. `maskCanvas.width` is the bitmap width.
        // But since we scaled `maskCanvas.width` itself above, we need to consider how getMousePosRef works:
        const cssScaleX = maskCanvas.width / rect.width;
        const cssScaleY = maskCanvas.height / rect.height;

        let clientX = e.clientX;
        let clientY = e.clientY;

        if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        }

        // 1. Account for CSS stretching: (clientX - rect.left) * cssScaleX
        // 2. Account for our explicit `scale` logic mapping it back to REAL image dimensions for saving.
        return {
            x: ((clientX - rect.left) * cssScaleX) / scaleX,
            y: ((clientY - rect.top) * cssScaleY) / scaleY
        };
    }

    if (maskCanvas) {
        maskCanvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (!refImage) return;
            const pos = getMousePosRef(e);
            startX = pos.x;
            startY = pos.y;
            currentX = pos.x;
            currentY = pos.y;
            isDrawingMask = true;
        });

        maskCanvas.addEventListener('mousemove', (e) => {
            if (!isDrawingMask) return;
            e.preventDefault();
            const pos = getMousePosRef(e);
            currentX = pos.x;
            currentY = pos.y;
            redrawMaskCanvas();
        });

        window.addEventListener('mouseup', () => {
            if (isDrawingMask) {
                isDrawingMask = false;
                
                const w = currentX - startX;
                const h = currentY - startY;
                
                // Only save if rect is large enough
                if (Math.abs(w) > 5 && Math.abs(h) > 5) {
                    const rx = w < 0 ? currentX : startX;
                    const ry = h < 0 ? currentY : startY;
                    tempOverlays.push({
                        x: Math.round(rx),
                        y: Math.round(ry),
                        w: Math.round(Math.abs(w)),
                        h: Math.round(Math.abs(h))
                    });
                }
                redrawMaskCanvas();
            }
        });

        // Touch support
        maskCanvas.addEventListener('touchstart', (e) => {
            if (!refImage) return;
            // Only stop default if touching the canvas directly to allow scrolling elsewhere
            if (e.target === maskCanvas) e.preventDefault(); 
            const pos = getMousePosRef(e);
            startX = pos.x;
            startY = pos.y;
            currentX = pos.x;
            currentY = pos.y;
            isDrawingMask = true;
        }, {passive: false});
        
        maskCanvas.addEventListener('touchmove', (e) => {
            if (!isDrawingMask) return;
            if (e.target === maskCanvas) e.preventDefault();
            const pos = getMousePosRef(e);
            currentX = pos.x;
            currentY = pos.y;
            redrawMaskCanvas();
        }, {passive: false});

        window.addEventListener('touchend', () => {
            if(isDrawingMask) {
                const w = currentX - startX;
                const h = currentY - startY;
                isDrawingMask = false;
                if (Math.abs(w) > 5 && Math.abs(h) > 5) {
                    const rx = w < 0 ? currentX : startX;
                    const ry = h < 0 ? currentY : startY;
                    tempOverlays.push({
                        x: Math.round(rx),
                        y: Math.round(ry),
                        w: Math.round(Math.abs(w)),
                        h: Math.round(Math.abs(h))
                    });
                }
                redrawMaskCanvas();
            }
        });
    }

    if (clearMasksBtn) {
        clearMasksBtn.addEventListener('click', () => {
            tempOverlays = [];
            redrawMaskCanvas();
        });
    }

    if (saveMasksBtn) {
        saveMasksBtn.addEventListener('click', () => {
            overlays = [...tempOverlays];
            localStorage.setItem('saved_slip_masks', JSON.stringify(overlays));
            maskModal.classList.add('hidden');
            
            // Re-process all existing images with the new mask template
            if (imagesData.length > 0) {
                imagesData.forEach(data => {
                    processImageFile(data.file, data.id);
                });
            }
            
            alert('Mask template saved successfully! Your current slips have been updated.');
        });
    }

});
