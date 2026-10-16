
# CampusCare - Campus Complaint Management System

CampusCare is a web-based application that helps students submit campus-related complaints and track their status. Administrators can manage complaints through a dedicated dashboard.

## Features

- Submit campus complaints online
- Track complaints using a complaint ID
- Admin login and dashboard
- View and search complaints
- Update complaint status
- MySQL database integration

## Technologies Used

- HTML
- CSS
- JavaScript
- Node.js
- Express.js
- MySQL

## Project Structure

```text
CampusComplaintSystem/
├── public/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── admin.html
│   ├── admin.css
│   └── admin.js
├── server.js
├── package.json
├── .gitignore
└── README.md
```

## Installation and Setup

1. Install Node.js and MySQL.
2. Clone this repository.
3. Open the project folder in your terminal.
4. Install dependencies:

   npm install

5. Create a `.env` file in the project root and configure the required database and admin settings.
6. Create the MySQL database using the database name configured in `.env`.
7. Start the server:

   node server.js

8. Open http://localhost:3000 in your browser.

## Complaint Status

- Submitted
- In Progress
- Resolved

## Security

- Keep `.env` private.
- Never upload database passwords or session secrets to GitHub.
- Use strong admin credentials.

## Author

Vicky Kumar

## Project Purpose

Developed as a B.Tech CSE mini project to simplify campus complaint submission, tracking, and administration.
