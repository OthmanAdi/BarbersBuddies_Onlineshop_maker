<div align="center">

# ✂️ BarbersBuddies

**The open-source booking platform for barbershops**

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-10.12-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe&logoColor=white)](https://stripe.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Live Demo](https://barbersbuddies.com) · [Report Bug](https://github.com/Khanto87/BarbersBuddies/issues) · [Request Feature](https://github.com/Khanto87/BarbersBuddies/issues)

</div>

---

## 📸 Screenshots

<div align="center">
<table>
<tr>
<td align="center"><img src="docs/screenshots/landing.png" width="400" alt="Landing Page"/><br/><b>Landing Page</b></td>
<td align="center"><img src="docs/screenshots/booking.png" width="400" alt="Booking Flow"/><br/><b>Booking Flow</b></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/dashboard.png" width="400" alt="Shop Dashboard"/><br/><b>Shop Dashboard</b></td>
<td align="center"><img src="docs/screenshots/mobile.png" width="400" alt="Mobile View"/><br/><b>Mobile View</b></td>
</tr>
</table>
</div>

---

## ⚡ Features

🗓️ **Smart Booking System** — Real-time availability, service selection, employee assignment
📊 **Analytics Dashboard** — Track revenue, bookings, and customer trends
💳 **Stripe Payments** — Secure payment processing built-in
🌍 **Multi-language** — English, German, Turkish, Arabic
🎨 **Themes** — Light, dark, and luxury themes
📱 **Mobile-first** — Fully responsive design
🔔 **Notifications** — Email confirmations via Mailgun + in-app alerts
👥 **Employee Management** — Staff schedules, assignments, permissions
⭐ **Ratings & Reviews** — Customer feedback system
💬 **Messaging** — Shop-to-customer communication

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (React)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Booking  │ │Dashboard │ │  Shop    │ │   Auth & User    │   │
│  │   Flow   │ │ Analytics│ │ Landing  │ │   Management     │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘   │
└───────┼────────────┼────────────┼────────────────┼─────────────┘
        │            │            │                │
        ▼            ▼            ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Firebase Services                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │Firestore │ │   Auth   │ │ Storage  │ │    Functions     │   │
│  │    DB    │ │          │ │ (Images) │ │  (Email/Stripe)  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
        │                                          │
        ▼                                          ▼
   ┌─────────┐                              ┌─────────────┐
   │ Stripe  │                              │   Mailgun   │
   │Payments │                              │   (Email)   │
   └─────────┘                              └─────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Firebase project
- Stripe account
- Mailgun account (for emails)

### 1. Clone & Install

```bash
git clone https://github.com/Khanto87/BarbersBuddies.git
cd BarbersBuddies
npm install
cd functions && npm install && cd ..
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
REACT_APP_FIREBASE_API_KEY=your_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
REACT_APP_GOOGLE_MAPS_API_KEY=your_maps_key
```

### 3. Firebase Functions Config

```bash
firebase functions:config:set mailgun.key="your_key" mailgun.domain="your_domain"
```

### 4. Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TailwindCSS, DaisyUI, Framer Motion |
| Backend | Firebase Functions (Node.js) |
| Database | Firestore |
| Auth | Firebase Authentication |
| Payments | Stripe |
| Email | Mailgun |
| Storage | Firebase Storage |
| Maps | Google Maps API |

---

## 📁 Project Structure

```
BarbersBuddies/
├── src/
│   ├── components/     # React components
│   ├── Services/       # API services (Stripe, etc.)
│   ├── utils/          # Helpers (sanitize, logger)
│   └── store.js        # Zustand state management
├── functions/          # Firebase Cloud Functions
├── public/             # Static assets
└── docs/               # Documentation & screenshots
```

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo
2. Create your branch (`git checkout -b feature/awesome-feature`)
3. Commit changes (`git commit -m 'Add awesome feature'`)
4. Push (`git push origin feature/awesome-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with ❤️ for the barbershop community**

[⬆ Back to top](#-barbersbuddies)

</div>
