// State Management
let deposits = [
    {
        id: "DEP-001",
        bank: "Chase Bank",
        machineId: "CDM-84920",
        amount: 2500.00,
        currency: "USD",
        ref: "TXN8492048912",
        datetime: "2026-06-27T10:15",
        depositor: "Sarah Connor",
        status: "Pending",
        reason: "",
        slipUrl: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?q=80&w=800&auto=format&fit=crop"
    },
    {
        id: "DEP-002",
        bank: "Wells Fargo",
        machineId: "CDM-11094",
        amount: 4800.00,
        currency: "USD",
        ref: "WF9823049182",
        datetime: "2026-06-27T11:45",
        depositor: "Marcus Wright",
        status: "Verified",
        reason: "",
        slipUrl: "https://images.unsplash.com/photo-1601597111158-2fceff270190?q=80&w=800&auto=format&fit=crop"
    },
    {
        id: "DEP-003",
        bank: "Bank of America",
        machineId: "CDM-55421",
        amount: 750.00,
        currency: "USD",
        ref: "BOA773294819",
        datetime: "2026-06-27T12:05",
        depositor: "John Connor",
        status: "Rejected",
        reason: "Duplicate submission (already processed)",
        slipUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=800&auto=format&fit=crop"
    },
    {
        id: "DEP-004",
        bank: "Maybank",
        machineId: "CDM-MY749",
        amount: 12000.00,
        currency: "MYR",
        ref: "MBB928401928",
        datetime: "2026-06-27T13:30",
        depositor: "Roslan bin Ahmad",
        status: "Verified",
        reason: "",
        slipUrl: "https://images.unsplash.com/photo-1598257006458-087169a1f08d?q=80&w=800&auto=format&fit=crop"
    },
    {
        id: "DEP-005",
        bank: "HSBC Bank",
        machineId: "CDM-UK932",
        amount: 3100.00,
        currency: "GBP",
        ref: "HSBC88294021",
        datetime: "2026-06-27T14:10",
        depositor: "Ellen Ripley",
        status: "Pending",
        reason: "",
        slipUrl: "https://images.unsplash.com/photo-1534951009808-766178b47a4f?q=80&w=800&auto=format&fit=crop"
    },
    {
        id: "DEP-006",
        bank: "Commonwealth Bank",
        machineId: "CDM-AU882",
        amount: 1500.00,
        currency: "AUD",
        ref: "CBA44920194",
        datetime: "2026-06-27T15:20",
        depositor: "James Hudson",
        status: "Pending",
        reason: "",
        slipUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=800&auto=format&fit=crop"
    }
];

// Current States
let selectedDeposit = null;
let uploadedFileUrl = null;
let imageFilters = { brightness: 100, contrast: 100, rotate: 0, zoom: 1 };
let searchFilter = "";
let statusFilter = "All";

