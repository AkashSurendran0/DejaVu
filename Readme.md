# DejaVu – Full-Stack E-Commerce Platform

## Overview

DejaVu is a full-stack e-commerce platform built using the MVC (Model-View-Controller) architecture pattern. The platform provides a complete online shopping experience, allowing customers to browse products, manage their carts, place orders, and securely complete payments.

The project was developed to gain hands-on experience in designing and implementing a real-world e-commerce system while focusing on backend architecture, authentication, payment integration, database management, and user experience.

---

## Key Highlights

- Full-Stack E-Commerce Application
- MVC Architecture
- User Authentication & Authorization
- Product Catalog Management
- Shopping Cart Functionality
- Order Management System
- Razorpay Payment Integration
- Coupon & Discount Support
- Product Search & Filtering
- Wishlist Management
- Address Management
- Admin Dashboard
- MongoDB Database
- Responsive User Interface
- Secure Session Management

---

## Architecture

The application follows the MVC (Model-View-Controller) architecture pattern.

### MVC Components

#### Models

Responsible for:

- Database interactions
- Data validation
- Business data representation

#### Views

Responsible for:

- User interface rendering
- Dynamic page generation
- User interaction

#### Controllers

Responsible for:

- Request handling
- Business logic
- Data processing
- Response generation

---

## Core Features

### Authentication & Authorization

- User Registration
- User Login
- Secure Password Hashing
- Session-Based Authentication
- Protected Routes
- Role-Based Access Control
- Admin Authentication

---

### User Features

- Create Account
- Manage Profile
- Manage Addresses
- View Order History
- Track Orders
- Update Personal Information

---

### Product Management

- Browse Products
- Product Categories
- Product Details Page
- Product Search
- Product Filtering
- Product Sorting
- Product Availability Tracking

---

### Shopping Cart

- Add Products to Cart
- Remove Products from Cart
- Update Product Quantities
- Cart Price Calculation
- Persistent Cart Management

---

### Wishlist

- Add Products to Wishlist
- Remove Products from Wishlist
- Save Products for Future Purchase

---

### Checkout System

- Address Selection
- Order Summary
- Price Breakdown
- Coupon Application
- Secure Checkout Process

---

### Payment Integration

#### Razorpay Integration

- Secure Online Payments
- Payment Verification
- Transaction Validation
- Order Confirmation

---

### Order Management

#### Customer Side

- Place Orders
- View Orders
- Cancel Orders
- Track Order Status

#### Admin Side

- Manage Orders
- Update Order Status
- Monitor Transactions
- Process Customer Orders

---

### Coupon System

- Apply Discount Coupons
- Coupon Validation
- Percentage Discounts
- Promotional Offers

---

### Admin Dashboard

#### Product Management

- Add Products
- Edit Products
- Delete Products
- Manage Inventory

#### Category Management

- Create Categories
- Update Categories
- Delete Categories

#### User Management

- Manage Customers
- View User Information
- Block/Unblock Users

#### Order Management

- View Orders
- Update Order Status
- Manage Deliveries

#### Sales Monitoring

- Monitor Orders
- Analyze Revenue
- Business Insights

---

## Tech Stack

### Frontend

- HTML
- CSS
- JavaScript
- EJS Templates

### Backend

- Node.js
- Express.js

### Architecture

- MVC Architecture

### Database

- MongoDB

### Authentication

- Express Session
- bcrypt

### Payment Gateway

- Razorpay

### File Storage

- Cloudinary

### Deployment

- VPS Hosting
- Cloudflare

---

## Database Design

### Core Collections

- Users
- Products
- Categories
- Orders
- Addresses
- Coupons
- Wishlists
- Carts
- Payments

### Relationships

- Users can maintain multiple addresses.
- Users can place multiple orders.
- Orders contain multiple products.
- Products belong to categories.
- Users can maintain wishlists.
- Coupons can be applied during checkout.

---

## Application Workflow

### Customer Journey

```text
User Registration/Login
           │
           ▼
Browse Products
           │
           ▼
Add To Cart
           │
           ▼
Apply Coupon
           │
           ▼
Checkout
           │
           ▼
Razorpay Payment
           │
           ▼
Order Placement
           │
           ▼
Order Tracking
```

---

## Security Features

- Password Hashing with bcrypt
- Session-Based Authentication
- Protected Routes
- Input Validation
- Secure Payment Verification
- Authentication Middleware
- Admin Route Protection
- Form Validation

---

## Performance Optimizations

- Optimized Database Queries
- Pagination Support
- Efficient Product Retrieval
- Image Optimization
- Structured MVC Design
- Reduced Redundant Requests

---

## Project Structure

```text
src/
├── config/
├── controllers/
├── models/
├── routes/
├── middleware/
├── services/
├── views/
├── public/
├── utils/
└── app.js
```

---

## Local Setup

### Clone Repository

```bash
git clone <repository-url>
cd dejavu
```

### Install Dependencies

```bash
npm install
```

### Environment Variables

Create a `.env` file:

```env
PORT=
MONGO_URI=
SESSION_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Start Development Server

```bash
npm run dev
```

### Production

```bash
npm start
```

---

## Deployment

### Production Stack

```text
Users
   │
   ▼
Cloudflare
   │
   ▼
Node.js Application
   │
   ▼
MongoDB
```

Hosted on a VPS environment with Cloudflare protection and Razorpay payment integration.

---

## Engineering Challenges

Throughout development, several real-world e-commerce challenges were addressed:

- Designing a scalable MVC architecture
- Implementing secure authentication
- Integrating Razorpay payment gateway
- Managing shopping cart workflows
- Building coupon and discount systems
- Handling order lifecycle management
- Managing product inventory
- Structuring maintainable backend code

---

## Key Learnings

This project provided practical experience with:

- MVC Architecture
- Backend Development
- MongoDB Data Modeling
- Payment Gateway Integration
- Authentication & Authorization
- Session Management
- E-Commerce Workflows
- RESTful API Design
- Database Relationships
- Full-Stack Application Development

---

## Future Enhancements

- Product Reviews & Ratings
- Recommendation Engine
- Real-Time Order Tracking
- Inventory Analytics
- Email Notifications
- Advanced Search Engine
- Multi-Vendor Support
- Return & Refund Management
- CI/CD Pipeline
- Docker Containerization

---

## Project Goal

DejaVu was built to gain practical experience in developing a production-style e-commerce platform while implementing industry-standard concepts such as:

- MVC Architecture
- Authentication & Authorization
- Payment Gateway Integration
- Database Design
- Order Management Systems
- Scalable Backend Development

The project demonstrates the complete lifecycle of an online shopping platform, from product discovery to secure order placement and management.
