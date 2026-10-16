
const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const dashboardMessage = document.getElementById("dashboardMessage");
const complaintsTableBody = document.getElementById("complaintsTableBody");

let complaints = [];

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || data.error || "Request failed");
    }

    return data;
}

function showDashboard() {
    loginSection.hidden = true;
    dashboardSection.hidden = false;
    loadDashboard();
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginMessage.textContent = "Logging in...";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
        await apiRequest("/api/admin/login", {
            method: "POST",
            body: JSON.stringify({ username, password })
        });

        loginForm.reset();
        loginMessage.textContent = "";
        showDashboard();
    } catch (error) {
        loginMessage.textContent = error.message;
    }
});

async function checkLogin() {
    try {
        await apiRequest("/api/admin/me");
        showDashboard();
    } catch {
        loginSection.hidden = false;
        dashboardSection.hidden = true;
    }
}

async function loadDashboard() {
    dashboardMessage.textContent = "Loading complaints...";

    try {
        const stats = await apiRequest("/api/admin/stats");

        document.getElementById("totalCount").textContent = stats.total ?? 0;
        document.getElementById("submittedCount").textContent = stats.submitted ?? 0;
        document.getElementById("progressCount").textContent = stats.inProgress ?? 0;
        document.getElementById("resolvedCount").textContent = stats.resolved ?? 0;

        await loadComplaints();
        dashboardMessage.textContent = "";
    } catch (error) {
        dashboardMessage.textContent = error.message;
    }
}

async function loadComplaints() {
    const search = document.getElementById("searchInput").value.trim();
    const status = document.getElementById("statusFilter").value;

    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);

    const data = await apiRequest(`/api/admin/complaints?${params.toString()}`);
    complaints = Array.isArray(data) ? data : (data.complaints || []);
    renderComplaints();
}

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "";
    row.appendChild(cell);
    return cell;
}

function renderComplaints() {
    complaintsTableBody.replaceChildren();

    if (!complaints.length) {
        const row = document.createElement("tr");
        const cell = addCell(row, "No complaints found.");
        cell.colSpan = 8;
        complaintsTableBody.appendChild(row);
        return;
    }

    for (const complaint of complaints) {
        const row = document.createElement("tr");

        addCell(row, complaint.complaint_id);
        addCell(row, complaint.student_name);
        addCell(row, complaint.email);
        addCell(row, complaint.category);
        addCell(row, complaint.description);
        addCell(row, complaint.created_at
            ? new Date(complaint.created_at).toLocaleString()
            : "");

        const statusCell = addCell(row, "");
        const statusSelect = document.createElement("select");

        for (const status of ["Submitted", "In Progress", "Resolved"]) {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = status;
            statusSelect.appendChild(option);
        }

        statusSelect.value = complaint.status || "Submitted";
        statusCell.appendChild(statusSelect);

        const actionCell = addCell(row, "");
        const updateButton = document.createElement("button");
        updateButton.type = "button";
        updateButton.textContent = "Update";

        updateButton.addEventListener("click", async () => {
            updateButton.disabled = true;
            try {
                await apiRequest(
                    `/api/admin/complaints/${encodeURIComponent(complaint.complaint_id)}/status`,
                    {
                        method: "PATCH",
                        body: JSON.stringify({ status: statusSelect.value })
                    }
                );
                await loadDashboard();
            } catch (error) {
                dashboardMessage.textContent = error.message;
            } finally {
                updateButton.disabled = false;
            }
        });

        actionCell.appendChild(updateButton);
        complaintsTableBody.appendChild(row);
    }
}

document.getElementById("refreshButton").addEventListener("click", loadDashboard);
document.getElementById("statusFilter").addEventListener("change", loadComplaints);

let searchTimer;
document.getElementById("searchInput").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        loadComplaints().catch(error => {
            dashboardMessage.textContent = error.message;
        });
    }, 300);
});

document.getElementById("logoutButton").addEventListener("click", async () => {
    try {
        await apiRequest("/api/admin/logout", { method: "POST" });
    } catch (error) {
        dashboardMessage.textContent = error.message;
        return;
    }

    dashboardSection.hidden = true;
    loginSection.hidden = false;
    loginMessage.textContent = "You have logged out.";
});

checkLogin();