// DOM Elements
document.addEventListener("DOMContentLoaded", () => {
    // Navigation
    const navItems = document.querySelectorAll(".nav-item");
    const panels = document.querySelectorAll(".view-panel");

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetView = item.getAttribute("data-view");
            
            navItems.forEach(nav => nav.classList.remove("active"));
            panels.forEach(p => p.classList.remove("active"));
            
            item.classList.add("active");
            document.getElementById(`${targetView}-view`).classList.add("active");
            
            if (targetView === "analytics") {
                renderCharts();
            }
        });
    });

    // Uploader Logic
    const uploader = document.getElementById("uploader");
    const fileInput = document.getElementById("file-input");
    const receiptPreviewContainer = document.getElementById("receipt-preview-container");
    const scannerLaser = document.getElementById("scanner-laser");
    const scanningOverlay = document.getElementById("scanning-overlay");
    const depositForm = document.getElementById("deposit-form");

    // Drag and drop handlers
    ["dragenter", "dragover"].forEach(eventName => {
        uploader.addEventListener(eventName, (e) => {
            e.preventDefault();
            uploader.classList.add("dragover");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        uploader.addEventListener(eventName, (e) => {
            e.preventDefault();
            uploader.classList.remove("dragover");
        }, false);
    });

    uploader.addEventListener("drop", (e) => {
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            handleUploadedFile(file);
        }
    });

    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            handleUploadedFile(file);
        }
    });

    uploader.addEventListener("click", () => {
        fileInput.click();
    });

    function handleUploadedFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedFileUrl = e.target.result;
            
            // Set image preview
            receiptPreviewContainer.innerHTML = `
                <div class="scanner-laser" id="scanner-laser"></div>
                <div class="scanning-overlay" id="scanning-overlay">
                    <i class="fas fa-microchip"></i>
                    <span>AI Scanning Slip...</span>
                </div>
                <img src="${uploadedFileUrl}" class="receipt-image" id="preview-img" alt="Receipt Preview">
            `;
            
            simulateOCR();
        };
        reader.readAsDataURL(file);
    }

    function simulateOCR() {
        const laser = document.getElementById("scanner-laser");
        const overlay = document.getElementById("scanning-overlay");
        
        laser.style.display = "block";
        overlay.style.display = "flex";

        setTimeout(() => {
            laser.style.display = "none";
            overlay.style.display = "none";
            
            // Generate Random Mock Data representing OCR extraction
            const banks = ["Chase Bank", "Wells Fargo", "Bank of America", "Maybank", "HSBC Bank", "Commonwealth Bank"];
            const selectedBank = banks[Math.floor(Math.random() * banks.length)];
            const randomAmount = (Math.floor(Math.random() * 200) * 20 + 200).toFixed(2);
            const randomRef = "TXN" + Math.random().toString(36).substr(2, 9).toUpperCase();
            const randomMachine = "CDM-" + Math.floor(10000 + Math.random() * 90000);
            const randomName = ["Michael Scott", "Jim Halpert", "Pam Beesly", "Dwight Schrute", "Angela Martin"][Math.floor(Math.random() * 5)];
            const now = new Date();
            const formattedDate = now.toISOString().slice(0, 16);

            // Set Form Values with green highlight effect
            setFieldValue("dep-bank", selectedBank);
            setFieldValue("dep-machine", randomMachine);
            setFieldValue("dep-amount", randomAmount);
            setFieldValue("dep-ref", randomRef);
            setFieldValue("dep-datetime", formattedDate);
            setFieldValue("dep-name", randomName);
            
            showToast("AI Scanning complete. Slip metadata extracted successfully!", "success");
        }, 2200);
    }

    function setFieldValue(id, value) {
        const input = document.getElementById(id);
        if (input) {
            input.value = value;
            input.classList.add("extracted");
            setTimeout(() => {
                input.classList.remove("extracted");
            }, 2000);
        }
    }

    // Submit Deposit Portal Form
    depositForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const newDep = {
            id: "DEP-" + String(deposits.length + 1).padStart(3, "0"),
            bank: document.getElementById("dep-bank").value,
            machineId: document.getElementById("dep-machine").value,
            amount: parseFloat(document.getElementById("dep-amount").value),
            currency: document.getElementById("dep-currency").value,
            ref: document.getElementById("dep-ref").value,
            datetime: document.getElementById("dep-datetime").value,
            depositor: document.getElementById("dep-name").value,
            status: "Pending",
            reason: "",
            slipUrl: uploadedFileUrl || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?q=80&w=800&auto=format&fit=crop"
        };

        deposits.unshift(newDep); // Add to beginning of array
        updateStats();
        renderTable();
        
        // Reset form & preview
        depositForm.reset();
        uploadedFileUrl = null;
        receiptPreviewContainer.innerHTML = `
            <div class="preview-placeholder">
                <i class="fas fa-file-invoice-dollar"></i>
                <p>Upload a CDM receipt to begin preview</p>
            </div>
        `;

        showToast(`Deposit ${newDep.id} submitted for verification successfully!`, "success");
        
        // Auto navigate to terminal to show the deposit is added
        setTimeout(() => {
            document.querySelector('[data-view="terminal"]').click();
        }, 1200);
    });

    // Verification Terminal Filtering & Searching
    const searchInput = document.getElementById("search-input");
    searchInput.addEventListener("input", (e) => {
        searchFilter = e.target.value.toLowerCase();
        renderTable();
    });

    const filterBtns = document.querySelectorAll(".filter-btn");
    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            filterBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            statusFilter = btn.getAttribute("data-status");
            renderTable();
        });
    });

    // Drawer Image Controls
    const reviewImg = document.getElementById("review-img");
    const brightnessBtn = document.getElementById("tool-brightness");
    const contrastBtn = document.getElementById("tool-contrast");
    const rotateBtn = document.getElementById("tool-rotate");
    const zoomInBtn = document.getElementById("tool-zoom-in");
    const zoomOutBtn = document.getElementById("tool-zoom-out");
    const resetImgBtn = document.getElementById("tool-reset");

    function applyImageFilters() {
        if (!reviewImg) return;
        reviewImg.style.filter = `brightness(${imageFilters.brightness}%) contrast(${imageFilters.contrast}%)`;
        reviewImg.style.transform = `rotate(${imageFilters.rotate}deg) scale(${imageFilters.zoom})`;
    }

    brightnessBtn.addEventListener("click", () => {
        imageFilters.brightness = imageFilters.brightness === 100 ? 150 : (imageFilters.brightness === 150 ? 70 : 100);
        brightnessBtn.classList.toggle("active", imageFilters.brightness !== 100);
        applyImageFilters();
        showToast(`Brightness set to ${imageFilters.brightness}%`, "info");
    });

    contrastBtn.addEventListener("click", () => {
        imageFilters.contrast = imageFilters.contrast === 100 ? 150 : (imageFilters.contrast === 150 ? 80 : 100);
        contrastBtn.classList.toggle("active", imageFilters.contrast !== 100);
        applyImageFilters();
        showToast(`Contrast set to ${imageFilters.contrast}%`, "info");
    });

    rotateBtn.addEventListener("click", () => {
        imageFilters.rotate = (imageFilters.rotate + 90) % 360;
        applyImageFilters();
    });

    zoomInBtn.addEventListener("click", () => {
        imageFilters.zoom = Math.min(2.5, imageFilters.zoom + 0.25);
        applyImageFilters();
    });

    zoomOutBtn.addEventListener("click", () => {
        imageFilters.zoom = Math.max(0.5, imageFilters.zoom - 0.25);
        applyImageFilters();
    });

    resetImgBtn.addEventListener("click", () => {
        imageFilters = { brightness: 100, contrast: 100, rotate: 0, zoom: 1 };
        brightnessBtn.classList.remove("active");
        contrastBtn.classList.remove("active");
        applyImageFilters();
        showToast("Image styling reset", "info");
    });

    // Drawer Approving and Rejecting
    const drawer = document.getElementById("drawer");
    const closeDrawerBtn = document.getElementById("close-drawer");
    const approveBtn = document.getElementById("approve-deposit-btn");
    const rejectBtn = document.getElementById("reject-deposit-btn");
    
    // Modal Rejection Elements
    const modal = document.getElementById("rejection-modal");
    const cancelModalBtn = document.getElementById("cancel-modal-btn");
    const submitRejectionBtn = document.getElementById("submit-rejection-btn");

    closeDrawerBtn.addEventListener("click", closeDrawer);
    
    approveBtn.addEventListener("click", () => {
        if (!selectedDeposit) return;
        selectedDeposit.status = "Verified";
        selectedDeposit.reason = "";
        updateStats();
        renderTable();
        closeDrawer();
        showToast(`Deposit ${selectedDeposit.id} verified and approved successfully!`, "success");
    });

    rejectBtn.addEventListener("click", () => {
        modal.classList.add("open");
    });

    cancelModalBtn.addEventListener("click", () => {
        modal.classList.remove("open");
    });

    submitRejectionBtn.addEventListener("click", () => {
        if (!selectedDeposit) return;
        const checkedReason = document.querySelector('input[name="reject-reason"]:checked');
        const reasonText = checkedReason ? checkedReason.value : "Failed policy check";
        
        selectedDeposit.status = "Rejected";
        selectedDeposit.reason = reasonText;
        
        modal.classList.remove("open");
        updateStats();
        renderTable();
        closeDrawer();
        showToast(`Deposit ${selectedDeposit.id} rejected: ${reasonText}`, "error");
    });

    function closeDrawer() {
        drawer.classList.remove("open");
        selectedDeposit = null;
        imageFilters = { brightness: 100, contrast: 100, rotate: 0, zoom: 1 };
        brightnessBtn.classList.remove("active");
        contrastBtn.classList.remove("active");
    }

    // Initialize Page
    updateStats();
    renderTable();
});

