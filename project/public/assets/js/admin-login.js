document.addEventListener("DOMContentLoaded", () => {
  // 1. Auto-redirect if the user is already logged in
  checkExistingSession();

  const loginForm = document.getElementById("adminLoginForm");
  const loginBtn = document.getElementById("loginBtn");
  const loginMessage = document.getElementById("loginMessage");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Fetch input values
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      if (!email || !password) {
        showMessage("Email and password are required.", "danger");
        return;
      }

      // Set UI Loading State
      const originalText = loginBtn.innerHTML;
      loginBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2" role="status"></span> Logging in...';
      loginBtn.disabled = true;
      hideMessage();

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Local Storage setup
          localStorage.setItem("adminToken", result.token);
          localStorage.setItem("adminData", JSON.stringify(result.user || {}));

          showMessage("Login successful! Redirecting...", "success");

          // Role-Based Redirection Logic (Fixed syntax)
          const rawRole =
            (result.user && (result.user.role || result.user.type)) || "";
          const userRole = String(rawRole).toLowerCase();
          const redirectTo =
            userRole === "staff"
              ? "/staff-dashboard.html"
              : "/admin-dashboard.html";

          setTimeout(() => {
            window.location.href = redirectTo;
          }, 800);
        } else {
          // Fixed syntax for fallback message
          showMessage(result.message || "Invalid login details.", "danger");
          resetBtnState(loginBtn, originalText);
        }
      } catch (error) {
        console.error("Login Error:", error);
        showMessage(
          "Network error. Please check if the server is running.",
          "danger",
        );
        resetBtnState(loginBtn, originalText);
      }
    });
  }

  // Helper: Show Message Alert
  function showMessage(msg, type) {
    if (!loginMessage) return;
    loginMessage.className = `alert alert-${type}`;
    loginMessage.textContent = msg;
    loginMessage.classList.remove("d-none");
  }

  // Helper: Hide Message Alert
  function hideMessage() {
    if (!loginMessage) return;
    loginMessage.className = "alert d-none";
  }

  // Helper: Reset Button State
  function resetBtnState(btn, text) {
    if (!btn) return;
    btn.innerHTML = text;
    btn.disabled = false;
  }

  // Helper: Auto-redirect if token exists
  function checkExistingSession() {
    const token = localStorage.getItem("adminToken");
    const userData = localStorage.getItem("adminData");

    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        // Fixed syntax for role check
        const role = String(user.role || user.type || "").toLowerCase();
        window.location.href =
          role === "staff" ? "/staff-dashboard.html" : "/admin-dashboard.html";
      } catch (e) {
        // If invalid JSON, clear storage
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminData");
      }
    }
  }
});
