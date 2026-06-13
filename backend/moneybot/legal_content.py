"""Single source of truth for MoneyBot's public legal documents.

These power the web pages served at /legal/privacy/ and /legal/terms/ (the URLs
submitted to Apple) and mirror the in-app copy in mobile/src/constants/legal.js.
Keep the two in sync when updating.
"""

LEGAL_META = {
    'company_name': 'MoneyBot',
    'contact_email': 'kahlil@getmoneybot.com',
    'website': 'getmoneybot.com',
    'last_updated': 'June 12, 2026',
}

PRIVACY_POLICY = {
    'id': 'privacy',
    'title': 'Privacy Policy',
    'sections': [
        {
            'heading': 'Introduction',
            'paragraphs': [
                'MoneyBot ("we," "us," or "our") operates the MoneyBot mobile '
                'application and related services. This Privacy Policy explains how '
                'we collect, use, disclose, and safeguard your information when you '
                'use our app.',
                'By creating an account or using MoneyBot, you agree to the '
                'collection and use of information in accordance with this policy. '
                'If you do not agree, please do not use the app.',
            ],
        },
        {
            'heading': 'Information We Collect',
            'paragraphs': [
                'Account information: When you register, we collect your email '
                'address and a hashed password. If you sign in with Google or Apple, '
                'we receive your email address (when provided), display name, and '
                'profile photo URL from that provider, along with a unique identifier '
                'from the provider.',
                'Learning data: We store your course progress, quiz answers, XP, '
                'streaks, Bot Bucks, rank, equipped characters, and onboarding '
                'assessment responses to personalize your experience.',
                'AI chat data: Messages you send to MoneyBot Tutor and Money Chat are '
                'stored so we can maintain conversation history and improve responses.',
                'Preferences: We store your theme preference (light or dark mode) and '
                'notification settings locally on your device.',
                'Device and usage data: We may collect basic diagnostic information '
                'such as app version and platform to troubleshoot issues. We do not '
                'sell your personal information.',
            ],
        },
        {
            'heading': 'How We Use Your Information',
            'intro': 'We use the information we collect to:',
            'bullets': [
                'Create and manage your account',
                'Deliver financial literacy courses, gamification features, and AI tutoring',
                'Track your learning progress and streaks',
                'Send the reminder notifications you opt into',
                'Respond to support requests',
                'Improve app reliability and fix bugs',
                'Comply with legal obligations',
            ],
            'paragraphs': [
                'We do not use your data for targeted advertising or sell it to third parties.',
            ],
        },
        {
            'heading': 'Third-Party Services',
            'intro': 'MoneyBot uses the following third-party services that may process your data:',
            'bullets': [
                'Google Sign-In (Google LLC) — authentication when you choose "Continue with Google"',
                'Sign in with Apple (Apple Inc.) — authentication when you choose "Continue with Apple" on iOS',
                'OpenAI — powers the AI Tutor and Money Chat features; your chat '
                'messages are sent to OpenAI to generate responses',
            ],
            'paragraphs': [
                "Each provider has its own privacy policy. We recommend reviewing "
                "Google's, Apple's, and OpenAI's policies for details on how they "
                "handle data.",
            ],
        },
        {
            'heading': 'Data Retention',
            'paragraphs': [
                'We retain your account data for as long as your account is active. '
                'AI chat history and learning progress are kept to provide continuity '
                'in your experience.',
                'When you delete your account through Settings, we permanently delete '
                'your account and associated data, including progress, XP, Bot Bucks, '
                'and chat history.',
            ],
        },
        {
            'heading': 'Data Security',
            'paragraphs': [
                'We use industry-standard measures to protect your information, '
                'including encrypted connections (HTTPS) for all API communication and '
                'secure local storage for authentication tokens on your device. No '
                'method of transmission or storage is 100% secure, and we cannot '
                'guarantee absolute security.',
            ],
        },
        {
            'heading': 'Your Rights and Choices',
            'intro': 'You can:',
            'bullets': [
                'Access and update your profile information in the app',
                'Delete your account and all associated data at any time from Settings > Delete Account',
                'Contact us to request information about data we hold about you',
            ],
            'paragraphs': [
                'If you are in the European Economic Area, United Kingdom, or '
                'California, you may have additional rights under GDPR or CCPA. '
                'Contact us to exercise those rights.',
            ],
        },
        {
            'heading': "Children's Privacy",
            'paragraphs': [
                'MoneyBot is intended for users aged 13 and older. We do not knowingly '
                'collect personal information from children under 13. If you believe a '
                'child under 13 has provided us with personal information, please '
                'contact us and we will delete it promptly.',
            ],
        },
        {
            'heading': 'Changes to This Policy',
            'paragraphs': [
                'We may update this Privacy Policy from time to time. We will notify '
                'you of material changes by updating the "Last Updated" date and, where '
                'appropriate, through in-app notice. Continued use of the app after '
                'changes constitutes acceptance of the updated policy.',
            ],
        },
        {
            'heading': 'Contact Us',
            'paragraphs': [
                'If you have questions about this Privacy Policy or our data '
                'practices, contact us at kahlil@getmoneybot.com.',
            ],
        },
    ],
}