// Update Dashboard Statistics Cards
function updateStats() {
    const totalCount = deposits.length;
    const verifiedDeposits = deposits.filter(d => d.status === "Verified");
    const pendingDeposits = deposits.filter(d => d.status === "Pending");
    const rejectedDeposits = deposits.filter(d => d.status === "Rejected");

    // Compute Direct USD sums (ignoring currency exchange ratios for simplistic view, or mock them)
    // For cleaner stats, let's treat all values as standardized equivalent units or mock them nicely
    const totalVolume = verifiedDeposits.reduce((acc, curr) => {
        // Mock a basic conversion for demonstration: 1 GBP = 1.3 USD, 1 MYR = 0.22 USD, 1 AUD = 0.67 USD
        let conversion = 1;
        if (curr.currency === "GBP") conversion = 1.3;
        else if (curr.currency === "MYR") conversion = 0.22;
        else if (curr.currency === "AUD") conversion = 0.67;
        return acc + (curr.amount * conversion);
    }, 0);

    document.getElementById("stat-total-volume").innerText = "$" + totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById("stat-pending").innerText = pendingDeposits.length;
    document.getElementById("stat-verified").innerText = verifiedDeposits.length;
    
    const rejectRate = totalCount > 0 ? ((rejectedDeposits.length / totalCount) * 100).toFixed(1) : "0.0";
    document.getElementById("stat-reject-rate").innerText = rejectRate + "%";
}

