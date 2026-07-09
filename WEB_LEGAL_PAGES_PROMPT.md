# Cursor Prompt — Add /privacy and /terms pages to the MoneyBot website

Copy everything below the line into Cursor (Agent mode) in your **website** repo. It will create two production-ready legal pages served at `getmoneybot.com/privacy` and `getmoneybot.com/terms`.

---

## TASK

Add two legal pages to this website, reachable at:

- `https://getmoneybot.com/privacy` → **Privacy Policy**
- `https://getmoneybot.com/terms` → **Terms of Service**

These must match the content used in the MoneyBot mobile app and satisfy Apple App Store review (App Store Connect requires a public, working privacy policy URL, and our app links to both pages).

## REQUIREMENTS

1. **Routing**: Detect this project's framework (e.g. Next.js App Router, Next.js Pages Router, Astro, Remix, plain Vite/React, static HTML) and create the routes using that framework's conventions so the URLs above resolve in production. Do not add a client-side-only redirect hack — the pages must be directly linkable and crawlable.
2. **Content**: Use the EXACT copy provided in the "PRIVACY POLICY CONTENT" and "TERMS OF SERVICE CONTENT" sections below. Do not paraphrase or omit sections. Render each section heading as a subheading and each paragraph/bullet list cleanly.
3. **Design**: Match the existing site's design system (reuse its layout, header, footer, fonts, and color tokens). MoneyBot's brand green is `#3DDC5F`. The page should be:
   - Centered, readable measure (max ~720px content width), generous line-height.
   - Responsive and mobile-friendly.
   - Accessible: semantic headings (`h1` for the title, `h2` for each section), sufficient contrast, focusable skip link if the site has one.
   - Include a visible **"Last Updated: June 12, 2026"** near the title.
4. **Shared component**: Factor the shared page shell (title + "last updated" + rendered sections) into one reusable component and feed it the two content objects, to avoid duplication.
5. **Navigation**: Add links to `/privacy` and `/terms` in the site footer if they aren't already there.
6. **SEO/meta**: Set an appropriate `<title>` and meta description for each page (e.g. "Privacy Policy — MoneyBot"). Include Open Graph tags consistent with the rest of the site. These pages should be indexable (no `noindex`).
7. **Contact**: The contact email throughout is `kahlil@getmoneybot.com`.

## DATA MODEL

Create a single content module (e.g. `legal.ts`/`legal.js`) exporting two objects shaped like:

```
{
  title: string,
  lastUpdated: 'June 12, 2026',
  sections: Array<{ heading: string, body: string }>
}
```

Body strings use `\n\n` to separate paragraphs and lines beginning with `•` for bullet points — render `\n\n` as paragraph breaks and consecutive `•` lines as an unordered list.

---

## PRIVACY POLICY CONTENT

**Title:** Privacy Policy
**Last Updated:** June 12, 2026

### Introduction
MoneyBot ("we," "us," or "our") operates the MoneyBot mobile application and related services at getmoneybot.com. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our app.

By creating an account or using MoneyBot, you agree to the collection and use of information in accordance with this policy. If you do not agree, please do not use the app.

### Information We Collect
Account information: When you register, we collect your email address and a hashed password. If you sign in with Google or Apple, we receive your email address (when provided), display name, and profile photo URL from that provider, along with a unique identifier from the provider.

Learning data: We store your course progress, quiz answers, XP, streaks, Bot Bucks, rank, equipped characters, and onboarding assessment responses to personalize your experience.

AI chat data: Messages you send to MoneyBot Tutor and Money Chat are stored so we can maintain conversation history and improve responses.

Preferences: We store your theme preference (light or dark mode) locally on your device.

Device and usage data: We may collect basic diagnostic information such as app version and platform to troubleshoot issues. We do not sell your personal information.

### How We Use Your Information
We use the information we collect to:

• Create and manage your account
• Deliver financial literacy courses, gamification features, and AI tutoring
• Track your learning progress and streaks
• Respond to support requests
• Improve app reliability and fix bugs
• Comply with legal obligations

We do not use your data for targeted advertising or sell it to third parties.

### Third-Party Services
MoneyBot uses the following third-party services that may process your data:

• Google Sign-In (Google LLC) — authentication when you choose "Continue with Google"
• Sign in with Apple (Apple Inc.) — authentication when you choose "Continue with Apple" on iOS
• OpenAI — powers the AI Tutor and Money Chat features; your chat messages are sent to OpenAI to generate responses

