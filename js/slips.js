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
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const id = Date.now() + Math.random().toString(36).substr(2, 9);
                        imagesData.push({ id, file, imgElement: img });
                        renderPreviews();
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
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

            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.title = 'AI Eraser';
            editBtn.innerHTML = '<i class="fas fa-magic"></i>';
            editBtn.onclick = () => openEraserTool(data);

            div.appendChild(img);
            div.appendChild(editBtn);
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
    });

    // -- AI Eraser Feature --
    const modal = document.getElementById('eraser-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const paintCanvas = document.getElementById('paint-canvas');
    const applyAiBtn = document.getElementById('apply-ai-btn');
    const clearMaskBtn = document.getElementById('clear-mask-btn');
    const brushSizeInput = document.getElementById('brush-size');
    
    let paintCtx = paintCanvas.getContext('2d');
    let currentEditData = null;
    let isDrawing = false;
    let maskPaths = []; 
    let currentPath = null;
    
    function openEraserTool(data) {
        currentEditData = data;
        modal.classList.remove('hidden');
        maskPaths = [];
        
        // Scale to fit on screen if very large
        const maxWidth = window.innerWidth * 0.8;
        let scale = 1;
        if (data.imgElement.width > maxWidth) {
            scale = maxWidth / data.imgElement.width;
        }
        
        paintCanvas.width = data.imgElement.width * scale;
        paintCanvas.height = data.imgElement.height * scale;
        paintCanvas.dataset.scale = scale;
        
        redrawEditor();
    }
    
    closeModalBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        currentEditData = null;
    });
    
    function redrawEditor() {
        paintCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
        paintCtx.drawImage(currentEditData.imgElement, 0, 0, paintCanvas.width, paintCanvas.height);
        
        paintCtx.lineCap = 'round';
        paintCtx.lineJoin = 'round';
        paintCtx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; 
        
        maskPaths.forEach(path => {
            if (path.points.length < 2) return;
            paintCtx.lineWidth = path.size;
            paintCtx.beginPath();
            paintCtx.moveTo(path.points[0].x, path.points[0].y);
            for (let i = 1; i < path.points.length; i++) {
                paintCtx.lineTo(path.points[i].x, path.points[i].y);
            }
            paintCtx.stroke();
        });
    }
    
    function getMousePos(e) {
        const rect = paintCanvas.getBoundingClientRect();
        let clientX = e.clientX;
        let clientY = e.clientY;
        
        // Touch normalization
        if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        }
        
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }
    
    function startDraw(e) {
        e.preventDefault(); // Prevents mobile page scrolling while drawing
        isDrawing = true;
        const pos = getMousePos(e);
        currentPath = { points: [pos], size: brushSizeInput.value };
        maskPaths.push(currentPath);
        redrawEditor();
    }
    
    function moveDraw(e) {
        e.preventDefault();
        if (!isDrawing) return;
        const pos = getMousePos(e);
        currentPath.points.push(pos);
        redrawEditor();
    }
    
    function endDraw() {
        isDrawing = false;
    }
    
    paintCanvas.addEventListener('mousedown', startDraw);
    paintCanvas.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', endDraw);
    
    paintCanvas.addEventListener('touchstart', startDraw, {passive: false});
    paintCanvas.addEventListener('touchmove', moveDraw, {passive: false});
    window.addEventListener('touchend', endDraw);
    window.addEventListener('touchcancel', endDraw);
    
    clearMaskBtn.addEventListener('click', () => {
        maskPaths = [];
        redrawEditor();
    });
    
    applyAiBtn.addEventListener('click', () => {
        if (maskPaths.length === 0) {
            alert('Please draw a mask over the watermark first.');
            return;
        }
        applySimulatedInpainting();
    });
    
    function applySimulatedInpainting() {
        // 1. Create a canvas with the original image, but with the watermark CUT OUT
        const holeCanvas = document.createElement('canvas');
        holeCanvas.width = paintCanvas.width;
        holeCanvas.height = paintCanvas.height;
        const holeCtx = holeCanvas.getContext('2d');
        
        // Draw the image
        holeCtx.drawImage(currentEditData.imgElement, 0, 0, holeCanvas.width, holeCanvas.height);
        
        // Erase the mask area completely (makes a transparent hole)
        holeCtx.globalCompositeOperation = 'destination-out';
        holeCtx.lineCap = 'round';
        holeCtx.lineJoin = 'round';
        holeCtx.strokeStyle = 'black'; 
        maskPaths.forEach(path => {
            if (path.points.length < 2) return;
            holeCtx.lineWidth = parseInt(path.size) + 4; // safe margin
            holeCtx.beginPath();
            holeCtx.moveTo(path.points[0].x, path.points[0].y);
            for (let i = 1; i < path.points.length; i++) {
                holeCtx.lineTo(path.points[i].x, path.points[i].y);
            }
            holeCtx.stroke();
        });

        // 2. We now build an "inpainting filler" by repeatedly blurring the holeCanvas.
        // Since the watermark is missing, the blur forces surrounding colors into the hole without any watermark color leak!
        const fillerCanvas = document.createElement('canvas');
        fillerCanvas.width = paintCanvas.width;
        fillerCanvas.height = paintCanvas.height;
        const fillerCtx = fillerCanvas.getContext('2d');
        
        fillerCtx.filter = 'blur(15px)';
        // Draw the holey-image over itself multiple times. This heavily bleeds surrounding pixels to fill the gap.
        for (let i = 0; i < 20; i++) {
            fillerCtx.drawImage(holeCanvas, 0, 0);
        }
        fillerCtx.filter = 'none';

        // 3. Keep ONLY the beautifully filled area (the mask region) from the filler canvas
        fillerCtx.globalCompositeOperation = 'destination-in';
        fillerCtx.lineCap = 'round';
        fillerCtx.lineJoin = 'round';
        fillerCtx.strokeStyle = 'black';
        maskPaths.forEach(path => {
            if (path.points.length < 2) return;
            fillerCtx.lineWidth = parseInt(path.size) + 8; // generous overlap for smooth blend
            fillerCtx.beginPath();
            fillerCtx.moveTo(path.points[0].x, path.points[0].y);
            for (let i = 1; i < path.points.length; i++) {
                fillerCtx.lineTo(path.points[i].x, path.points[i].y);
            }
            fillerCtx.stroke();
        });

        // 4. Finally, assemble the image!
        paintCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
        paintCtx.globalCompositeOperation = 'source-over';
        paintCtx.drawImage(currentEditData.imgElement, 0, 0, paintCanvas.width, paintCanvas.height);
        // Drop the seamlessly generated filler patch right over the watermark
        paintCtx.drawImage(fillerCanvas, 0, 0);

        // Update the image data internally
        const updatedImg = new Image();
        updatedImg.onload = () => {
             const finalCanvas = document.createElement('canvas');
             finalCanvas.width = currentEditData.imgElement.width;
             finalCanvas.height = currentEditData.imgElement.height;
             const finalCtx = finalCanvas.getContext('2d');
             finalCtx.drawImage(updatedImg, 0, 0, finalCanvas.width, finalCanvas.height);
             
             const finalImg = new Image();
             finalImg.onload = () => {
                 currentEditData.imgElement = finalImg;
                 renderPreviews();
                 modal.classList.add('hidden');
             };
             // Add version stamp so browser doesn't cache the old image source
             finalImg.src = finalCanvas.toDataURL('image/png') + '?v=' + Date.now();
        };
        updatedImg.src = paintCanvas.toDataURL('image/png');
    }

    // --- OCR Auto-Cleaner Feature ---
    
    // Helper to perform inpainting programmatically given rectangles
    function inpaintImageRects(sourceImageElement, rects) {
        return new Promise((resolve) => {
            // 1. Cut holes
            const holeCanvas = document.createElement('canvas');
            holeCanvas.width = sourceImageElement.width;
            holeCanvas.height = sourceImageElement.height;
            const holeCtx = holeCanvas.getContext('2d');
            holeCtx.drawImage(sourceImageElement, 0, 0);
            
            holeCtx.globalCompositeOperation = 'destination-out';
            holeCtx.fillStyle = 'black'; 
            rects.forEach(rect => {
                // Add a small 4px padding outwards to ensure the whole word is covered
                holeCtx.fillRect(rect.x - 4, rect.y - 4, rect.width + 8, rect.height + 8);
            });

            // 2. Blur filler
            const fillerCanvas = document.createElement('canvas');
            fillerCanvas.width = holeCanvas.width;
            fillerCanvas.height = holeCanvas.height;
            const fillerCtx = fillerCanvas.getContext('2d');
            
            fillerCtx.filter = 'blur(15px)';
            for (let i = 0; i < 20; i++) {
                fillerCtx.drawImage(holeCanvas, 0, 0);
            }
            fillerCtx.filter = 'none';

            // 3. Keep only the filled regions
            fillerCtx.globalCompositeOperation = 'destination-in';
            fillerCtx.fillStyle = 'black';
            rects.forEach(rect => {
                fillerCtx.fillRect(rect.x - 8, rect.y - 8, rect.width + 16, rect.height + 16);
            });

            // 4. Assemble
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = sourceImageElement.width;
            finalCanvas.height = sourceImageElement.height;
            const finalCtx = finalCanvas.getContext('2d');
            finalCtx.drawImage(sourceImageElement, 0, 0);
            finalCtx.drawImage(fillerCanvas, 0, 0);

            const updatedImg = new Image();
            updatedImg.onload = () => {
                 resolve(updatedImg);
            };
            updatedImg.src = finalCanvas.toDataURL('image/png') + '?v=' + Date.now();
        });
    }

    const autoRemoveBtn = document.getElementById('auto-remove-btn');
    const autoRemoveInput = document.getElementById('auto-remove-text');
    const ocrStatus = document.getElementById('ocr-status');
    const ocrMsg = document.getElementById('ocr-msg');

    if(autoRemoveBtn) {
        autoRemoveBtn.addEventListener('click', async () => {
            const textToRemove = autoRemoveInput.value.trim().toLowerCase();
            if (!textToRemove) {
                alert("Please enter a word to remove.");
                return;
            }

            if (imagesData.length === 0) {
                alert("Please add some images first.");
                return;
            }

            ocrStatus.style.display = 'block';
            ocrMsg.textContent = 'Initializing AI OCR Engine... Please wait.';
            autoRemoveBtn.disabled = true;

            try {
                let cleanedCount = 0;

                for (let i = 0; i < imagesData.length; i++) {
                    const data = imagesData[i];
                    ocrMsg.textContent = `AI Processing image ${i + 1} of ${imagesData.length}...`;

                    // 1. Convert the browser File back to FormData
                    const formData = new FormData();
                    formData.append('image', data.file);
                    formData.append('prompt', textToRemove); // Tell FastAPI what to look for

                    // 2. Send to our local Python FastAPI server
                    const response = await fetch('http://localhost:8001/api/auto-clean', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) throw new Error('API failed');

                    // 3. Receive the pristine image back as a Blob
                    const blob = await response.blob();
                    
                    // 4. Update the UI
                    const newImgUrl = URL.createObjectURL(blob);
                    const newImg = new Image();
                    
                    // Wait for it to load, then swap it
                    await new Promise((resolve) => {
                        newImg.onload = resolve;
                        newImg.src = newImgUrl;
                    });

                    // Overwrite the old image data with the newly cleaned one
                    imagesData[i].imgElement = newImg;
                    
                    // Replace the stored file so collage generation uses the clean version
                    imagesData[i].file = new File([blob], 'cleaned.png', { type: 'image/png' });
                    cleanedCount++;
                }

                renderPreviews(); // Update UI
                
                ocrMsg.textContent = `Finished! Processed ${cleanedCount} images.`;
                setTimeout(() => { ocrStatus.style.display = 'none'; }, 4000);
                
            } catch (err) {
                console.error(err);
                ocrMsg.textContent = "Error during AI process: " + err.message;
            } finally {
                autoRemoveBtn.disabled = false;
            }
        });
    }
});
