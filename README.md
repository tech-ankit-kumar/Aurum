# AURUM — Premium Footwear E-Commerce

<p align="center">
  <strong>Move Your Way.</strong><br>
  A modern footwear shopping experience with a dedicated admin dashboard, order management, inventory tracking, and manual UPI payment verification.
</p>

<p align="center">
  <a href="https://github.com/tech-ankit-kumar">GitHub Profile</a>
</p>

---

## Overview

**AURUM** is a full-stack e-commerce web application for discovering and purchasing premium footwear. It combines a responsive storefront with a Node.js and Express backend, persistent SQLite storage, customer accounts, order workflows, inventory controls, and an administration area.

The project is built with a focus on clean presentation, practical shopping flows, and core e-commerce operations. It includes product data and imagery for popular footwear brands, plus a separate admin interface for managing orders, payment submissions, and stock.

## Key Features

### Customer Storefront
- Responsive storefront for desktop, tablet, and mobile screens.
- Premium footwear catalogue with brand and collection browsing.
- Product listing and individual product details.
- Product search, shopping cart, and wishlist interactions.
- Customer registration, login, and logout.
- Customer account session handling.
- Saved delivery addresses.
- Checkout with server-calculated subtotal, shipping, tax, and total.
- Order history and order details.
- Order cancellation requests and return requests.
- UPI payment flow with QR-code generation and payment reference submission.

### Administration
- Dedicated admin panel at `/admin/`.
- Separate administrator authentication.
- Overview statistics for store operations.
- Order listing and order status management.
- Payment submission review and manual verification workflow.
- Inventory listing and stock updates.
- Order cancellation and return request handling.
- Administrative notes and refund-status tracking where supported by the order workflow.

### Backend and Data
- REST-style API built with Express.
- SQLite database for users, addresses, orders, and inventory.
- Persistent local data storage.
- Password hashing with `bcryptjs`.
- JSON Web Token (JWT) authentication.
- HTTP-only authentication cookies.
- Security headers with Helmet.
- API rate limiting.
- Environment-based configuration with `dotenv`.
- UPI QR-code generation with the `qrcode` package.
- SQLite foreign-key support and write-ahead logging.

## Technology Stack

| Area | Tools and Technologies |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Responsive UI | Custom CSS, `css/responsive.css` |
| Backend | Node.js, Express.js |
| Database | SQLite, `better-sqlite3` |
| Authentication | JSON Web Token (`jsonwebtoken`), HTTP-only cookies |
| Password Security | `bcryptjs` |
| Security Headers | Helmet |
| API Protection | `express-rate-limit` |
| Cookie Handling | `cookie-parser` |
| Environment Configuration | `dotenv` |
| UPI QR Codes | `qrcode` |
| Typography | Google Fonts — Fraunces and Sora |
| Development | Node.js watch mode (`node --watch`) |
| Version Control | Git and GitHub |

## Project Structure

```text
AURUM/
├── admin/
│   └── index.html             # Admin dashboard interface
├── css/
│   ├── style.css              # Main storefront styles
│   └── responsive.css         # Responsive layout rules
├── images/                    # Product images
├── js/
│   ├── data.js                # Frontend product/store data
│   └── script.js              # Storefront interactions
├── server/
│   ├── data/                  # SQLite database (created at runtime)
│   ├── index.js               # Express server and API routes
│   └── products.json          # Product catalogue used by the backend
├── .env.example               # Example environment configuration
├── .gitignore
├── index.html                 # Storefront entry point
├── package.json
├── package-lock.json
└── README.md
```

> **Note:** The SQLite database is created and managed by the server. Keep your local database and `.env` file private; do not commit credentials, real customer data, or production database files to a public repository.

## Requirements

Install the following before running the project:

- **Node.js 20 or newer**
- **npm** (included with Node.js)
- A modern web browser

Check your installed versions:

```bash
node --version
npm --version
```

## Installation and Setup

### 1. Clone the repository

Replace the repository URL below if your GitHub repository uses a different name.

```bash
git clone https://github.com/tech-ankit-kumar/Aurum.git
cd Aurum
```

Alternatively, download the repository ZIP from GitHub and extract it.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local `.env` file from the example.

**Windows PowerShell:**
```powershell
Copy-Item .env.example .env
notepad .env
```

**macOS / Linux:**
```bash
cp .env.example .env
```

Update `.env` with your own values:

```dotenv
PORT=3000
NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-secret
UPI_ID=your-upi-id@bank
UPI_NAME=Your Store Name
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-strong-password
```

Use a long, unpredictable `JWT_SECRET` and a strong, unique administrator password. Configure your own UPI ID and payee name. Never publish your real `.env` file or share production secrets.

### 4. Start the application

Run the production-style start command for local development:

```bash
npm start
```

Or use Node.js watch mode while developing:

```bash
npm run dev
```

### 5. Open the application

