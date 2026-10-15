// Live Deposit Clearinghouse - Core Application logic
document.addEventListener("DOMContentLoaded", () => {
    // Supabase Connection Settings
    const supabaseUrl = 'https://pjbcoagmqiimadfzupmc.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqYmNvYWdtcWlpbWFkZnp1cG1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NzUxOTAsImV4cCI6MjA5MzQ1MTE5MH0.lrxkgpem2KC8cVWJ-pUfB9CT-JE78O8D3Bdvoiewhkc';
    
    let supabase = null;
    try {
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    } catch (e) {
        console.error("Supabase client failed to load", e);
        showToast("Backend connection failure. Check console.", "error");
    }

    // App State Variables
    let activeRole = localStorage.getItem("bit_role") || "A";
    let depositsList = [];
    let selectedDeposit = null;
    let statusFilter = "All";
    let lightboxFilters = { brightness: 100, contrast: 100, rotate: 0, zoom: 1 };
    
    // File references for uploads
    let requestFile = null;

    // DOM Elements Cache
    const roleToggleContainer = document.getElementById("role-toggle-container");
    const roleBtnA = document.getElementById("role-btn-a");
    const roleBtnC = document.getElementById("role-btn-c");
    const realtimeIndicator = document.getElementById("realtime-indicator");
    const realtimeText = document.getElementById("realtime-text");
    
    // Role Sections
    const sectionRoleA = document.getElementById("section-role-a");
    const sectionRoleB = document.getElementById("section-role-b");
    
    // Stats elements
    const statVerifiedVolume = document.getElementById("stat-verified-volume");
    const statCountAvailable = document.getElementById("stat-count-available");
    const statCountPaid = document.getElementById("stat-count-paid");
    const statCountClaimed = document.getElementById("stat-count-claimed");

    // Form Person A
    const requestForm = document.getElementById("request-form");
    const reqAmount = document.getElementById("req-amount");
    const reqDetailsText = document.getElementById("req-details-text");
    const reqFileInput = document.getElementById("req-file-input");

    // Ledger container
    const pipelineLedgerContainer = document.getElementById("pipeline-ledger-container");
    
    // Drawer Person A Verification
    // Posting Account Stats
    const postTotalAmount = document.getElementById("post-total-amount");
    const postSuccessAmount = document.getElementById("post-success-amount");
    const postFailedAmount = document.getElementById("post-failed-amount");

    // Modal Person C Payment
    const paymentModal = document.getElementById("payment-modal");
    const paymentSubmitForm = document.getElementById("payment-submit-form");
    const paySubmitId = document.getElementById("pay-submit-id");
    const payAmountLabel = document.getElementById("pay-amount-label");
    const payRef = document.getElementById("pay-ref");
    const payFileInput = document.getElementById("pay-file-input");
    const btnCancelPayment = document.getElementById("btn-cancel-payment");

    // Modal Rejection
    const rejectionModal = document.getElementById("rejection-modal");
    const rejectionSubmitForm = document.getElementById("rejection-submit-form");
    const rejectSubmitId = document.getElementById("reject-submit-id");
    const rejectComment = document.getElementById("reject-comment");
    const btnCancelRejection = document.getElementById("btn-cancel-rejection");

    // Lightbox modal
    const lightboxModal = document.getElementById("lightbox");
    const lightboxImg = document.getElementById("lightbox-img");
    const btnCloseLightbox = document.getElementById("btn-close-lightbox");
    const toolLightRotate = document.getElementById("tool-light-rotate");
    const toolLightZoomIn = document.getElementById("tool-light-zoom-in");
    const toolLightZoomOut = document.getElementById("tool-light-zoom-out");
    const toolLightWhatsapp = document.getElementById("tool-light-whatsapp");
    const toolLightReset = document.getElementById("tool-light-reset");

    const btnClearWorkspace = document.getElementById("btn-clear-workspace");

    // Custom File Upload Status Labels
    const reqFileStatus = document.getElementById("req-file-status");
    const payFileStatus = document.getElementById("pay-file-status");

    // Initialize App UI based on URL or saved role
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get("role");
    if (roleParam && ["A", "C"].includes(roleParam.toUpperCase())) {
        activeRole = roleParam.toUpperCase();
        localStorage.setItem("bit_role", activeRole);
    }
    // Set initial toggle state
    updateToggleState();
    updateRoleView();

    function updateToggleState() {
        if (!roleToggleContainer || !roleBtnA || !roleBtnC) return;
        if (activeRole === "A") {
            roleToggleContainer.classList.remove("role-c");
            roleBtnA.classList.add("active");
            roleBtnC.classList.remove("active");
        } else {
            roleToggleContainer.classList.add("role-c");
            roleBtnC.classList.add("active");
            roleBtnA.classList.remove("active");
        }
    }

    function switchRole(newRole) {
        activeRole = newRole;
        localStorage.setItem("bit_role", activeRole);
        
        // Update URL parameter cleanly without reloading page
        const newUrl = new URL(window.location);
        newUrl.searchParams.set("role", activeRole);
        window.history.pushState({}, '', newUrl);

        updateToggleState();
        updateRoleView();
        renderLedger();
    }

    if (roleBtnA) roleBtnA.addEventListener("click", () => switchRole("A"));
    if (roleBtnC) roleBtnC.addEventListener("click", () => switchRole("C"));

    // Handle role display logic
    function updateRoleView() {
        // Toggle sections active
        sectionRoleA.classList.remove("active");
        if (sectionRoleB) sectionRoleB.classList.remove("active");
        
        if (activeRole === "A") {
            sectionRoleA.classList.add("active");
        }
        
        // Close modals on role change
        paymentModal.classList.remove("active");
        rejectionModal.classList.remove("active");
    }

    // Connect to Supabase DB and Real-time listener
    async function initSupabase() {
        if (!supabase) return;

        // Load initial records
        await fetchDeposits();

        // Subscribe to changes in realtime
        supabase
            .channel("deposits-db-channel")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "deposits" },
                (payload) => {
                    console.log("Realtime event received:", payload);
                    
                    // Show a toast about live ledger update
                    if (payload.eventType === "INSERT") {
                        showToast(`New request of $${payload.new.amount} added to ledger`, "info");
                    } else if (payload.eventType === "UPDATE") {
                        const statusChange = payload.new.status !== payload.old.status;
                        if (statusChange) {
                            showToast(`Deposit #${payload.new.id} status updated to ${payload.new.status}`, "info");
                        }
                    }
                    
                    fetchDeposits();
                }
            )
            .subscribe((status) => {
                if (status === "SUBSCRIBED") {
                    console.log("Subscribed to database changes via realtime.");
                    realtimeIndicator.className = "sync-status connected";
                    realtimeText.innerText = "Syncing Live";
                } else {
                    realtimeIndicator.className = "sync-status";
                    realtimeText.innerText = "Offline Sync";
                }
            });
    }

    // Fetch deposits from database
    async function fetchDeposits() {
        if (!supabase) return;
        try {
            const { data, error } = await supabase
                .from("deposits")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            depositsList = data || [];
            updatePostingAccountCounters();
            renderLedger();
        } catch (e) {
            console.error("Error fetching deposits", e);
            showToast("Failed to fetch deposit list", "error");
        }
    }

    // Update the Stats Dashboard for Posting Accounts
    function updatePostingAccountCounters() {
        let totalPosted = 0;
        let totalSuccess = 0;
        let totalFailed = 0;

        depositsList.forEach(dep => {
            const amt = parseFloat(dep.amount || 0);
            totalPosted += amt;
            if (dep.status === "Paid" || dep.status === "Verified") {
                totalSuccess += amt;
            } else if (dep.status === "Rejected") {
                totalFailed += amt;
            }
        });

        if (postTotalAmount) postTotalAmount.innerText = `₹${totalPosted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (postSuccessAmount) postSuccessAmount.innerText = `₹${totalSuccess.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (postFailedAmount) postFailedAmount.innerText = `₹${totalFailed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Render pipeline list cards
    function renderLedger() {
        pipelineLedgerContainer.innerHTML = "";
        
        // Apply status quick filters
        const filteredList = depositsList.filter(dep => {
            if (statusFilter === "All") return true;
            return dep.status === statusFilter;
        });

        if (filteredList.length === 0) {
            pipelineLedgerContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem 0; color: var(--text-muted);">
                    <i class="fas fa-box-open" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>No transactions match the selected filter</p>
                </div>
            `;
            return;
        }

        if (activeRole === "A") {
            // Excel rows format (Table layout) for Requester
            const tableWrapper = document.createElement("div");
            tableWrapper.className = "excel-table-wrapper";
            
            const table = document.createElement("table");
            table.className = "excel-table";
            
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Date/Time</th>
                        <th>Amount</th>
                        <th>Destination Account</th>
                        <th>Status</th>
                        <th>Receipt Slip & Ref</th>
                        <th style="text-align: center;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            `;
            
            const tbody = table.querySelector("tbody");
            
            filteredList.forEach(dep => {
                const tr = document.createElement("tr");
                
                const dateStr = new Date(dep.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
                                " " + new Date(dep.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
                
                const statusClass = `status-${dep.status.toLowerCase()}`;
                
                // Destination details + click to reveal screenshot icon/thumbnail
                let destHtml = `<span class="excel-dest" title="${dep.account_text || ''}">${dep.account_text || 'No text details'}</span>`;
                if (dep.account_image_url) {
                    destHtml = `
                        <div class="excel-dest-container">
                            <img src="${dep.account_image_url}" class="excel-thumb view-large-image" alt="Destination Screenshot" title="Click to view details image">
                            <span class="excel-dest" style="max-width: 180px;" title="${dep.account_text || ''}">${dep.account_text || 'Screenshot details'}</span>
                        </div>
                    `;
                }

                // Slip image + Reference
                let slipHtml = `<span style="color: var(--text-muted); font-size: 0.8rem;">No proof yet</span>`;
                if (dep.slip_image_url || dep.deposit_reference) {
                    const imgThumb = dep.slip_image_url 
                        ? `<img src="${dep.slip_image_url}" class="excel-thumb view-large-image" alt="Receipt Slip" title="Click to view receipt image">` 
                        : `<i class="fas fa-receipt" style="font-size: 1.25rem; color: var(--text-muted);" title="No receipt uploaded"></i>`;
                    
                    const refText = dep.deposit_reference 
                        ? `<span style="font-family: monospace; font-size: 0.8rem; color: var(--text-primary); font-weight: 600;" title="${dep.deposit_reference}">Ref: ${dep.deposit_reference}</span>` 
                        : `<span style="color: var(--text-muted); font-size: 0.8rem;">No reference text</span>`;
                    
                    slipHtml = `
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            ${imgThumb}
                            <div style="display: flex; flex-direction: column; gap: 0.1rem;">
                                ${refText}
                                ${dep.paid_at ? `<span style="font-size: 0.7rem; color: var(--text-muted);">Completed: ${new Date(dep.paid_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                            </div>
                        </div>
                    `;
                }

                // Build action HTML for the row based on status (Requester Role A view)
                let rowActionHtml = "";
                if (dep.status === "Paid") {
                    rowActionHtml = `
                        <div style="display: flex; gap: 0.35rem; justify-content: center; align-items: center;">
                            <button class="btn-secondary share-proof-btn" data-id="${dep.id}" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; margin: 0; display: flex; align-items: center; gap: 0.25rem;" title="Share to WhatsApp">
                                <i class="fab fa-whatsapp"></i> Share
                            </button>
                            <button class="action-btn-large btn-drawer-reject" data-id="${dep.id}" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; margin: 0; background: linear-gradient(135deg, var(--danger), #ef4444); box-shadow: none; display: flex; align-items: center; gap: 0.25rem;" title="Reject Slip">
                                <i class="fas fa-circle-xmark"></i> Reject
                            </button>
                        </div>
                    `;
                } else if (dep.status === "Verified") {
                    rowActionHtml = `
                        <div style="display: flex; gap: 0.35rem; justify-content: center; align-items: center;">
                            <button class="btn-secondary share-proof-btn" data-id="${dep.id}" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; margin: 0; display: flex; align-items: center; gap: 0.25rem;" title="Share to WhatsApp">
                                <i class="fab fa-whatsapp"></i> Share
                            </button>
                            <span style="font-size: 0.75rem; color: var(--success); display: flex; align-items: center; gap: 0.2rem; font-weight: 500;">
                                <i class="fas fa-circle-check"></i> Done
                            </span>
                        </div>
                    `;
                } else if (dep.status === "Available") {
                    rowActionHtml = `<div style="font-size: 0.75rem; color: var(--text-muted); text-align: center;"><i class="fas fa-hourglass-start"></i> Waiting...</div>`;
                } else if (dep.status === "Claimed") {
                    rowActionHtml = `<div style="font-size: 0.75rem; color: var(--warning); text-align: center;"><i class="fas fa-spinner fa-spin"></i> Transferring...</div>`;
                } else if (dep.status === "Rejected") {
                    rowActionHtml = `<div style="font-size: 0.75rem; color: var(--danger); text-align: center;"><i class="fas fa-circle-xmark"></i> Rejected</div>`;
                }

                tr.innerHTML = `
                    <td><span class="excel-id">DEP-${String(dep.id).padStart(4, "0")}</span></td>
                    <td style="color: var(--text-secondary); white-space: nowrap;">${dateStr}</td>
                    <td><span class="excel-amount">₹${parseFloat(dep.amount).toFixed(2)}</span></td>
                    <td>${destHtml}</td>
                    <td><span class="pipeline-status ${statusClass}" style="padding: 0.2rem 0.45rem; font-size: 0.7rem; border-radius: 4px; font-weight: 600;">${dep.status}</span></td>
                    <td>${slipHtml}</td>
                    <td>${rowActionHtml}</td>
                `;
                tbody.appendChild(tr);
            });
            
            tableWrapper.appendChild(table);
            pipelineLedgerContainer.appendChild(tableWrapper);
        } else {
            // Keep card list for Depositor (Role C) & Admin (Role B)
            filteredList.forEach(dep => {
                const card = document.createElement("div");
                card.className = "pipeline-card";
                
                // Format timestamps
                const dateStr = new Date(dep.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
                                " " + new Date(dep.created_at).toLocaleDateString();

                // Status styling class
                const statusClass = `status-${dep.status.toLowerCase()}`;

                // Build dynamic action HTML based on the current role and transaction status
                let actionHtml = "";
                
                if (activeRole === "A") {
                    // Requester view actions (fallback)
                    if (dep.status === "Paid") {
                        actionHtml = `
                            <div style="display: flex; gap: 0.5rem; width: 100%;">
                                <button class="btn-secondary share-proof-btn" data-id="${dep.id}" style="flex: 1; padding: 0.5rem; font-size: 0.8rem; margin: 0; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                                    <i class="fab fa-whatsapp"></i> Share Proof
                                </button>
                                <button class="action-btn-large btn-drawer-reject" data-id="${dep.id}" style="flex: 1; background: linear-gradient(135deg, var(--danger), #ef4444); box-shadow: 0 4px 15px rgba(239, 68, 68, 0.25); padding: 0.5rem; font-size: 0.8rem; margin: 0; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                                    <i class="fas fa-circle-xmark"></i> Reject Slip
                                </button>
                            </div>
                        `;
                    } else if (dep.status === "Available") {
                        actionHtml = `<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center;"><i class="fas fa-hourglass-start"></i> Waiting for depositor to claim...</div>`;
                    } else if (dep.status === "Claimed") {
                        actionHtml = `<div style="font-size: 0.85rem; color: var(--warning); text-align: center;"><i class="fas fa-spinner fa-spin"></i> Depositor is executing bank transfer...</div>`;
                    } else if (dep.status === "Rejected") {
                        actionHtml = `<div style="font-size: 0.85rem; color: var(--danger); text-align: center;"><i class="fas fa-circle-xmark"></i> Rejected. Awaiting re-upload...</div>`;
                    } else if (dep.status === "Verified") {
                        actionHtml = `
                            <div style="display: flex; gap: 0.5rem; width: 100%;">
                                <button class="btn-secondary share-proof-btn" data-id="${dep.id}" style="flex: 1; padding: 0.5rem; font-size: 0.8rem; margin: 0; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                                    <i class="fab fa-whatsapp"></i> Share Proof
                                </button>
                                <div style="font-size: 0.85rem; color: var(--success); display: flex; align-items: center; justify-content: center; gap: 0.25rem; flex: 1;">
                                    <i class="fas fa-circle-check"></i> Transaction Completed
                                </div>
                            </div>
                        `;
                    }
                } else if (activeRole === "C") {
                    // Depositor actions
                    if (dep.status === "Available") {
                        actionHtml = `
                            <button class="action-btn-large btn-claim claim-deposit-job" data-id="${dep.id}">
                                <i class="fas fa-hand-holding-dollar"></i> Claim Deposit Job
                            </button>
                        `;
                    } else if (dep.status === "Claimed" || dep.status === "Rejected") {
                        actionHtml = `
                            <button class="action-btn-large btn-paid submit-deposit-proof" data-id="${dep.id}">
                                <i class="fas fa-upload"></i> ${dep.status === "Rejected" ? "Re-upload Slip & Complete" : "Upload Slip & Complete"}
                            </button>
                        `;
                    } else if (dep.status === "Paid") {
                        actionHtml = `
                            <div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
                                <div style="font-size: 0.85rem; color: var(--text-muted); text-align: center;">
                                    <i class="fas fa-circle-notch fa-spin"></i> Submitted. Awaiting receiver verification...
                                </div>
                                <button class="btn-secondary edit-deposit-proof" data-id="${dep.id}" style="padding: 0.45rem; font-size: 0.8rem; margin: 0; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                                    <i class="fas fa-edit"></i> Edit Slip / Ref
                                </button>
                            </div>
                        `;
                    } else if (dep.status === "Verified") {
                        actionHtml = `
                            <div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
                                <div style="font-size: 0.85rem; color: var(--success); text-align: center;">
                                    <i class="fas fa-circle-check"></i> Verified. Funds Cleared.
                                </div>
                                <button class="btn-secondary edit-deposit-proof" data-id="${dep.id}" style="padding: 0.45rem; font-size: 0.8rem; margin: 0; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                                    <i class="fas fa-edit"></i> Edit Slip / Ref
                                </button>
                            </div>
                        `;
                    }
                } else if (activeRole === "B") {
                    // Admin override dropdown
                    actionHtml = `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                            <span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fas fa-cog"></i> Admin Override:</span>
                            <select class="admin-override-select" data-id="${dep.id}" style="width: auto; padding: 0.35rem 0.5rem; font-size: 0.8rem; height: auto; margin:0;">
                                <option value="Available" ${dep.status === "Available" ? "selected" : ""}>Available</option>
                                <option value="Claimed" ${dep.status === "Claimed" ? "selected" : ""}>Claimed</option>
                                <option value="Rejected" ${dep.status === "Rejected" ? "selected" : ""}>Rejected</option>
                                <option value="Paid" ${dep.status === "Paid" ? "selected" : ""}>Paid</option>
                                <option value="Verified" ${dep.status === "Verified" ? "selected" : ""}>Verified</option>
                            </select>
                        </div>
                    `;
                }

                // Image Thumbnails (if exists)
                let detailsImgHtml = "";
                if (dep.account_image_url) {
                    detailsImgHtml = `<img src="${dep.account_image_url}" class="pipeline-img-thumbnail view-large-image" alt="Bank Screenshot" title="Tap to expand">`;
                }

                let slipImgHtml = "";
                if (dep.slip_image_url) {
                    slipImgHtml = `<img src="${dep.slip_image_url}" class="pipeline-img-thumbnail view-large-image" alt="Transfer Slip" title="Tap to expand">`;
                }

                // Reference details row
                let referenceRowHtml = "";
                if (dep.deposit_reference || dep.slip_image_url) {
                    referenceRowHtml = `
                        <div style="display: flex; gap: 1rem; align-items: center; margin-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 0.5rem;">
                            ${slipImgHtml}
                            <div style="font-size: 0.85rem;">
                                <div style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Payment Details</div>
                                <div style="color: var(--text-primary); font-family: monospace; margin-top: 0.15rem;">Ref: ${dep.deposit_reference || 'No ref text'}</div>
                                ${(dep.paid_at || dep.verified_at) ? `<div style="color: var(--text-muted); font-size: 0.75rem;">Completed: ${new Date(dep.paid_at || dep.verified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>` : ''}
                            </div>
                        </div>
                    `;
                }

                // Rejection reason row
                let rejectionRowHtml = "";
                if (dep.rejection_reason) {
                    rejectionRowHtml = `
                        <div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--danger); background: rgba(239, 68, 68, 0.08); padding: 0.5rem; border-radius: var(--radius-sm); border-left: 3px solid var(--danger);">
                            <strong><i class="fas fa-triangle-exclamation"></i> Rejection Reason:</strong> ${dep.rejection_reason}
                        </div>
                    `;
                }

                card.innerHTML = `
                    <div class="pipeline-card-header">
                        <div>
                            <span style="font-size: 0.75rem; font-family: monospace; color: var(--accent-cyan);">DEP-${String(dep.id).padStart(4, "0")}</span>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${dateStr}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="pipeline-amount">₹${parseFloat(dep.amount).toFixed(2)}</span>
                            <span class="pipeline-status ${statusClass}">${dep.status}</span>
                        </div>
                    </div>

                    <div class="pipeline-details">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                            <div>${dep.account_text || "No destination text details provided"}</div>
                            ${detailsImgHtml}
                        </div>
                    </div>

                    ${referenceRowHtml}
                    ${rejectionRowHtml}

                    <div style="margin-top: 0.5rem;">
                        ${actionHtml}
                    </div>
                `;

                pipelineLedgerContainer.appendChild(card);
            });
        }
    }

    // Event delegation on the pipeline ledger container
    pipelineLedgerContainer.addEventListener("click", async (e) => {
        
        const claimBtn = e.target.closest(".claim-deposit-job");
        const submitBtn = e.target.closest(".submit-deposit-proof");
        const editBtn = e.target.closest(".edit-deposit-proof");
        const rejectBtn = e.target.closest(".btn-drawer-reject");
        const shareBtn = e.target.closest(".share-proof-btn");
        const imgBtn = e.target.closest(".view-large-image");

        if (claimBtn) {
            const id = claimBtn.getAttribute("data-id");
            await claimDepositJob(id);
        } else if (submitBtn) {
            const id = submitBtn.getAttribute("data-id");
            const deposit = depositsList.find(d => parseInt(d.id) === parseInt(id));
            if (deposit) {
                openPaymentModal(deposit);
            }
        } else if (editBtn) {
            const id = editBtn.getAttribute("data-id");
            const deposit = depositsList.find(d => parseInt(d.id) === parseInt(id));
            if (deposit) {
                openPaymentModal(deposit);
            }
        } else if (rejectBtn) {
            const id = rejectBtn.getAttribute("data-id");
            const deposit = depositsList.find(d => parseInt(d.id) === parseInt(id));
            if (deposit) {
                rejectSubmitId.value = deposit.id;
                rejectComment.value = "";
                rejectionModal.classList.add("active");
            }
        } else if (shareBtn) {
            const id = shareBtn.getAttribute("data-id");
            const deposit = depositsList.find(d => parseInt(d.id) === parseInt(id));
            if (deposit) {
                shareToWhatsApp(deposit);
            }
        } else if (imgBtn) {
            openLightbox(imgBtn.src);
        }
    });

    pipelineLedgerContainer.addEventListener("change", async (e) => {
        const select = e.target.closest(".admin-override-select");
        if (select) {
            const id = select.getAttribute("data-id");
            const newStatus = e.target.value;
            await overrideDepositStatus(id, newStatus);
        }
    });

    // Quick filter buttons handler
    document.querySelectorAll("[data-status-filter]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("[data-status-filter]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            statusFilter = btn.getAttribute("data-status-filter");
            renderLedger();
        });
    });

    // Helper: Upload file to storage with robust Base64 fallback
    async function uploadFile(bucketName, file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;
        
        try {
            if (!supabase) throw new Error("Supabase client not loaded");
            
            const { data, error } = await supabase.storage
                .from(bucketName)
                .upload(filePath, file);
            
            if (error) throw error;
            
            const { data: publicUrlData } = supabase.storage
                .from(bucketName)
                .getPublicUrl(filePath);
                
            return publicUrlData.publicUrl;
        } catch (err) {
            console.warn("Storage API failed, falling back to Base64 data URL", err);
            
            // Standard Base64 reader
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => reject(new Error("Failed to read file into Base64"));
                reader.readAsDataURL(file);
            });
        }
    }

    // Person A: Submit a new Deposit Request
    requestForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const amount = parseFloat(reqAmount.value);
        const text = reqDetailsText.value.trim();
        
        if (isNaN(amount) || amount <= 0) {
            showToast("Amount must be a positive number", "error");
            return;
        }

        showToast("Broadcasting request...", "info");
        
        let accountImageUrl = null;
        if (requestFile) {
            try {
                accountImageUrl = await uploadFile('account-details', requestFile);
            } catch (err) {
                showToast("File process failed, creating text-only request", "error");
            }
        }

        try {
            const { error } = await supabase
                .from("deposits")
                .insert({
                    amount: amount,
                    account_text: text,
                    account_image_url: accountImageUrl,
                    status: "Available"
                });

            if (error) throw error;

            showToast("Request broadcasted successfully!", "success");
            
            // Clear inputs
            requestForm.reset();
            requestFile = null;
            if (reqFileStatus) {
                reqFileStatus.innerText = "Choose Bank Details Screenshot (Optional)";
                reqFileStatus.parentElement.classList.remove("file-selected");
            }
            fetchDeposits();
        } catch (err) {
            console.error("Request creation error:", err);
            alert("Failed to create request!\nError: " + (err.message || err));
            showToast("Failed to create request: " + (err.message || err), "error");
        }
    });

    // File selection UI Posting Accounts
    reqFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            requestFile = file;
            reqFileStatus.innerText = `Selected: ${file.name}`;
            reqFileStatus.parentElement.classList.add("file-selected");
        } else {
            requestFile = null;
            reqFileStatus.innerText = "Choose Bank Details Screenshot (Optional)";
            reqFileStatus.parentElement.classList.remove("file-selected");
        }
    });

    // File selection UI Depositor
    payFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            payFileStatus.innerText = `Selected: ${file.name}`;
            payFileStatus.parentElement.classList.add("file-selected");
        } else {
            payFileStatus.innerText = "Choose Transfer Receipt Slip (Required)";
            payFileStatus.parentElement.classList.remove("file-selected");
        }
    });

    // Person C: Claim Deposit Job
    async function claimDepositJob(id) {
        showToast("Claiming job...", "info");
        try {
            const { error } = await supabase
                .from("deposits")
                .update({
                    status: "Claimed",
                    claimed_at: new Date().toISOString()
                })
                .eq("id", id);

            if (error) throw error;
            showToast("Job claimed! Go execute transfer and upload slip.", "success");
            fetchDeposits();
        } catch (e) {
            console.error(e);
            showToast("Failed to claim: " + e.message, "error");
        }
    }

    // Person C: Payment Proof Modal Handlers
    function openPaymentModal(deposit) {
        selectedDeposit = deposit;
        paySubmitId.value = deposit.id;
        payAmountLabel.innerText = `₹${parseFloat(deposit.amount).toFixed(2)}`;
        payRef.value = deposit.deposit_reference || "";
        
        const isEdit = (deposit.status === "Paid" || deposit.status === "Verified");
        
        // Dynamically adjust file input requirement
        if (isEdit) {
            payFileInput.removeAttribute("required");
            if (payFileStatus) {
                payFileStatus.innerText = "Choose Transfer Receipt Slip (Optional)";
                payFileStatus.parentElement.classList.add("file-upload-label-optional");
                payFileStatus.parentElement.classList.remove("file-upload-label-required");
            }
            const submitBtn = paymentSubmitForm.querySelector("button[type='submit']");
            if (submitBtn) {
                submitBtn.innerHTML = `<i class="fas fa-save"></i> Save Changes`;
            }
            const modalTitle = paymentModal.querySelector(".modal-title span");
            if (modalTitle) {
                modalTitle.innerText = "Edit Transfer Proof";
            }
        } else {
            payFileInput.setAttribute("required", "required");
            if (payFileStatus) {
                payFileStatus.innerText = "Choose Transfer Receipt Slip (Required)";
                payFileStatus.parentElement.classList.remove("file-upload-label-optional");
                payFileStatus.parentElement.classList.add("file-upload-label-required");
            }
            const submitBtn = paymentSubmitForm.querySelector("button[type='submit']");
            if (submitBtn) {
                submitBtn.innerHTML = `<i class="fas fa-check"></i> Submit & Complete`;
            }
            const modalTitle = paymentModal.querySelector(".modal-title span");
            if (modalTitle) {
                modalTitle.innerText = "Submit Transfer Proof";
            }
        }
        
        paymentModal.classList.add("active");
    }

    btnCancelPayment.addEventListener("click", () => {
        paymentModal.classList.remove("active");
    });

    paymentSubmitForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const file = payFileInput.files[0];
        const targetId = parseInt(paySubmitId.value);
        if (isNaN(targetId)) {
            showToast("Error: No deposit selected", "error");
            return;
        }

        const deposit = depositsList.find(d => parseInt(d.id) === targetId);
        if (!deposit) {
            showToast("Error: Deposit not found", "error");
            return;
        }

        const isEdit = (deposit.status === "Paid" || deposit.status === "Verified");

        if (!file && !isEdit) {
            showToast("Please select/capture payment receipt slip image", "error");
            return;
        }

        showToast(isEdit ? "Updating payment details..." : "Uploading payment slip...", "info");
        paymentModal.classList.remove("active");

        try {
            let slipUrl = deposit.slip_image_url;
            if (file) {
                slipUrl = await uploadFile('deposit-slips', file);
            }
            
            const updates = {
                deposit_reference: payRef.value.trim(),
                rejection_reason: null, // Clear any previous rejection comment
            };

            if (file) {
                updates.slip_image_url = slipUrl;
            }

            if (!isEdit) {
                updates.status = "Verified";
                updates.paid_at = new Date().toISOString();
                updates.verified_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from("deposits")
                .update(updates)
                .eq("id", targetId);

            if (error) throw error;
            showToast(isEdit ? "Submission updated successfully!" : "Receipt submitted! Deposit completed.", "success");
            paymentSubmitForm.reset();
            if (payFileStatus) {
                payFileStatus.innerText = "Choose Transfer Receipt Slip (Required)";
                payFileStatus.parentElement.classList.remove("file-selected");
            }
            fetchDeposits();
        } catch (err) {
            console.error("Submit error details:", err);
            alert("Submit failed!\nError: " + (err.message || err) + "\nDetails: " + JSON.stringify(err));
            showToast("Submit failed: " + (err.message || err), "error");
        }
    });



    btnCancelRejection.addEventListener("click", () => {
        rejectionModal.classList.remove("active");
    });

    rejectionSubmitForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const targetId = parseInt(rejectSubmitId.value);
        const comment = rejectComment.value.trim();
        
        if (isNaN(targetId)) {
            showToast("Error: No deposit selected for rejection", "error");
            return;
        }
        if (!comment) {
            showToast("Please enter a rejection reason", "error");
            return;
        }

        showToast("Rejecting submission...", "info");
        rejectionModal.classList.remove("active");

        try {
            const { error } = await supabase
                .from("deposits")
                .update({
                    status: "Rejected",
                    rejection_reason: comment
                })
                .eq("id", targetId);

            if (error) throw error;
            showToast("Submission rejected & flagged.", "success");
            fetchDeposits();
        } catch (err) {
            console.error("Rejection error details:", err);
            alert("Rejection failed!\nError: " + (err.message || err));
            showToast("Rejection failed: " + (err.message || err), "error");
        }
    });

    // Person B: Admin Override Status
    async function overrideDepositStatus(id, newStatus) {
        showToast("Overriding status...", "info");
        
        const updates = { status: newStatus };
        if (newStatus === "Claimed") updates.claimed_at = new Date().toISOString();
        if (newStatus === "Paid") updates.paid_at = new Date().toISOString();
        if (newStatus === "Verified") updates.verified_at = new Date().toISOString();

        try {
            const { error } = await supabase
                .from("deposits")
                .update(updates)
                .eq("id", id);

            if (error) throw error;
            showToast("Ledger updated manually", "success");
            fetchDeposits();
        } catch (e) {
            console.error(e);
            showToast("Failed to override: " + e.message, "error");
        }
    }

    // Web Share / WhatsApp Mechanics
    async function shareToWhatsApp(deposit) {
        const text = `Deposit Confirmed! ✅\nID: DEP-${String(deposit.id).padStart(4, "0")}\nAmount: ₹${parseFloat(deposit.amount).toFixed(2)}\nRef: ${deposit.deposit_reference || 'N/A'}\nReceipt Proof: ${deposit.slip_image_url || 'No Image'}`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Bit Transfer Deposit Cleared',
                    text: text,
                    url: deposit.slip_image_url || undefined
                });
                showToast("Proof shared successfully!", "success");
            } catch (err) {
                // User cancelled or share failed, fallback to direct deep link
                openWhatsAppDeepLink(text);
            }
        } else {
            openWhatsAppDeepLink(text);
        }
    }

    function openWhatsAppDeepLink(text) {
        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
        showToast("Opened WhatsApp sharing template", "success");
    }

    // Lightbox modal handlers
    function openLightbox(url) {
        lightboxImg.src = url;
        lightboxFilters = { brightness: 100, contrast: 100, rotate: 0, zoom: 1 };
        applyLightboxTransformations();
        lightboxModal.classList.add("active");
    }

    function applyLightboxTransformations() {
        lightboxImg.style.transform = `scale(${lightboxFilters.zoom}) rotate(${lightboxFilters.rotate}deg)`;
        lightboxImg.style.filter = `brightness(${lightboxFilters.brightness}%) contrast(${lightboxFilters.contrast}%)`;
    }

    btnCloseLightbox.addEventListener("click", () => {
        lightboxModal.classList.remove("active");
    });

    toolLightRotate.addEventListener("click", () => {
        lightboxFilters.rotate = (lightboxFilters.rotate + 90) % 360;
        applyLightboxTransformations();
    });

    toolLightZoomIn.addEventListener("click", () => {
        lightboxFilters.zoom += 0.2;
        applyLightboxTransformations();
    });

    toolLightZoomOut.addEventListener("click", () => {
        if (lightboxFilters.zoom > 0.4) {
            lightboxFilters.zoom -= 0.2;
            applyLightboxTransformations();
        }
    });

    toolLightReset.addEventListener("click", () => {
        lightboxFilters = { brightness: 100, contrast: 100, rotate: 0, zoom: 1 };
        applyLightboxTransformations();
    });

    toolLightWhatsapp.addEventListener("click", () => {
        if (selectedDeposit) {
            shareToWhatsApp(selectedDeposit);
        } else {
            const mockText = `Receipt Proof: ${lightboxImg.src}`;
            openWhatsAppDeepLink(mockText);
        }
    });



    // Clear Ledger Workspace
    btnClearWorkspace.addEventListener("click", async () => {
        const confirmed = confirm("⚠️ WARNING: This will permanently delete all transaction requests and clear the database ledger. Do you want to proceed?");
        if (!confirmed) return;

        showToast("Clearing ledger workspace...", "info");
        try {
            // Delete all entries in deposits table
            const { error } = await supabase
                .from("deposits")
                .delete()
                .neq("id", 0);

            if (error) throw error;
            showToast("Workspace ledger cleared successfully!", "success");
            fetchDeposits();
        } catch (err) {
            console.error("Clear error details:", err);
            alert("Clear workspace failed!\nError: " + (err.message || err));
            showToast("Clear failed: " + (err.message || err), "error");
        }
    });

    // Toast creation utility
    function showToast(message, type = "success") {
        const container = document.getElementById("toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        
        let icon = "fa-check-circle";
        if (type === "error") icon = "fa-times-circle";
        if (type === "info") icon = "fa-info-circle";
        
        toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);
        
        // Remove toast automatically
        setTimeout(() => {
            toast.style.animation = "fadeOut 0.3s ease forwards";
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4000);
    }

    // Run Supabase initialization
    initSupabase();
});