// Render Data Table
function renderTable() {
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";

    const filtered = deposits.filter(dep => {
        // Status Filter
        if (statusFilter !== "All" && dep.status !== statusFilter) return false;
        
        // Search Filter
        if (searchFilter) {
            const matchBank = dep.bank.toLowerCase().includes(searchFilter);
            const matchRef = dep.ref.toLowerCase().includes(searchFilter);
            const matchName = dep.depositor.toLowerCase().includes(searchFilter);
            const matchId = dep.id.toLowerCase().includes(searchFilter);
            const matchMachine = dep.machineId.toLowerCase().includes(searchFilter);
            return matchBank || matchRef || matchName || matchId || matchMachine;
        }

        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                    <i class="fas fa-folder-open" style="font-size: 2.5rem; margin-bottom: 0.5rem; display: block; opacity: 0.5;"></i>
                    No deposits matching the filter requirements.
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(dep => {
        const tr = document.createElement("tr");
        
        let statusBadge = "";
        if (dep.status === "Pending") {
            statusBadge = `<span class="badge pending"><i class="fas fa-clock"></i> Pending</span>`;
        } else if (dep.status === "Verified") {
            statusBadge = `<span class="badge verified"><i class="fas fa-check-circle"></i> Verified</span>`;
        } else {
            statusBadge = `<span class="badge rejected"><i class="fas fa-times-circle"></i> Rejected</span>`;
        }

        // Format Date
        const dateObj = new Date(dep.datetime);
        const formattedDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + " " + dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

        tr.innerHTML = `
            <td><strong>${dep.id}</strong></td>
            <td>
                <div style="font-weight: 600;">${dep.bank}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${dep.machineId}</div>
            </td>
            <td>
                <div style="font-weight: 600;">${dep.currency} ${dep.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </td>
            <td><code style="color: var(--accent-cyan); font-family: monospace; font-size: 0.85rem;">${dep.ref}</code></td>
            <td>
                <div>${dep.depositor}</div>
            </td>
            <td><span style="font-size: 0.8rem; color: var(--text-secondary);">${formattedDate}</span></td>
            <td>${statusBadge}</td>
        `;

        tr.addEventListener("click", () => {
            openReviewDrawer(dep);
        });

        tbody.appendChild(tr);
    });
}

// Open Review Drawer
function openReviewDrawer(dep) {
    selectedDeposit = dep;
    
    document.getElementById("drawer-dep-id").innerText = dep.id;
    document.getElementById("review-img").src = dep.slipUrl;
    
    // Set Metadata Detail Panel
    document.getElementById("det-bank").innerText = dep.bank;
    document.getElementById("det-machine").innerText = dep.machineId;
    document.getElementById("det-amount").innerText = `${dep.currency} ${dep.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    document.getElementById("det-ref").innerText = dep.ref;
    document.getElementById("det-depositor").innerText = dep.depositor;
    
    const dateObj = new Date(dep.datetime);
    document.getElementById("det-datetime").innerText = dateObj.toLocaleString();

    // Rejection details block
    const reasonBlock = document.getElementById("drawer-rejection-info");
    if (dep.status === "Rejected") {
        reasonBlock.style.display = "block";
        document.getElementById("det-reason").innerText = dep.reason || "None specified";
    } else {
        reasonBlock.style.display = "none";
    }

    // Adjust button displays depending on status
    const actionsContainer = document.querySelector(".drawer-actions");
    if (dep.status === "Pending") {
        actionsContainer.style.display = "flex";
    } else {
        actionsContainer.style.display = "none"; // Hide action buttons if already verified/rejected
    }

    // Reset image transform/filters
    imageFilters = { brightness: 100, contrast: 100, rotate: 0, zoom: 1 };
    document.getElementById("review-img").style.filter = "none";
    document.getElementById("review-img").style.transform = "none";

    // Slide Drawer In
    document.getElementById("drawer").classList.add("open");
}

// Render Analytics Charts using Custom D3-like SVG rendering
function renderCharts() {
    // 1. Render Bar Chart (Deposits count by Bank)
    const bankCounts = {};
    deposits.forEach(d => {
        bankCounts[d.bank] = (bankCounts[d.bank] || 0) + 1;
    });

    const barChartContainer = document.getElementById("bar-chart");
    barChartContainer.innerHTML = "";

    const banks = Object.keys(bankCounts);
    const counts = Object.values(bankCounts);
    const maxCount = Math.max(...counts, 1);

    banks.forEach((bank, i) => {
        const count = bankCounts[bank];
        const pct = (count / maxCount) * 100;
        
        // Shorten bank name for labels
        let shortName = bank.replace(" Bank", "").replace(" wealth", "");
        if (shortName.length > 10) shortName = shortName.substr(0, 9) + "..";

        const barWrapper = document.createElement("div");
        barWrapper.className = "chart-bar-wrapper";
        barWrapper.innerHTML = `
            <div class="chart-bar" style="height: ${Math.max(5, pct * 0.8)}%">
                <div class="chart-bar-tooltip">${bank}: ${count} deposit(s)</div>
            </div>
            <div class="chart-label" title="${bank}">${shortName}</div>
        `;
        barChartContainer.appendChild(barWrapper);
    });

    // 2. Render Donut Chart (Status breakdown)
    const statusCounts = { Pending: 0, Verified: 0, Rejected: 0 };
    deposits.forEach(d => {
        statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
    });

    const total = deposits.length;
    const pendingVal = statusCounts.Pending;
    const verifiedVal = statusCounts.Verified;
    const rejectedVal = statusCounts.Rejected;

    // SVG parameters
    const size = 180;
    const center = size / 2;
    const radius = 60;
    const circumference = 2 * Math.PI * radius;

    // Draw donut portions
    // verified percentage, pending percentage, rejected percentage
    const verifiedPct = total > 0 ? (verifiedVal / total) : 0;
    const pendingPct = total > 0 ? (pendingVal / total) : 0;
    const rejectedPct = total > 0 ? (rejectedVal / total) : 0;

    const strokeDashVerified = verifiedPct * circumference;
    const strokeDashPending = pendingPct * circumference;
    const strokeDashRejected = rejectedPct * circumference;

    const offsetVerified = 0;
    const offsetPending = strokeDashVerified;
    const offsetRejected = strokeDashVerified + strokeDashPending;

    const donutChart = document.getElementById("donut-chart-container");
    donutChart.innerHTML = `
        <svg class="donut-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <circle class="donut-circle-bg" cx="${center}" cy="${center}" r="${radius}" />
            
            <!-- Verified Circle Segment -->
            <circle class="donut-circle-val" cx="${center}" cy="${center}" r="${radius}"
                stroke="var(--success)"
                stroke-dasharray="${strokeDashVerified} ${circumference}"
                stroke-dashoffset="${-offsetVerified}" />
                
            <!-- Pending Circle Segment -->
            <circle class="donut-circle-val" cx="${center}" cy="${center}" r="${radius}"
                stroke="var(--warning)"
                stroke-dasharray="${strokeDashPending} ${circumference}"
                stroke-dashoffset="${-offsetPending}" />
                
            <!-- Rejected Circle Segment -->
            <circle class="donut-circle-val" cx="${center}" cy="${center}" r="${radius}"
                stroke="var(--danger)"
                stroke-dasharray="${strokeDashRejected} ${circumference}"
                stroke-dashoffset="${-offsetRejected}" />
        </svg>
        <div class="donut-center-text">
            <span class="donut-center-val" id="donut-total-val">${total}</span>
            <span class="donut-center-lbl">Deposits</span>
        </div>
    `;

    // Legend
    document.getElementById("leg-pending").innerText = pendingVal;
    document.getElementById("leg-verified").innerText = verifiedVal;
    document.getElementById("leg-rejected").innerText = rejectedVal;
}

// Utility Toast Alerts
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let icon = "info-circle";
    if (type === "success") icon = "check-circle";
    else if (type === "error") icon = "exclamation-circle";

    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Fade out and remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = "fadeOut 0.4s ease forwards";
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 4000);
}
