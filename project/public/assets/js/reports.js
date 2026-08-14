// public/assets/js/reports.js

let currentPeriod = "daily";

document.addEventListener("DOMContentLoaded", () => {
  // 1. Auth check
  const token = localStorage.getItem("adminToken");
  if (!token) {
    window.location.href = "/admin-login.html";
    return;
  }

  // 2. Logout handler
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminData");
      window.location.href = "/admin-login.html";
    });
  }

  // Initial load
  loadReport();
});

// XSS Sanitizer Helper
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Format numbers into standard INR currency format
function formatCurrency(amount) {
  const numericAmount = Number(amount || 0);
  return `₹${numericAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Switch between 'daily' and 'monthly' period
function switchPeriod(period) {
  currentPeriod = period;

  const dailyBtn = document.getElementById("dailyBtn");
  const monthlyBtn = document.getElementById("monthlyBtn");
  const periodHeader = document.getElementById("periodColHeader");

  if (dailyBtn) dailyBtn.classList.toggle("active", period === "daily");
  if (monthlyBtn) monthlyBtn.classList.toggle("active", period === "monthly");
  if (periodHeader)
    periodHeader.textContent = period === "daily" ? "Date" : "Month";

  loadReport();
}

// Fetch and render analytics data
async function loadReport() {
  const token = localStorage.getItem("adminToken");
  const tableBody = document.getElementById("reportTableBody");

  if (tableBody) {
    tableBody.innerHTML =
      '<tr><td colspan="3" class="text-center py-3 text-muted">Loading analytics data...</td></tr>';
  }

  try {
    const response = await fetch(
      `/api/dashboard/report?period=${currentPeriod}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("adminToken");
      window.location.href = "/admin-login.html";
      return;
    }

    const result = await response.json();

    if (!result.success) {
      if (tableBody) {
        tableBody.innerHTML =
          '<tr><td colspan="3" class="text-center text-danger py-3">Failed to load report.</td></tr>';
      }
      return;
    }

    const {
      report = [],
      totalRevenue = 0,
      topBookedService,
      topBookedServiceCount = 0,
    } = result.data || {};

    // Update KPI Cards safely
    const totalRevenueEl = document.getElementById("totalRevenue");
    if (totalRevenueEl) {
      totalRevenueEl.textContent = formatCurrency(totalRevenue);
    }

    const topServiceEl = document.getElementById("topService");
    if (topServiceEl) {
      topServiceEl.textContent = topBookedService
        ? escapeHtml(topBookedService)
        : "N/A";
    }

    const topServiceCountEl = document.getElementById("topServiceCount");
    if (topServiceCountEl) {
      topServiceCountEl.textContent = topBookedService
        ? `${topBookedServiceCount} booking(s)`
        : "";
    }

    const totalCompleted = report.reduce(
      (sum, r) => sum + Number(r.totalBookings || 0),
      0,
    );
    const completedBookingsEl = document.getElementById(
      "totalCompletedBookings",
    );
    if (completedBookingsEl) {
      completedBookingsEl.textContent = totalCompleted;
    }

    if (!tableBody) return;

    if (report.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="3" class="text-center text-muted py-3">No completed bookings found for the selected period.</td></tr>';
      return;
    }

    tableBody.innerHTML = report
      .map(
        (r) => `
            <tr>
                <td class="fw-bold">${escapeHtml(r.period)}</td>
                <td>${r.totalBookings || 0}</td>
                <td>${formatCurrency(r.revenue)}</td>
            </tr>
        `,
      )
      .join("");
  } catch (error) {
    console.error("Error loading report:", error);
    if (tableBody) {
      tableBody.innerHTML =
        '<tr><td colspan="3" class="text-center text-danger py-3">Server error. Check backend connection.</td></tr>';
    }
  }
}

// Global scope bindings for inline event listeners
window.switchPeriod = switchPeriod;
