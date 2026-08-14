document.addEventListener("DOMContentLoaded", () => {
  loadAppointmentsAndStaff();
  setupLogout();
  setupAddStaffForm();
});

let globalStaffList = [];

/**
 * 1. Load Appointments and Staff Data Parallelly
 */
async function loadAppointmentsAndStaff() {
  const token = localStorage.getItem("adminToken");

  if (!token) {
    window.location.href = "admin-login.html";
    return;
  }

  try {
    const [staffRes, appRes] = await Promise.all([
      fetch("/api/staff", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch("/api/appointments", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    // Process Staff Data
    if (staffRes.ok) {
      const staffData = await staffRes.json();
      const staffArray = Array.isArray(staffData)
        ? staffData
        : staffData.data || staffData.staff || [];
      if (Array.isArray(staffArray)) {
        globalStaffList = staffArray;
        renderStaffTable(globalStaffList);
      }
    } else {
      console.error(`Staff API Error: ${staffRes.status}`);
    }

    // Process Appointments Data
    if (appRes.ok) {
      const appData = await appRes.json();
      const appointments = Array.isArray(appData)
        ? appData
        : appData.data || appData.appointments || [];
      if (Array.isArray(appointments)) {
        renderAppointmentsTable(appointments);
        updateDashboardStats(appointments);
      }
    } else {
      console.error(`Appointments API Error: ${appRes.status}`);
      const tbody = document.getElementById("appointmentsTableBody");
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Failed to load appointments (Error ${appRes.status}).</td></tr>`;
      }
    }
  } catch (error) {
    console.error("Data load karne me error aaya:", error);
  }
}

/**
 * 2. Render Appointments Table
 */
function renderAppointmentsTable(appointments) {
  const tbody = document.getElementById("appointmentsTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!appointments || appointments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Koi bookings nahi mili.</td></tr>`;
    return;
  }

  appointments.forEach((app) => {
    const appId = app.id || app._id;
    const assignedStaffId = app.assignedToStaffId || app.assignedToId || "";
    const assignedStaffName =
      app.assignedToStaffName || app.assignedToName || "";

    // Generate Staff Dropdown Options
    let staffOptions = `<option value="">Select Staff</option>`;
    globalStaffList.forEach((staff) => {
      const staffId = staff.id || staff._id;
      const selected =
        String(assignedStaffId) === String(staffId) ? "selected" : "";
      staffOptions += `<option value="${staffId}" data-name="${staff.name}" ${selected}>${staff.name}</option>`;
    });

    // Dynamic Status Badge
    let badgeClass = "bg-warning text-dark";
    const currentStatus = app.status || "Pending";

    switch (currentStatus) {
      case "Confirmed":
      case "Assigned":
        badgeClass = "bg-info text-dark";
        break;
      case "In Progress":
        badgeClass = "bg-primary";
        break;
      case "Completed":
        badgeClass = "bg-success";
        break;
      case "Cancelled":
      case "No-Show":
        badgeClass = "bg-danger";
        break;
      default:
        badgeClass = "bg-warning text-dark";
    }

    const row = document.createElement("tr");
    row.innerHTML = `
            <td><strong>${app.name || app.customerName || "N/A"}</strong></td>
            <td>${app.phone || "N/A"}</td>
            <td>${app.serviceName || app.service || "N/A"}</td>
            <td>
                <div>${app.date || "N/A"}</div>
                <small class="text-muted">${app.time || ""}</small>
            </td>
            <td><span class="badge ${badgeClass}">${currentStatus}</span></td>
            <td>
                <div class="d-flex align-items-center justify-content-center gap-2">
                    <select id="staffSelect-${appId}" class="form-select form-select-sm" style="max-width: 160px;">
                        ${staffOptions}
                    </select>
                    <button id="assignBtn-${appId}" onclick="assignTask('${appId}')" class="btn btn-sm btn-primary">
                        Assign
                    </button>
                </div>
                ${assignedStaffName ? `<small class="text-success d-block mt-1">Assigned to: <b>${assignedStaffName}</b></small>` : ""}
            </td>
        `;
    tbody.appendChild(row);
  });
}

/**
 * 3. Render Staff List Table
 */
function renderStaffTable(staffList) {
  const tbody = document.getElementById("staffTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!staffList || staffList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-muted">Koi staff member nahi hai.</td></tr>`;
    return;
  }

  staffList.forEach((staff) => {
    const row = document.createElement("tr");
    row.innerHTML = `
            <td><strong>${staff.name}</strong></td>
            <td>${staff.email}</td>
            <td><span class="badge bg-secondary">Staff Member</span></td>
        `;
    tbody.appendChild(row);
  });
}

/**
 * 4. Update Dashboard Stats Cards
 */
function updateDashboardStats(appointments) {
  const total = appointments.length;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const today = appointments.filter((a) => a.date === todayStr).length;
  const confirmed = appointments.filter(
    (a) => a.status === "Confirmed" || a.status === "Assigned",
  ).length;
  const completed = appointments.filter((a) => a.status === "Completed").length;
  const cancelled = appointments.filter((a) => a.status === "Cancelled").length;
  const noShow = appointments.filter((a) => a.status === "No-Show").length;

  if (document.getElementById("statTotal"))
    document.getElementById("statTotal").innerText = total;
  if (document.getElementById("statToday"))
    document.getElementById("statToday").innerText = today;
  if (document.getElementById("statConfirmed"))
    document.getElementById("statConfirmed").innerText = confirmed;
  if (document.getElementById("statCompleted"))
    document.getElementById("statCompleted").innerText = completed;
  if (document.getElementById("statCancelled"))
    document.getElementById("statCancelled").innerText = cancelled;
  if (document.getElementById("statNoShow"))
    document.getElementById("statNoShow").innerText = noShow;
}

/**
 * 5. Assign Task Function
 */
async function assignTask(appointmentId) {
  const token = localStorage.getItem("adminToken");
  const selectElement = document.getElementById(`staffSelect-${appointmentId}`);
  const assignBtn = document.getElementById(`assignBtn-${appointmentId}`);

  if (!selectElement) return;

  const staffId = selectElement.value;
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  const staffName = selectedOption
    ? selectedOption.getAttribute("data-name")
    : "";

  if (!staffId) {
    alert("Kripya pehle staff member select karein!");
    return;
  }

  if (assignBtn) {
    assignBtn.disabled = true;
    assignBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span>`;
  }

  try {
    const response = await fetch(`/api/appointments/${appointmentId}/assign`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        assignedToStaffId: staffId,
        assignedToStaffName: staffName,
      }),
    });

    const result = await response.json();

    if (response.ok && result.success !== false) {
      alert(result.message || "Appointment successfully assigned!");
      await loadAppointmentsAndStaff();
    } else {
      alert("Error: " + (result.message || "Failed to assign staff."));
    }
  } catch (error) {
    console.error("Assign request fail hui:", error);
    alert("Server error occurred while assigning appointment.");
  } finally {
    if (assignBtn) {
      assignBtn.disabled = false;
      assignBtn.innerText = "Assign";
    }
  }
}

/**
 * 6. Add Staff Form Setup (POST /api/staff)
 */
function setupAddStaffForm() {
  const form = document.getElementById("addStaffForm");
  if (!form) return;

  const alertBox = document.getElementById("staffAlertBox");
  const saveBtn = document.getElementById("saveStaffBtn");

  function showStaffAlert(message, type) {
    if (!alertBox) return;
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
    alertBox.classList.remove("d-none");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("adminToken");
    const name = document.getElementById("staffName").value.trim();
    const email = document.getElementById("staffEmail").value.trim();
    const password = document.getElementById("staffPassword").value;

    if (!name || !email || !password) {
      showStaffAlert("Sabhi required fields bharna zaroori hai.", "danger");
      return;
    }

    const originalText = saveBtn ? saveBtn.innerHTML : "";
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span> Creating...`;
    }

    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminData");
        window.location.href = "admin-login.html";
        return;
      }

      const result = await response.json();

      if (response.ok && result.success) {
        showStaffAlert(
          result.message || "Staff account created!",
          "success",
        );
        form.reset();

        const modalEl = document.getElementById("addStaffModal");
        const modalInstance =
          window.bootstrap && modalEl
            ? window.bootstrap.Modal.getOrCreateInstance(modalEl)
            : null;
        if (modalInstance) modalInstance.hide();

        await loadAppointmentsAndStaff();
      } else {
        showStaffAlert(
          result.message || "Staff account create nahi ho saka.",
          "danger",
        );
      }
    } catch (error) {
      console.error("Error creating staff:", error);
      showStaffAlert(
        "Network error. Please check if the server is running.",
        "danger",
      );
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
      }
    }
  });
}

/**
 * 7. Logout Setup
 */
function setupLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminData");
      window.location.href = "admin-login.html";
    });
  }
}
