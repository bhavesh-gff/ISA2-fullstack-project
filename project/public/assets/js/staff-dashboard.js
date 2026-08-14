// public/assets/js/staff-dashboard.js

document.addEventListener("DOMContentLoaded", () => {
  // 1. Login check (same 'adminToken' key used for both admin & staff sessions)
  const token = localStorage.getItem("adminToken");
  const staffData = JSON.parse(localStorage.getItem("adminData") || "{}");

  if (!token) {
    window.location.href = "/admin-login.html";
    return;
  }

  // Agar admin galti se yahan aa gaya, toh admin dashboard bhej dein
  if (staffData.role !== "staff") {
    window.location.href = "/admin-dashboard.html";
    return;
  }

  const nameLabel = document.getElementById("staffNameLabel");
  if (nameLabel) nameLabel.textContent = `Hi, ${staffData.name || "Staff"}`;

  // 2. Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminData");
      window.location.href = "/admin-login.html";
    });
  }

  loadMyAppointments();
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

// 3. Staff ki apni appointments load karein
async function loadMyAppointments() {
  const token = localStorage.getItem("adminToken");
  const tableBody = document.getElementById("myAppointmentsTableBody");

  if (!tableBody) return;

  try {
    const response = await fetch("/api/appointments", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminData");
      window.location.href = "/admin-login.html";
      return;
    }

    const result = await response.json();

    if (!result.success) {
      tableBody.innerHTML =
        '<tr><td colspan="6" class="text-center text-danger py-3">Failed to load appointments.</td></tr>';
      return;
    }

    const appointments = result.data || [];
    renderStats(appointments);

    if (appointments.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted py-3">Aapko abhi tak koi appointment assign nahi hui.</td></tr>';
      return;
    }

    tableBody.innerHTML = appointments
      .map((b) => {
        const bookingId = b.id || b._id;
        let badgeColor = "bg-warning text-dark";

        if (b.status === "Completed") badgeColor = "bg-success";
        if (b.status === "No-Show") badgeColor = "bg-danger";
        if (b.status === "Cancelled" || b.status === "Rejected")
          badgeColor = "bg-secondary";
        if (b.status === "Confirmed") badgeColor = "bg-info text-dark";
        if (b.status === "In Progress") badgeColor = "bg-primary";

        const status = b.status || "Pending";
        let actions = '<span class="text-muted small">No action</span>';

        if (status === "Pending") {
          actions = `
                    <button class="btn btn-success btn-sm me-1" onclick="updateAppointmentStatus('${bookingId}', 'Confirmed')">✔ Confirm</button>
                    <button class="btn btn-outline-danger btn-sm" onclick="updateAppointmentStatus('${bookingId}', 'Rejected')">✖ Reject</button>
                `;
        } else if (status === "Confirmed") {
          actions = `
                    <button class="btn btn-success btn-sm me-1" onclick="updateAppointmentStatus('${bookingId}', 'Completed')">Mark Completed</button>
                    <button class="btn btn-outline-danger btn-sm" onclick="updateAppointmentStatus('${bookingId}', 'No-Show')">Mark No-Show</button>
                `;
        } else if (status === "Assigned") {
          // New workflow: staff starts the service on an assigned appointment
          actions = `
                    <button class="btn btn-primary btn-sm" onclick="updateAppointmentStatus('${bookingId}', 'In Progress')">Start Service</button>
                `;
        } else if (status === "In Progress") {
          // New workflow: staff completes the service
          actions = `
                    <button class="btn btn-success btn-sm" onclick="updateAppointmentStatus('${bookingId}', 'Completed')">Complete Service</button>
                `;
        } else if (status === "Completed") {
          actions = `<span class="text-success fw-semibold small">Completed ✔</span>`;
        } else if (status === "No-Show") {
          actions = `<span class="text-muted small">Already Marked</span>`;
        }

        return `
                <tr>
                    <td class="fw-bold">${escapeHtml(b.name)}</td>
                    <td>${escapeHtml(b.phone)}</td>
                    <td>${escapeHtml(b.service)}</td>
                    <td>${escapeHtml(b.date)} <br><small class="fw-bold text-muted">${escapeHtml(b.time)}</small></td>
                    <td><span class="badge ${badgeColor}">${escapeHtml(status)}</span></td>
                    <td>${actions}</td>
                </tr>
            `;
      })
      .join("");
  } catch (error) {
    console.error("Error loading appointments:", error);
    tableBody.innerHTML =
      '<tr><td colspan="6" class="text-center text-danger py-3">Server error. Check backend connection.</td></tr>';
  }
}

// Render Summary Metrics Cards safely
function renderStats(appointments) {
  const count = (status) =>
    appointments.filter((a) => (a.status || "Pending") === status).length;

  const pendingEl = document.getElementById("statPending");
  const confirmedEl = document.getElementById("statConfirmed");
  const completedEl = document.getElementById("statCompleted");
  const noShowEl = document.getElementById("statNoShow");

  if (pendingEl) pendingEl.textContent = count("Pending");
  if (confirmedEl) confirmedEl.textContent = count("Confirmed");
  if (completedEl) completedEl.textContent = count("Completed");
  if (noShowEl) noShowEl.textContent = count("No-Show");
}

// 4. Appointment status update karein (Confirm / Reject / Completed / No-Show)
async function updateAppointmentStatus(id, status) {
  if (!id || !confirm(`Mark this appointment as ${status}?`)) return;

  const token = localStorage.getItem("adminToken");

  try {
    const response = await fetch(`/api/appointments/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminData");
      window.location.href = "/admin-login.html";
      return;
    }

    const result = await response.json();

    if (result.success) {
      alert(result.message || "Status updated successfully.");
      loadMyAppointments();
    } else {
      alert("Error: " + (result.message || "Failed to update status."));
    }
  } catch (error) {
    console.error("Error updating status:", error);
    alert("Failed to update status. Server error.");
  }
}
// Explicit global binding for dynamically generated onclick handlers
window.updateAppointmentStatus = updateAppointmentStatus;