Each provider has its own privacy policy. We recommend reviewing Google's, Apple's, and OpenAI's policies for details on how they handle data.

### Data Retention
We retain your account data for as long as your account is active. AI chat history and learning progress are kept to provide continuity in your experience.

When you delete your account through Settings, we permanently delete your account and associated data, including progress, XP, Bot Bucks, and chat history.

### Data Security
We use industry-standard measures to protect your information, including encrypted connections (HTTPS) for all API communication and secure local storage for authentication tokens on your device. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.

### Your Rights and Choices
You can:

• Access and update your profile information in the app
• Delete your account and all associated data at any time from Settings > Delete Account
• Contact us to request information about data we hold about you

If you are in the European Economic Area, United Kingdom, or California, you may have additional rights under GDPR or CCPA. Contact us to exercise those rights.

### Children's Privacy
MoneyBot is intended for users aged 13 and older. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, please contact us and we will delete it promptly.

### Changes to This Policy
We may update this Privacy Policy from time to time. We will notify you of material changes by updating the "Last Updated" date and, where appropriate, through in-app notice. Continued use of the app after changes constitutes acceptance of the updated policy.

### Contact Us
If you have questions about this Privacy Policy or our data practices, contact us at:

Email: kahlil@getmoneybot.com
Website: getmoneybot.com

---

## TERMS OF SERVICE CONTENT

**Title:** Terms of Service
**Last Updated:** June 12, 2026

### Agreement to Terms
These Terms of Service ("Terms") govern your use of the MoneyBot mobile application and related services ("Service") operated by MoneyBot. By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.

### Eligibility
You must be at least 13 years old to use MoneyBot. By using the Service, you represent that you meet this age requirement and have the legal capacity to enter into these Terms.

### Account Registration
You may create an account using email and password, Google Sign-In, or Sign in with Apple. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. Notify us immediately at kahlil@getmoneybot.com if you suspect unauthorized access.

### Educational Content — Not Financial Advice
MoneyBot provides financial literacy education, interactive courses, and AI-powered tutoring for informational and educational purposes only. Nothing in the Service constitutes financial, investment, tax, legal, or professional advice.

You should consult qualified professionals before making financial decisions. MoneyBot is not a registered investment adviser, broker-dealer, or financial planner.

### AI Features
MoneyBot Tutor and Money Chat use artificial intelligence to generate responses. AI outputs may be inaccurate, incomplete, or outdated. Do not rely on AI responses as a substitute for professional advice. You use AI features at your own discretion and risk.

### Acceptable Use
You agree not to:

• Use the Service for any unlawful purpose
• Attempt to gain unauthorized access to our systems or other users' accounts
• Upload malicious code or interfere with the Service
• Harass, abuse, or harm others through chat features
• Scrape, reverse-engineer, or resell the Service
• Misrepresent your identity or affiliation

We may suspend or terminate accounts that violate these rules.

### Virtual Items and Progress
XP, Bot Bucks, streaks, ranks, characters, and other in-app rewards have no real-world monetary value and cannot be exchanged for cash. We may modify, reset, or discontinue gamification features at any time.

### Intellectual Property
The Service, including its content, design, logos, and software, is owned by MoneyBot and protected by intellectual property laws. You receive a limited, non-exclusive, non-transferable license to use the Service for personal, non-commercial purposes.

### Account Termination
You may delete your account at any time through Settings > Delete Account. We may suspend or terminate your account if you violate these Terms or if we discontinue the Service. Upon termination, your right to use the Service ceases immediately.

### Disclaimer of Warranties
THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.

### Limitation of Liability
TO THE MAXIMUM EXTENT PERMITTED BY LAW, MONEYBOT AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.

### Changes to Terms
We may modify these Terms at any time. Material changes will be reflected in the "Last Updated" date. Continued use of the Service after changes constitutes acceptance of the revised Terms.

### Governing Law
These Terms are governed by the laws of the United States. Any disputes shall be resolved in the courts of competent jurisdiction, unless otherwise required by applicable consumer protection laws in your jurisdiction.

### Contact Us
Questions about these Terms? Contact us at:

Email: kahlil@getmoneybot.com
Website: getmoneybot.com

---

## ACCEPTANCE CRITERIA
- Visiting `/privacy` and `/terms` in production renders the full content above with correct headings and bullet lists.
- Both pages are responsive, accessible, indexable, and match the site's look and feel.
- Footer links to both pages exist.
- No build/lint/type errors.
