// public/assets/js/manage-services.js

let serviceModalInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  // 1. Login check (admin token required)
  const token = localStorage.getItem("adminToken");
  if (!token) {
    window.location.href = "/admin-login.html";
    return;
  }

  const modalEl = document.getElementById("serviceModal");
  if (modalEl) {
    serviceModalInstance = new bootstrap.Modal(modalEl);
  }

  // 2. Logout functionality
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminData");
      window.location.href = "/admin-login.html";
    });
  }

  // 3. Form submission (Create & Edit)
  const serviceForm = document.getElementById("serviceForm");
  if (serviceForm) {
    serviceForm.addEventListener("submit", handleServiceSubmit);
  }

  // Initial Data Fetch
  loadServices();
});

// Utility Alert Display
function showAlert(message, type = "success") {
  const alertBox = document.getElementById("alertBox");
  if (!alertBox) return;

  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = message;
  alertBox.classList.remove("d-none");

  setTimeout(() => {
    alertBox.classList.add("d-none");
  }, 3000);
}

// 4. Fetch and render all services in table
async function loadServices() {
  const token = localStorage.getItem("adminToken");
  const tableBody = document.getElementById("servicesTableBody");

  if (!tableBody) return;

  try {
    const response = await fetch("/api/services", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("adminToken");
      window.location.href = "/admin-login.html";
      return;
    }

    const result = await response.json();

    if (!result.success) {
      tableBody.innerHTML =
        '<tr><td colspan="5" class="text-center text-danger py-3">Failed to load services.</td></tr>';
      return;
    }

    const services = result.data || [];

    if (services.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="5" class="text-center text-muted py-3">No services added yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = services
      .map((s) => {
        const serviceId = s.id || s._id;
        const priceVal = Number(s.price || 0).toFixed(2);
        // Escape special chars for safer attribute passing
        const serviceDataEscaped = encodeURIComponent(JSON.stringify(s));

        return `
                <tr>
                    <td class="fw-bold">${escapeHtml(s.name)}</td>
                    <td>₹${priceVal}</td>
                    <td>${escapeHtml(s.duration || "N/A")}</td>
                    <td class="text-muted small">${escapeHtml(s.description || "")}</td>
                    <td class="text-center">
                        <button class="btn btn-outline-primary btn-sm me-1" onclick="triggerEdit('${serviceDataEscaped}')">Edit</button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deleteService('${serviceId}')">Delete</button>
                    </td>
                </tr>
            `;
      })
      .join("");
  } catch (error) {
    console.error("Error loading services:", error);
    tableBody.innerHTML =
      '<tr><td colspan="5" class="text-center text-danger py-3">Server error. Check backend connection.</td></tr>';
  }
}

// 5. Open Modal for Adding New Service
function openCreateModal() {
  document.getElementById("serviceModalTitle").textContent = "Add New Service";
  document.getElementById("serviceId").value = "";
  document.getElementById("serviceName").value = "";
  document.getElementById("servicePrice").value = "";
  document.getElementById("serviceDuration").value = "";
  document.getElementById("serviceDescription").value = "";

  if (serviceModalInstance) {
    serviceModalInstance.show();
  }
}

// Trigger Helper for Escaped Edit Data
function triggerEdit(encodedData) {
  try {
    const service = JSON.parse(decodeURIComponent(encodedData));
    openEditModal(service);
  } catch (e) {
    console.error("Failed to parse service data:", e);
  }
}

// 6. Open Modal Pre-filled for Editing
function openEditModal(service) {
  document.getElementById("serviceModalTitle").textContent = "Edit Service";
  document.getElementById("serviceId").value = service.id || service._id || "";
  document.getElementById("serviceName").value = service.name || "";
  document.getElementById("servicePrice").value = service.price || "";
  document.getElementById("serviceDuration").value = service.duration || "";
  document.getElementById("serviceDescription").value =
    service.description || "";

  if (serviceModalInstance) {
    serviceModalInstance.show();
  }
}

// 7. Handle Form Submit (POST / PUT)
async function handleServiceSubmit(e) {
  e.preventDefault();

  const token = localStorage.getItem("adminToken");
  const id = document.getElementById("serviceId").value;

  const payload = {
    name: document.getElementById("serviceName").value.trim(),
    price: document.getElementById("servicePrice").value,
    duration: document.getElementById("serviceDuration").value.trim(),
    description: document.getElementById("serviceDescription").value.trim(),
  };

  if (!payload.name || !payload.price) {
    showAlert("Service name and price are required.", "danger");
    return;
  }

  const isEdit = Boolean(id);
  const url = isEdit ? `/api/services/${id}` : "/api/services";
  const method = isEdit ? "PUT" : "POST";

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("adminToken");
      window.location.href = "/admin-login.html";
      return;
    }

    const result = await response.json();

    if (result.success) {
      if (serviceModalInstance) serviceModalInstance.hide();
      showAlert(result.message || "Saved successfully!", "success");
      loadServices();
    } else {
      showAlert(result.message || "Something went wrong.", "danger");
    }
  } catch (error) {
    console.error("Error saving service:", error);
    showAlert("Server error while saving service.", "danger");
  }
}

// 8. Delete Service
async function deleteService(id) {
  if (!id || !confirm("Are you sure you want to delete this service?")) return;

  const token = localStorage.getItem("adminToken");

  try {
    const response = await fetch(`/api/services/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("adminToken");
      window.location.href = "/admin-login.html";
      return;
    }

    const result = await response.json();

    if (result.success) {
      showAlert(result.message || "Service deleted successfully.", "success");
      loadServices();
    } else {
      showAlert(result.message || "Failed to delete service.", "danger");
    }
  } catch (error) {
    console.error("Error deleting service:", error);
    showAlert("Server error while deleting service.", "danger");
  }
}

// XSS Sanitizer Helper
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Export functions to Window Scope for inline onclick events
window.openCreateModal = openCreateModal;
window.openEditModal = openEditModal;
window.triggerEdit = triggerEdit;
window.deleteService = deleteService;
