
const complaintForm = document.getElementById("complaintForm");
const result = document.getElementById("result");
const trackForm = document.getElementById("trackForm");
const trackResult = document.getElementById("trackResult");

// Safely display messages
function showMessage(container, title, details = []) {
    container.replaceChildren();

    if (title) {
        const heading = document.createElement("h3");
        heading.textContent = title;
        container.appendChild(heading);
    }

    details.forEach((detail) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = detail;
        container.appendChild(paragraph);
    });

    container.hidden = false;
}

// Submit complaint to MySQL through the backend API
complaintForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const submitButton = complaintForm.querySelector(
        'button[type="submit"], input[type="submit"]'
    );

    if (submitButton) submitButton.disabled = true;

    showMessage(result, "Submitting your complaint...", []);

    try {
        const complaint = {
            student_name: document.getElementById("studentName").value.trim(),
            email: document.getElementById("studentEmail").value.trim(),
            category: document.getElementById("category").value,
            description: [
                document.getElementById("location").value.trim()
                    ? "Location: " + document.getElementById("location").value.trim()
                    : "",
                document.getElementById("description").value.trim()
            ].filter(Boolean).join("\n\n")
        };

        const response = await fetch("/api/complaints", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(complaint)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to submit complaint.");
        }

        showMessage(result, "Complaint submitted successfully!", [
            "Your Complaint ID: " + data.complaint_id,
            "Status: " + data.status,
            "Save your Complaint ID to track your complaint."
        ]);

        complaintForm.reset();
    } catch (error) {
        showMessage(result, "Complaint submission failed", [
            error.message || "Please check your connection and try again."
        ]);
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
});

// Track complaint using the database
trackForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const id = document.getElementById("complaintId").value.trim().toUpperCase();

    if (!id) {
        showMessage(trackResult, "Please enter your Complaint ID.");
        return;
    }

    showMessage(trackResult, "Searching for your complaint...", []);

    try {
        const response = await fetch(
            "/api/complaints/" + encodeURIComponent(id)
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Complaint not found.");
        }

        const complaint = data.complaint;

        showMessage(trackResult, "Complaint details", [
            "Complaint ID: " + complaint.complaint_id,
            "Category: " + complaint.category,
            "Status: " + complaint.status,
            "Submitted: " + new Date(complaint.created_at).toLocaleString()
        ]);
    } catch (error) {
        showMessage(trackResult, "Unable to track complaint", [
            error.message || "Please try again."
        ]);
    }
});
