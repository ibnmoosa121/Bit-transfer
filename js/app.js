document.addEventListener('DOMContentLoaded', () => {
    const sign_in_btn = document.querySelector("#sign-in-btn");
    const sign_up_btn = document.querySelector("#sign-up-btn");
    const container = document.querySelector(".container");
    const signInForm = document.querySelector(".sign-in-form");
    const signUpForm = document.querySelector(".sign-up-form");

    // Switch to Sign Up form
    sign_up_btn.addEventListener("click", () => {
        container.classList.add("sign-up-mode");
    });

    // Switch to Sign In form
    sign_in_btn.addEventListener("click", () => {
        container.classList.remove("sign-up-mode");
    });

    // Sign In Form Validation
    signInForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const username = document.querySelector("#signin-username").value.trim();
        const password = document.querySelector("#signin-password").value.trim();
        
        if (username === "") {
            showError("Please enter your username");
            return;
        }
        
        if (password === "") {
            showError("Please enter your password");
            return;
        }
        
        // Here you would typically send the data to a server for authentication
        // For demo purposes, we'll just log the values and show a success message
        console.log("Sign In Attempt:", { username, password });
        showSuccess("Sign in successful!");
        
        // Simulate redirect after successful login
        // setTimeout(() => {
        //     window.location.href = "dashboard.html";
        // }, 2000);
    });

    // Sign Up Form Validation
    signUpForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const username = document.querySelector("#signup-username").value.trim();
        const email = document.querySelector("#signup-email").value.trim();
        const password = document.querySelector("#signup-password").value.trim();
        const confirmPassword = document.querySelector("#signup-confirm-password").value.trim();
        
        if (username === "") {
            showError("Please enter a username");
            return;
        }
        
        if (email === "") {
            showError("Please enter your email");
            return;
        } else if (!isValidEmail(email)) {
            showError("Please enter a valid email");
            return;
        }
        
        if (password === "") {
            showError("Please enter a password");
            return;
        } else if (password.length < 6) {
            showError("Password must be at least 6 characters");
            return;
        }
        
        if (confirmPassword === "") {
            showError("Please confirm your password");
            return;
        } else if (password !== confirmPassword) {
            showError("Passwords do not match");
            return;
        }
        
        // Here you would typically send the data to a server for registration
        // For demo purposes, we'll just log the values and show a success message
        console.log("Sign Up Attempt:", { username, email, password });
        showSuccess("Account created successfully!");
        
        // Simulate redirect after successful registration
        // setTimeout(() => {
        //     container.classList.remove("sign-up-mode");
        // }, 2000);
    });

    // Helper Functions
    function showError(message) {
        alert(message); // In a real app, you'd use a better UI for error messages
    }
    
    function showSuccess(message) {
        alert(message); // In a real app, you'd use a better UI for success messages
    }
    
    function isValidEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }
});
