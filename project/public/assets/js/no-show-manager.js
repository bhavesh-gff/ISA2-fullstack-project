// public/assets/js/no-show-manager.js

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("adminToken");
  if (!token) {
    window.location.href = "/admin-login.html";
    return;
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminData");
      window.location.href = "/admin-login.html";
    });
  }

  loadRepeatOffenders();
  loadAppointments();
});

// Helper XSS Sanitizer
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 1. Repeat offenders list load karein
async function loadRepeatOffenders() {
  const token = localStorage.getItem("adminToken");
  const tableBody = document.getElementById("repeatTableBody");

  if (!tableBody) return;

  try {
    const response = await fetch("/api/noshows/repeat", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("adminToken");
      window.location.href = "/admin-login.html";
      return;
    }

    const result = await response.json();

    if (result.success) {
      const offenders = result.data || [];
      if (offenders.length === 0) {
        tableBody.innerHTML =
          '<tr><td colspan="4" class="text-center py-3 text-muted">Zero repeat offenders found.</td></tr>';
        return;
      }
      tableBody.innerHTML = offenders
        .map(
          (o) => `
                <tr>
                    <td class="fw-bold">${escapeHtml(o.name)}</td>
                    <td>${escapeHtml(o.phone)}</td>
                    <td><span class="badge bg-danger">${o.noShowCount || 0}</span></td>
                    <td>${escapeHtml(o.lastNoShowDate || "N/A")}</td>
                </tr>
            `,
        )
        .join("");
    } else {
      tableBody.innerHTML =
        '<tr><td colspan="4" class="text-center text-danger py-3">Failed to load repeat offenders.</td></tr>';
    }
  } catch (error) {
    console.error("Error loading repeat offenders:", error);
    tableBody.innerHTML =
      '<tr><td colspan="4" class="text-center text-danger py-3">Error loading data. Check server connection.</td></tr>';
  }
}

// 2. Saari appointments load karein taaki manually No-Show mark kar sake
async function loadAppointments() {
  const token = localStorage.getItem("adminToken");
  const tableBody = document.getElementById("appointmentsTableBody");

  if (!tableBody) return;

  try {
    const response = await fetch("/api/appointments", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("adminToken");
      window.location.href = "/admin-login.html";
      return;
    }

    const result = await response.json();

    if (result.success) {
      const bookings = result.data || [];
      if (bookings.length === 0) {
        tableBody.innerHTML =
          '<tr><td colspan="6" class="text-center py-3 text-muted">No bookings found.</td></tr>';
        return;
      }

      tableBody.innerHTML = bookings
        .map((b) => {
          const bookingId = b.id || b._id;
          let badgeColor = "bg-warning text-dark";

          if (b.status === "Completed") badgeColor = "bg-success";
          if (b.status === "No-Show") badgeColor = "bg-danger";
          if (b.status === "Cancelled" || b.status === "Rejected")
            badgeColor = "bg-secondary";
          if (b.status === "Confirmed") badgeColor = "bg-info text-dark";

          return `
                    <tr>
                        <td class="fw-bold">${escapeHtml(b.name)}</td>
                        <td>${escapeHtml(b.phone)}</td>
                        <td>${escapeHtml(b.service)}</td>
                        <td>${escapeHtml(b.date)} <br><small class="text-muted fw-bold">${escapeHtml(b.time)}</small></td>
                        <td><span class="badge ${badgeColor}">${escapeHtml(b.status || "Pending")}</span></td>
                        <td>
                            ${
                              b.status === "No-Show"
                                ? '<span class="text-muted small">Already marked</span>'
                                : `<button class="btn btn-outline-danger btn-sm" onclick="markNoShow('${bookingId}')">Mark No-Show</button>`
                            }
                        </td>
                    </tr>
                `;
        })
        .join("");
    } else {
      tableBody.innerHTML =
        '<tr><td colspan="6" class="text-center text-danger py-3">Failed to load appointments.</td></tr>';
    }
  } catch (error) {
    console.error("Error loading appointments:", error);
    tableBody.innerHTML =
      '<tr><td colspan="6" class="text-center text-danger py-3">Error loading data. Check server connection.</td></tr>';
  }
}

// 3. Ek appointment ko No-Show mark karein
async function markNoShow(id) {
  if (!id || !confirm("Mark this appointment as No-Show?")) return;

  const token = localStorage.getItem("adminToken");

  try {
    const response = await fetch(`/api/noshows/${id}/noshow`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("adminToken");
      window.location.href = "/admin-login.html";
      return;
    }

    const result = await response.json();

    if (result.success) {
      alert(result.message || "Status updated to No-Show successfully.");
      loadRepeatOffenders();
      loadAppointments();
    } else {
      alert("Error: " + (result.message || "Failed to update status."));
    }
  } catch (error) {
    console.error("Error marking no-show:", error);
    alert("Failed to mark no-show. Server error.");
  }
}

// Global scope export for inline event handlers
window.markNoShow = markNoShow;