TERMS_OF_SERVICE = {
    'id': 'terms',
    'title': 'Terms of Service',
    'sections': [
        {
            'heading': 'Agreement to Terms',
            'paragraphs': [
                'These Terms of Service ("Terms") govern your use of the MoneyBot '
                'mobile application and related services ("Service") operated by '
                'MoneyBot. By creating an account or using the Service, you agree to '
                'these Terms. If you do not agree, do not use the Service.',
            ],
        },
        {
            'heading': 'Eligibility',
            'paragraphs': [
                'You must be at least 13 years old to use MoneyBot. By using the '
                'Service, you represent that you meet this age requirement and have '
                'the legal capacity to enter into these Terms.',
            ],
        },
        {
            'heading': 'Account Registration',
            'paragraphs': [
                'You may create an account using email and password, Google Sign-In, '
                'or Sign in with Apple. You are responsible for maintaining the '
                'confidentiality of your credentials and for all activity under your '
                'account. Notify us immediately at kahlil@getmoneybot.com if you '
                'suspect unauthorized access.',
            ],
        },
        {
            'heading': 'Educational Content — Not Financial Advice',
            'paragraphs': [
                'MoneyBot provides financial literacy education, interactive courses, '
                'and AI-powered tutoring for informational and educational purposes '
                'only. Nothing in the Service constitutes financial, investment, tax, '
                'legal, or professional advice.',
                'You should consult qualified professionals before making financial '
                'decisions. MoneyBot is not a registered investment adviser, '
                'broker-dealer, or financial planner.',
            ],
        },
        {
            'heading': 'AI Features',
            'paragraphs': [
                'MoneyBot Tutor and Money Chat use artificial intelligence to generate '
                'responses. AI outputs may be inaccurate, incomplete, or outdated. Do '
                'not rely on AI responses as a substitute for professional advice. You '
                'use AI features at your own discretion and risk.',
            ],
        },
        {
            'heading': 'Acceptable Use',
            'intro': 'You agree not to:',
            'bullets': [
                'Use the Service for any unlawful purpose',
                "Attempt to gain unauthorized access to our systems or other users' accounts",
                'Upload malicious code or interfere with the Service',
                'Harass, abuse, or harm others through chat features',
                'Scrape, reverse-engineer, or resell the Service',
                'Misrepresent your identity or affiliation',
            ],
            'paragraphs': [
                'We may suspend or terminate accounts that violate these rules.',
            ],
        },
        {
            'heading': 'Virtual Items and Progress',
            'paragraphs': [
                'XP, Bot Bucks, streaks, ranks, characters, and other in-app rewards '
                'have no real-world monetary value and cannot be exchanged for cash. '
                'We may modify, reset, or discontinue gamification features at any time.',
            ],
        },
        {
            'heading': 'Intellectual Property',
            'paragraphs': [
                'The Service, including its content, design, logos, and software, is '
                'owned by MoneyBot and protected by intellectual property laws. You '
                'receive a limited, non-exclusive, non-transferable license to use the '
                'Service for personal, non-commercial purposes.',
            ],
        },
        {
            'heading': 'Account Termination',
            'paragraphs': [
                'You may delete your account at any time through Settings > Delete '
                'Account. We may suspend or terminate your account if you violate these '
                'Terms or if we discontinue the Service. Upon termination, your right '
                'to use the Service ceases immediately.',
            ],
        },
        {
            'heading': 'Disclaimer of Warranties',
            'paragraphs': [
                'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES '
                'OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS '
                'FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT '
                'THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.',
            ],
        },
        {
            'heading': 'Limitation of Liability',
            'paragraphs': [
                'TO THE MAXIMUM EXTENT PERMITTED BY LAW, MONEYBOT AND ITS OFFICERS, '
                'DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, '
                'INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS '
                'OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.',
            ],
        },
        {
            'heading': 'Changes to Terms',
            'paragraphs': [
                'We may modify these Terms at any time. Material changes will be '
                'reflected in the "Last Updated" date. Continued use of the Service '
                'after changes constitutes acceptance of the revised Terms.',
            ],
        },
        {
            'heading': 'Governing Law',
            'paragraphs': [
                'These Terms are governed by the laws of the United States. Any '
                'disputes shall be resolved in the courts of competent jurisdiction, '
                'unless otherwise required by applicable consumer protection laws in '
                'your jurisdiction.',
            ],
        },
        {
            'heading': 'Contact Us',
            'paragraphs': [
                'Questions about these Terms? Contact us at kahlil@getmoneybot.com.',
            ],
        },
    ],
}

LEGAL_DOCUMENTS = {
    'privacy': PRIVACY_POLICY,
    'terms': TERMS_OF_SERVICE,
}