- **Storefront:** [http://localhost:3000](http://localhost:3000)
- **Admin panel:** [http://localhost:3000/admin/](http://localhost:3000/admin/)

Keep the terminal running while using the application. Stop the server with `Ctrl + C`.

## Available Scripts

| Command | Description |
|---|---|
| `npm start` | Starts the Express server |
| `npm run dev` | Starts the server with Node.js watch mode |
| `npm run seed` | Runs the seed script, if `server/seed.js` is present in your project |

## API Overview

The backend exposes the following main API groups.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Check server health |
| `GET` | `/api/products` | Retrieve products |
| `GET` | `/api/products/:id` | Retrieve a product |
| `GET` | `/api/store/payment-info` | Retrieve store payment information |
| `GET` | `/api/store/upi-qr/:orderId` | Generate/retrieve an order UPI QR code |
| `POST` | `/api/auth/signup` | Register a customer |
| `POST` | `/api/auth/login` | Sign in a customer |
| `POST` | `/api/auth/logout` | Sign out a customer |
| `GET` | `/api/auth/me` | Get the current customer session |
| `GET` / `POST` | `/api/addresses` | List or add delivery addresses |
| `DELETE` | `/api/addresses/:id` | Delete an address |
| `POST` | `/api/orders` | Create an order |
| `GET` | `/api/orders` | List the signed-in customer's orders |
| `GET` | `/api/orders/:id` | Get an order |
| `POST` | `/api/payments/upi/submit` | Submit UPI payment reference details |
| `POST` | `/api/orders/:id/cancel-request` | Request order cancellation |
| `POST` | `/api/orders/:id/return-request` | Request a return |
| `POST` | `/api/admin/auth/login` | Sign in an administrator |
| `POST` | `/api/admin/auth/logout` | Sign out an administrator |
| `GET` | `/api/admin/auth/me` | Get the current admin session |
| `GET` | `/api/admin/stats` | Retrieve admin dashboard statistics |
| `GET` | `/api/admin/orders` | List orders for administration |
| `PATCH` | `/api/admin/orders/:id` | Update order workflow details |
| `PATCH` | `/api/admin/payments/:id` | Review/update payment status |
| `GET` | `/api/admin/inventory` | List inventory |
| `PATCH` | `/api/admin/inventory/:productId` | Update product stock |

Admin endpoints require administrator authentication. Customer endpoints that access personal data or orders require a valid customer session.

## Payment Workflow

AURUM supports a **manual UPI payment workflow**:

1. The customer places an order.
2. The application creates an order-specific UPI payment URI and QR code when payment configuration is available.
3. The customer pays using a UPI application.
4. The customer submits the UPI transaction reference/UTR.
5. An administrator checks the payment against the actual bank or UPI transaction record and updates the payment status.

**Important:** Submitting a UTR is not proof that money was received. Always verify payment in the receiving bank account or UPI application before approving an order. This project does not represent an automatic payment-gateway integration.

## Security Notes

- Passwords are hashed using `bcryptjs`.
- Authentication uses JWTs stored in HTTP-only cookies.
- Helmet adds HTTP security headers.
- Rate limiting is applied to API requests and authentication endpoints.
- Server-side order processing validates product IDs, quantities, and available stock.
- Order totals are calculated on the server rather than trusting client-submitted totals.
- Environment variables are used for secrets and payment configuration.

Before deploying publicly, review and strengthen the configuration for your deployment environment:

- Replace all example secrets and credentials.
- Set `NODE_ENV=production` and use HTTPS.
- Keep `.env`, database files, customer data, and logs out of Git.
- Configure trusted proxy settings to match your hosting platform.
- Add appropriate backups, monitoring, and operational error handling.
- Consider a managed payment gateway if automated payment confirmation is required.
- Test authorization and validation for all customer and admin workflows.

## Database

The application uses SQLite through `better-sqlite3`. The server initializes the required schema and inventory records when it starts. The database is stored under `server/data/`.

Back up the database before making changes or deploying updates. Do not delete the database after accepting real orders, as doing so can permanently remove customer and order records.

## Troubleshooting

**The server does not start**
- Confirm that Node.js 20 or newer is installed.
- Run `npm install` again.
- Check that the `.env` file exists and contains valid values.
- Make sure port `3000` is not already in use, or change `PORT` in `.env`.

**UPI QR generation fails**
- Confirm that `UPI_ID` is set in `.env`.
- Restart the server after changing environment variables.
- Use a valid UPI ID and verify the receiving account details.

**Admin login does not work**
- Check `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`.
- Use the configured administrator credentials and ensure the server was restarted after configuration changes.
- Do not use example credentials on a public deployment.

**Products or images are missing**
- Confirm that `server/products.json`, the `images/` directory, and the frontend JavaScript files are present.
- Check the browser developer console and the server terminal for errors.

## Future Improvements

Potential next steps for the project include:

- Automated payment-gateway integration and webhook verification.
- Product reviews and ratings backed by the database.
- Product pagination and advanced filters.
- Email notifications for order and payment updates.
- Automated tests and CI workflows.
- Deployment automation and production monitoring.
- Image optimization and a dedicated product image delivery service.

## Author

**Ankit Kumar**

- GitHub: [@tech-ankit-kumar](https://github.com/tech-ankit-kumar)
- GitHub Projects: [Explore repositories](https://github.com/tech-ankit-kumar?tab=repositories)



---

<p align="center">
  Built with HTML, CSS, JavaScript, Node.js, Express, and SQLite.
</p>
