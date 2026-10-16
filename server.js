
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "campus_complaint_system",
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10
});

// Session configuration
if (
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.includes("replace-with")
) {
    throw new Error("Set a strong, unique SESSION_SECRET in .env");
}

app.use(session({
    name: "campuscare.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 60 * 1000
    }
}));

// Protect admin APIs
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin === true) {
        return next();
    }

    return res.status(401).json({
        success: false,
        message: "Please log in as administrator."
    });
}

// Home page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Database health check
app.get("/api/health", async (req, res) => {
    try {
        await db.query("SELECT 1");
        res.json({
            success: true,
            message: "CampusCare server and MySQL are connected."
        });
    } catch (error) {
        console.error("Database health error:", error.message);
        res.status(500).json({
            success: false,
            message: "Database connection failed."
        });
    }
});

// Submit complaint
app.post("/api/complaints", async (req, res) => {
    try {
        const { student_name, email, category, description } = req.body;

        if (
            typeof student_name !== "string" ||
            typeof email !== "string" ||
            typeof category !== "string" ||
            typeof description !== "string" ||
            !student_name.trim() ||
            !email.trim() ||
            !category.trim() ||
            !description.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields."
            });
        }

        if (
            student_name.length > 100 ||
            email.length > 100 ||
            category.length > 50 ||
            description.length > 10000
        ) {
            return res.status(400).json({
                success: false,
                message: "One or more fields exceed the allowed length."
            });
        }

        const complaintId =
            "CC-" + Date.now().toString().slice(-8);

        await db.execute(
            `INSERT INTO complaints
             (complaint_id, student_name, email, category, description)
             VALUES (?, ?, ?, ?, ?)`,
            [
                complaintId,
                student_name.trim(),
                email.trim(),
                category.trim(),
                description.trim()
            ]
        );

        res.status(201).json({
            success: true,
            message: "Complaint submitted successfully!",
            complaint_id: complaintId,
            status: "Submitted"
        });
    } catch (error) {
        console.error("Submit complaint error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to submit complaint. Please try again."
        });
    }
});

// Track complaint publicly by ID
app.get("/api/complaints/:complaintId", async (req, res) => {
    try {
        const complaintId = req.params.complaintId.trim().toUpperCase();

        const [rows] = await db.execute(
            `SELECT complaint_id, category, status, created_at
             FROM complaints
             WHERE complaint_id = ?`,
            [complaintId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found. Please check the ID."
            });
        }

        res.json({
            success: true,
            complaint: rows[0]
        });
    } catch (error) {
        console.error("Track complaint error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to track complaint right now."
        });
    }
});

// Admin login
app.post("/api/admin/login", (req, res, next) => {
    const { username, password } = req.body;

    if (
        typeof username !== "string" ||
        typeof password !== "string" ||
        username !== process.env.ADMIN_USERNAME ||
        password !== process.env.ADMIN_PASSWORD
    ) {
        return res.status(401).json({
            success: false,
            message: "Invalid username or password."
        });
    }

    req.session.regenerate((error) => {
        if (error) return next(error);

        req.session.isAdmin = true;
        req.session.adminUsername = username;

        req.session.save((saveError) => {
            if (saveError) return next(saveError);

            res.json({
                success: true,
                message: "Admin login successful."
            });
        });
    });
});

// Check current admin session
app.get("/api/admin/me", requireAdmin, (req, res) => {
    res.json({
        success: true,
        username: req.session.adminUsername
    });
});

// Admin dashboard statistics
app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                COUNT(*) AS total,
                SUM(status = 'Submitted') AS submitted,
                SUM(status = 'In Progress') AS inProgress,
                SUM(status = 'Resolved') AS resolved
            FROM complaints
        `);

        const stats = rows[0];

        res.json({
            success: true,
            stats: {
                total: Number(stats.total || 0),
                submitted: Number(stats.submitted || 0),
                inProgress: Number(stats.inProgress || 0),
                resolved: Number(stats.resolved || 0)
            }
        });
    } catch (error) {
        console.error("Admin stats error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to load dashboard statistics."
        });
    }
});

// List/search/filter complaints
app.get("/api/admin/complaints", requireAdmin, async (req, res) => {
    try {
        const search = String(req.query.search || "").trim().slice(0, 100);
        const status = String(req.query.status || "").trim();

        const allowedStatuses = ["Submitted", "In Progress", "Resolved"];

        let sql = `
            SELECT id, complaint_id, student_name, email,
                   category, description, status, created_at
            FROM complaints
            WHERE 1 = 1
        `;
        const params = [];

        if (search) {
            const pattern = `%${search}%`;
            sql += ` AND (
                complaint_id LIKE ? OR
                student_name LIKE ? OR
                email LIKE ? OR
                category LIKE ?
            )`;
            params.push(pattern, pattern, pattern, pattern);
        }

        if (status) {
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status filter."
                });
            }
            sql += " AND status = ?";
            params.push(status);
        }

        sql += " ORDER BY created_at DESC LIMIT 500";

        const [rows] = await db.execute(sql, params);

        res.json({
            success: true,
            complaints: rows
        });
    } catch (error) {
        console.error("Admin complaints error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to load complaints."
        });
    }
});

// Update complaint status
app.patch(
    "/api/admin/complaints/:complaintId/status",
    requireAdmin,
    async (req, res) => {
        try {
            const { status } = req.body;
            const allowedStatuses = [
                "Submitted",
                "In Progress",
                "Resolved"
            ];

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid complaint status."
                });
            }

            const [result] = await db.execute(
                `UPDATE complaints SET status = ? WHERE complaint_id = ?`,
                [status, req.params.complaintId.trim().toUpperCase()]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Complaint not found."
                });
            }

            res.json({
                success: true,
                message: "Complaint status updated.",
                status
            });
        } catch (error) {
            console.error("Status update error:", error.message);
            res.status(500).json({
                success: false,
                message: "Unable to update complaint status."
            });
        }
    }
);

// Admin logout
app.post("/api/admin/logout", requireAdmin, (req, res, next) => {
    req.session.destroy((error) => {
        if (error) return next(error);

        res.clearCookie("campuscare.sid");
        res.json({
            success: true,
            message: "Logged out successfully."
        });
    });
});

// General error handler
app.use((error, req, res, next) => {
    console.error("Server error:", error.message);

    if (res.headersSent) return next(error);

    res.status(500).json({
        success: false,
        message: "An unexpected server error occurred."
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`Server running at http://localhost:${PORT}`);

    try {
        await db.query("SELECT 1");
        console.log("MySQL database connected successfully!");
    } catch (error) {
        console.error("MySQL connection failed:", error.message);
    }
});
