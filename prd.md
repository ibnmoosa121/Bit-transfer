roduct Requirement Document (PRD)
Project: Live Deposit Clearinghouse Portal
1. Overview & Objective
A lightweight, mobile-first web application designed to eliminate WhatsApp coordination chaos between three specific roles: Person A (Requester/Receiver), Person C (The Depositor), and Person B (Admin/Monitor). The app functions as a live ledger tracking the lifecycle of money deposits without requiring rigid user login credentials.

2. User Roles & Workflows
[Person A creates Request] ➔ [Person C Claims: "Claimed"] ➔ [Person C Deposits: "Paid" + Slip] ➔ [Person A Closes: "Verified" + Share to WhatsApp]

👤 Person A (The Requester)
Goal: Request deposits into various changing bank accounts, track fulfillment, and export proof to WhatsApp.

Workflow:

Inputs a mandatory Amount and drops either Raw Text or an Image containing bank details.

Monitors the live dashboard. Sees when Person C claims an account and when they finish the deposit.

Once completed, views the uploaded payment slip, hits a native "Share to WhatsApp" action or copies the slip to quickly update their external groups.

👤 Person C (The Depositor)
Goal: Claim available deposit jobs, complete the bank transfers, and upload proof.

Workflow:

Views the pool of active requests posted by Person A.

Taps "Claim / Mark Yes" on a request to flag that they are working on it. (Status shifts from Available to Claimed).

Transfers the funds, uploads the receipt image, adds any optional reference notes, and marks it "Completed". (Status shifts to Paid).

👤 Person B (The Admin / You)
Goal: Monitor the absolute state of the pipeline, resolve discrepancies, and pull clean financial analytics.

Workflow:

Reviews a master feed of all historical data.

Can override or edit any status manually if a mistake is made.

Generates a clear report of total deposits filtered by date range and calculates volume.

3. Application Status Lifecycle
To prevent collisions, every deposit request moves through these strict states:

🔴 Available: Person A just posted it. Person C can see it.

🟡 Claimed: Person C marked "Yes" (they are actively executing the bank transfer). It is locked so other depositors don't duplicate it.

🔵 Paid: Person C uploaded the receipt slip and clicked complete.

🟢 Verified: Person A acknowledged it, copied the proof, and the transaction is closed out.

4. Screen-by-Screen UI Features (Mobile-First Layout)
The entire application runs on a clean, single-scroll dashboard that adapts sections based on who opens the app link.

Header Section (Person A Input): Sticky input block optimized for thumbs. Big paste text box, native camera upload clicker, and a large number pad input for Amount.

The Live Pipeline (Person C Interaction): Interactive vertical cards. Buttons are oversized for clean mobile tapping ([ Claim Deposit ], [ Upload Slip ]).

Image Lightbox Modal: Tapping any slip thumbnail opens a full-screen mobile view allowing quick zoom, long-press to save, or a one-click "Share to WhatsApp" trigger using the Web Share API.

5. Backend Architecture with Supabase
Supabase is highly recommended for this project. It provides everything needed to manage files, database states, and real-time triggers natively without a heavy, manual Node.js backend.

A. Database Schema (deposits table)
A single table handles this lightweight data workflow.

CREATE TABLE deposits (
    id SERIAL PRIMARY KEY,
    amount NUMERIC(12, 2) NOT NULL,
    exchange_rate NUMERIC(10, 4) DEFAULT 1.0000, -- Helpful for Person B's reporting later
    
    -- Inputs from Person A
    account_text TEXT,
    account_image_url TEXT, -- Pointing to Supabase Storage Bucket
    
    -- Inputs from Person C
    slip_image_url TEXT, -- Pointing to Supabase Storage Bucket
    deposit_reference VARCHAR(100),
    
    -- State Management
    status VARCHAR(20) DEFAULT 'Available', -- Available, Claimed, Paid, Verified
    
    -- Timestamps for accountability
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE
);

B. Storage Buckets (File Management)
You will create two folders or buckets within Supabase Storage:

/account-details/: Holds the bank screenshots uploaded by Person A.

/deposit-slips/: Holds the receipt photos uploaded by Person C.
Supabase generates public URLs for these images so your frontend app can immediately load them in thumbnails or send them to the WhatsApp sharing module.

C. Real-Time Subscription (Crucial Feature)
Because Person A needs to follow the page closely for updates without constantly swiping down to refresh, you will enable Supabase Realtime on the deposits table.

The moment Person C clicks "Completed" on their phone, Person A's screen will instantly turn blue/green and pop the new image into view dynamically using live database listening.

6. WhatsApp Integration Mechanics
Since a key requirement is Person A sending confirmation messages out to WhatsApp easily from their mobile browser, the app will use two features:

Web Share API: When Person A hits "Share to WhatsApp", the mobile device's native sharing sheet opens up, allowing them to pass the image link or text directly to any WhatsApp chat.

Custom Deep Links: A button mapping to https://wa.me/?text=Deposit%20Confirmed... can instantly generate a structured message along with the Supabase image URL of the receipt slip to auto-open WhatsApp.