/**
 * ----------------------------------------------------------------------
 * Bakewealth Brevo REST API Email Service
 * ----------------------------------------------------------------------
 * Provides transactional email delivery using the official Brevo REST API (v3).
 * API Endpoint: https://api.brevo.com/v3/smtp/email
 * 
 * Supported Email Flows:
 * 1. Welcome Message (with direct link to Onboarding Session)
 * 2. Staff Account Created (with credentials, temporary password & role)
 * 3. Subscription Expiring Soon Warning
 * 4. AI Scan Credits Running Low Warning
 * 5. Payment Receipt / Confirmation
 * ----------------------------------------------------------------------
 */

const { resolveAppUrl, sanitizePublicUrl } = require('../utils/urlHelper');

class EmailService {
  constructor() {
    this.apiBaseUrl = 'https://api.brevo.com/v3';
  }

  /**
   * Resolve Brevo API Key from environment
   */
  getApiKey() {
    return process.env.BREVO_API_KEY || process.env.BREVO_SMTP_KEY || '';
  }

  /**
   * Check if Brevo API is configured
   */
  isConfigured() {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  /**
   * Resolve default sender info
   */
  getSender() {
    const name = process.env.BREVO_FROM_NAME || 'Bakewealth';
    const email = process.env.BREVO_FROM_EMAIL || 'info@bakewealthinternational.com';
    return { name, email };
  }

  /**
   * Resolve formatted sender string
   */
  getSenderString() {
    const { name, email } = this.getSender();
    return `"${name}" <${email}>`;
  }

  /**
   * Resolve base App URL (dynamically honoring request origin, environment, or live domain)
   */
  getAppUrl(req = null) {
    return resolveAppUrl(req);
  }

  /**
   * Sanitize a URL to prevent sending localhost links to live users
   */
  sanitizeUrl(url, req = null) {
    return sanitizePublicUrl(url, req);
  }

  /**
   * Verify API connectivity with Brevo (v3 /account endpoint)
   */
  async verifyApi() {
    if (!this.isConfigured()) {
      return {
        configured: false,
        connected: false,
        message: 'Brevo API key (BREVO_API_KEY) not provided in environment.'
      };
    }

    try {
      const apiKey = this.getApiKey();
      const res = await fetch(`${this.apiBaseUrl}/account`, {
        method: 'GET',
        headers: {
          'api-key': apiKey,
          'accept': 'application/json'
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          configured: true,
          connected: false,
          message: `Brevo API rejected key (${res.status}): ${errData.message || res.statusText}`
        };
      }

      const accountData = await res.json();
      return {
        configured: true,
        connected: true,
        email: accountData.email,
        firstName: accountData.firstName,
        message: `Brevo API connection verified successfully for ${accountData.email}.`
      };
    } catch (error) {
      return {
        configured: true,
        connected: false,
        message: `Brevo API verification error: ${error.message}`
      };
    }
  }

  /**
   * Compatibility alias for verifyApi
   */
  async verifySmtp() {
    return this.verifyApi();
  }

  /**
   * Internal email dispatcher via Brevo v3 Transactional Email REST API
   */
  async sendMail({ to, toName, subject, html, text }) {
    const sender = this.getSender();

    if (!this.isConfigured()) {
      console.log(`[EmailService:Brevo API (Mock/Dev)] To: ${to} | Subject: "${subject}"`);
      console.log(`[EmailService:Brevo API (Mock/Dev)] Content preview: ${text.substring(0, 150)}...`);
      return {
        success: true,
        mocked: true,
        messageId: `mock-${Date.now()}`
      };
    }

    try {
      const apiKey = this.getApiKey();
      const payload = {
        sender: {
          name: sender.name,
          email: sender.email
        },
        to: [
          {
            email: to,
            name: toName || to
          }
        ],
        subject,
        htmlContent: html,
        textContent: text
      };

      const response = await fetch(`${this.apiBaseUrl}/smtp/email`, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errMsg = data.message || `Brevo API returned HTTP ${response.status}`;
        console.error(`[EmailService:Brevo API] Failed to send email to ${to}:`, errMsg);
        return {
          success: false,
          error: errMsg
        };
      }

      const messageId = data.messageId || `brevo-${Date.now()}`;
      console.log(`[EmailService:Brevo API] Sent email to ${to} (${messageId}) - "${subject}"`);
      return {
        success: true,
        mocked: false,
        messageId
      };
    } catch (error) {
      console.error(`[EmailService:Brevo API] Network error sending to ${to}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate standard Bakewealth HTML wrapper
   */
  wrapTemplate({ preheader = '', heading, content, ctaText, ctaUrl, footerNote = '' }) {
    const appUrl = this.getAppUrl();
    const currentYear = new Date().getFullYear();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F4EEE4;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #291608;
      -webkit-font-smoothing: antialiased;
    }
    table { border-collapse: collapse; }
    .container {
      max-width: 600px;
      margin: 30px auto;
      background: #FFFFFF;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(41, 22, 8, 0.08);
      border: 1px solid #E0D3BB;
    }
    .header {
      background: linear-gradient(135deg, #1b120c 0%, #291608 100%);
      padding: 32px 24px;
      text-align: center;
      border-bottom: 3px solid #c8912a;
    }
    .header-brand {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 28px;
      font-weight: 700;
      color: #c8912a;
      letter-spacing: 1px;
      margin: 0;
    }
    .header-tagline {
      font-size: 11px;
      color: #BBA086;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 4px;
    }
    .content-body {
      padding: 36px 32px;
      line-height: 1.6;
      font-size: 15px;
      color: #382415;
    }
    .content-heading {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 22px;
      font-weight: 700;
      color: #291608;
      margin-top: 0;
      margin-bottom: 18px;
    }
    .info-card {
      background: #FAF6EE;
      border: 1px solid #E0D3BB;
      border-left: 4px solid #c8912a;
      border-radius: 8px;
      padding: 18px 20px;
      margin: 22px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px dashed #E0D3BB;
      font-size: 14px;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0 20px;
    }
    .btn {
      display: inline-block;
      background-color: #c8912a;
      color: #FFFFFF !important;
      text-decoration: none;
      padding: 14px 34px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 8px;
      letter-spacing: 0.5px;
    }
    .footer {
      background: #FAF6EE;
      padding: 24px 32px;
      text-align: center;
      border-top: 1px solid #E0D3BB;
      font-size: 12px;
      color: #8C6E52;
      line-height: 1.5;
    }
    .footer a {
      color: #c8912a;
      text-decoration: none;
    }
  </style>
</head>
<body>
  ${preheader ? `<span style="display:none;font-size:1px;color:#F4EEE4;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</span>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 20px 12px;">
        <div class="container">
          <!-- Header -->
          <div class="header">
            <h1 class="header-brand">Bakewealth</h1>
            <div class="header-tagline">Bakery Financial Operating System</div>
          </div>
          
          <!-- Body Content -->
          <div class="content-body">
            <h2 class="content-heading">${heading}</h2>
            ${content}

            ${ctaText && ctaUrl ? `
            <div class="btn-container">
              <a href="${ctaUrl}" target="_blank" class="btn">${ctaText}</a>
            </div>` : ''}

            ${footerNote ? `<p style="font-size: 13px; color: #8C6E52; margin-top: 24px;">${footerNote}</p>` : ''}
          </div>

          <!-- Footer -->
          <div class="footer">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #291608;">Bakewealth &bull; Financial Intelligence for Artisan Bakeries</p>
            <p style="margin: 0 0 8px 0;">Have questions or need assistance? Reply directly to this email or visit our portal at <a href="${appUrl}">${appUrl}</a>.</p>
            <p style="margin: 0; font-size: 11px; color: #A08872;">&copy; ${currentYear} Bakewealth. All rights reserved.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * 0. Send Account Activation Email (with link to activate and proceed to onboarding)
   */
  async sendActivationEmail({ to, name, companyName, activationUrl }) {
    const appUrl = this.getAppUrl();
    const finalActivationUrl = this.sanitizeUrl(activationUrl || `${appUrl}/?activate=1`);
    const displayName = name || 'Baker';
    const businessName = companyName || 'your bakery';

    const subject = `Activate Your Bakewealth Account - ${businessName}`;
    const preheader = `Please activate your Bakewealth account to complete registration and launch your onboarding session.`;

    const content = `
          <p>Hello <strong>${displayName}</strong>,</p>
          <p>Thank you for signing up for <strong>Bakewealth</strong>! We are excited to help <strong>${businessName}</strong> achieve effortless recipe costing, accurate inventory tracking, and full financial intelligence.</p>
          
          <div class="info-card">
            <div style="font-weight: 700; color: #c8912a; margin-bottom: 8px; font-size: 15px;">Starter Welcome Allowance Ready</div>
            <p style="margin: 0; font-size: 14px; color: #5A3D20;">
              Once activated, your workspace will be ready with <strong>10 Free AI Invoice Scans (20 credits)</strong> and access to the interactive setup wizard.
            </p>
          </div>

          <p>Please click the button below to activate your account and start your interactive onboarding session:</p>
        `;

    const text = `Hello ${displayName},

Thank you for signing up for Bakewealth! Please activate your account to get started with recipe costing, inventory control, and financial operations.

Activate your account and start onboarding here:
${finalActivationUrl}

This activation link is valid for 24 hours. If you did not create a Bakewealth account, you can safely ignore this email.

Best regards,
The Bakewealth Team`;

    const html = this.wrapTemplate({
      preheader,
      heading: `Activate Your Account`,
      content,
      ctaText: 'Activate My Account & Start Onboarding →',
      ctaUrl: finalActivationUrl,
      footerNote: `This activation link is valid for 24 hours. If the button above doesn't work, copy and paste this link into your browser:<br/><a href="${finalActivationUrl}" style="color: #c8912a; word-break: break-all;">${finalActivationUrl}</a>`
    });

    return this.sendMail({ to, toName: displayName, subject, html, text });
  }

  /**
   * 1. Send Welcome Email (with link to onboarding session)
   */
  async sendWelcomeEmail({ to, name, companyName, onboardingUrl }) {
    const appUrl = this.getAppUrl();
    const finalOnboardingUrl = this.sanitizeUrl(onboardingUrl || `${appUrl}/?onboarding=1`);
    const displayName = name || 'Baker';
    const businessName = companyName || 'your bakery';

    const subject = `Welcome to Bakewealth - Your Bakery Financial Operating System`;
    const preheader = `Get started with your Bakewealth bakery financial operating system.`;

    const content = `
          <p>Hello <strong>${displayName}</strong>,</p>
          <p>Welcome to <strong>Bakewealth</strong>! We are thrilled to partner with <strong>${businessName}</strong> to streamline your recipe costing, inventory control, and real-time bakery profitability.</p>
          
          <div class="info-card">
            <div style="font-weight: 700; color: #c8912a; margin-bottom: 8px; font-size: 15px;">Your Starter Welcome Allowance</div>
            <p style="margin: 0; font-size: 14px; color: #5A3D20;">
              Your account has been credited with <strong>10 Free AI Invoice Scans (20 credits)</strong> so you can instantly scan ingredient receipts and test automatic cost updates.
            </p>
          </div>

          <p>To help you set up your bakery's ingredients, baseline recipes, and financial targets, we have prepared an interactive <strong>Onboarding Session</strong> for you.</p>
          
          <p>Click the button below to launch your onboarding session and configure your workspace in under 3 minutes:</p>
        `;

    const text = `Hello ${displayName},

Welcome to Bakewealth! We are thrilled to partner with ${businessName} to streamline your recipe costing, inventory control, and bakery profitability.

Your account includes 10 Free AI Invoice Scans (20 credits) to get started immediately.

Launch your onboarding session here:
${finalOnboardingUrl}

Best regards,
The Bakewealth Team`;

    const html = this.wrapTemplate({
      preheader,
      heading: `Welcome to Bakewealth!`,
      content,
      ctaText: 'Start Your Onboarding Session',
      ctaUrl: finalOnboardingUrl,
      footerNote: `If you have already finished onboarding, you can log in any time at ${appUrl}.`
    });

    return this.sendMail({ to, toName: displayName, subject, html, text });
  }

  /**
   * 2. Send Staff Invitation Email (with password and credentials)
   */
  async sendStaffInviteEmail({ to, name, companyName, role, password, pin, loginUrl }) {
    const appUrl = this.getAppUrl();
    const finalLoginUrl = this.sanitizeUrl(loginUrl || appUrl);
    const displayName = name || 'Team Member';
    const businessName = companyName || 'Bakewealth Workspace';
    const roleLabel = (role || 'Staff').replace(/_/g, ' ').toUpperCase();

    const subject = `Your Bakewealth Staff Account is Ready - ${businessName}`;
    const preheader = `Your staff credentials and login link for ${businessName}.`;

    const content = `
          <p>Hello <strong>${displayName}</strong>,</p>
          <p>You have been added as a team member to <strong>${businessName}</strong> on <strong>Bakewealth</strong>.</p>
          
          <p>Here are your account credentials to access the bakery workspace:</p>

          <div class="info-card">
            <div class="info-row">
              <span style="color:#7B5A3A;font-weight:600;">Login Email:</span>
              <strong style="color:#291608;">${to}</strong>
            </div>
            <div class="info-row">
              <span style="color:#7B5A3A;font-weight:600;">Temporary Password:</span>
              <strong style="color:#c8912a;font-family:monospace;font-size:15px;">${password}</strong>
            </div>
            <div class="info-row">
              <span style="color:#7B5A3A;font-weight:600;">Assigned Role:</span>
              <span style="font-weight:600;color:#291608;">${roleLabel}</span>
            </div>
            ${pin ? `
            <div class="info-row">
              <span style="color:#7B5A3A;font-weight:600;">Quick PIN:</span>
              <strong style="color:#291608;letter-spacing:2px;">${pin}</strong>
            </div>` : ''}
          </div>

          <p>Click below to log in to the bakery books and start managing daily production and inventory:</p>
        `;

    const text = `Hello ${displayName},

You have been added to ${businessName} on Bakewealth with the role: ${roleLabel}.

Your Credentials:
- Login Email: ${to}
- Temporary Password: ${password}
- Role: ${roleLabel}
${pin ? `- Quick PIN: ${pin}\n` : ''}
Log in to Bakewealth here:
${finalLoginUrl}

For security, please keep your credentials safe.

Best regards,
Bakewealth`;

    const html = this.wrapTemplate({
      preheader,
      heading: `Welcome to the Team!`,
      content,
      ctaText: 'Log In to Bakewealth',
      ctaUrl: finalLoginUrl,
      footerNote: `Important: For your security, do not share your temporary password with unauthorized persons.`
    });

    return this.sendMail({ to, toName: displayName, subject, html, text });
  }

  /**
   * 3. Send Subscription Expiring Soon Warning
   */
  async sendSubscriptionExpiringEmail({ to, name, companyName, planName, daysRemaining, expiresAt, renewalUrl }) {
    const appUrl = this.getAppUrl();
    const finalRenewalUrl = this.sanitizeUrl(renewalUrl || `${appUrl}/settings?tab=subscription`);
    const displayName = name || 'Bakery Owner';
    const formattedPlan = (planName || 'Standard').toUpperCase();
    const formattedDate = expiresAt ? new Date(expiresAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : 'Soon';

    const subject = `Notice: Your Bakewealth Subscription is Expiring Soon (${daysRemaining} Days Left)`;
    const preheader = `Your ${formattedPlan} plan on Bakewealth will expire on ${formattedDate}.`;

    const content = `
          <p>Hello <strong>${displayName}</strong>,</p>
          <p>This is a friendly reminder that your <strong>Bakewealth ${formattedPlan} Subscription</strong> for <strong>${companyName || 'your bakery'}</strong> will expire on <strong>${formattedDate}</strong> (${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining).</p>
          
          <div class="info-card">
            <div class="info-row">
              <span style="color:#7B5A3A;font-weight:600;">Active Plan:</span>
              <strong>${formattedPlan}</strong>
            </div>
            <div class="info-row">
              <span style="color:#7B5A3A;font-weight:600;">Expiration Date:</span>
              <strong style="color:#c8912a;">${formattedDate}</strong>
            </div>
            <div class="info-row">
              <span style="color:#7B5A3A;font-weight:600;">Days Remaining:</span>
              <strong>${daysRemaining} Day${daysRemaining === 1 ? '' : 's'}</strong>
            </div>
          </div>

          <p>To ensure uninterrupted access to your staff logins, automated invoice scans, and multi-user bakery bookkeeping, renew your subscription before the expiry date.</p>
        `;

    const text = `Hello ${displayName},

Your Bakewealth ${formattedPlan} subscription for ${companyName || 'your bakery'} will expire on ${formattedDate} (${daysRemaining} days left).

Renew your plan here to prevent service interruption:
${finalRenewalUrl}

Best regards,
Bakewealth`;

    const html = this.wrapTemplate({
      preheader,
      heading: `Subscription Expiring Soon`,
      content,
      ctaText: 'Renew Subscription Now',
      ctaUrl: finalRenewalUrl,
      footerNote: `Prepaid plans stack seamlessly onto your current balance without losing any remaining days.`
    });

    return this.sendMail({ to, toName: displayName, subject, html, text });
  }

  /**
   * 4. Send AI Scan Token Quota Low Warning
   */
  async sendTokenLowEmail({ to, name, companyName, tokenBalance, scansRemaining, topUpUrl }) {
    const appUrl = this.getAppUrl();
    const finalTopUpUrl = this.sanitizeUrl(topUpUrl || `${appUrl}/tokens`);
    const displayName = name || 'Bakery Owner';

    const subject = `Alert: Your Bakewealth Scan Credits are Running Low`;
    const preheader = `You have ${scansRemaining} AI scan${scansRemaining === 1 ? '' : 's'} remaining.`;

    const content = `
          <p>Hello <strong>${displayName}</strong>,</p>
          <p>Your AI invoice scanning balance for <strong>${companyName || 'your bakery'}</strong> is running low.</p>
          
          <div class="info-card">
            <div class="info-row">
              <span style="color:#7B5A3A;font-weight:600;">Remaining Balance:</span>
              <strong style="color:#c8912a;font-size:16px;">${tokenBalance} Credits</strong>
            </div>
            <div class="info-row">
              <span style="color:#7B5A3A;font-weight:600;">Estimated Scans Left:</span>
              <strong>${scansRemaining} Scan${scansRemaining === 1 ? '' : 's'}</strong>
            </div>
          </div>

          <p>When credits run out, automatic invoice extraction and recipe cost recalculation will be paused until you top up.</p>
          <p>You can top up credits instantly at any time to keep your ingredient price sync uninterrupted:</p>
        `;

    const text = `Hello ${displayName},

Your Bakewealth AI scan credits are running low.
Remaining Balance: ${tokenBalance} credits (~${scansRemaining} scans remaining).

Top up your scan credits here:
${finalTopUpUrl}

Best regards,
Bakewealth`;

    const html = this.wrapTemplate({
      preheader,
      heading: `Scan Credits Running Low`,
      content,
      ctaText: 'Top Up Scan Credits',
      ctaUrl: finalTopUpUrl,
      footerNote: `Scan credits never expire and roll over automatically with your account.`
    });

    return this.sendMail({ to, toName: displayName, subject, html, text });
  }

  /**
   * 5. Send Payment Receipt / Confirmation
   */
  async sendPaymentReceiptEmail({ to, name, companyName, paymentReference, amount, currency = 'NGN', resourceType, resourceDetails, paidAt, accountUrl }) {
    const appUrl = this.getAppUrl();
    const finalAccountUrl = this.sanitizeUrl(accountUrl || appUrl);
    const displayName = name || 'Customer';
    const formattedAmount = Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedDate = paidAt ? new Date(paidAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : new Date().toLocaleDateString('en-US');

    const itemLabel = resourceDetails || (resourceType === 'subscription_plan' ? 'Subscription Renewal' : resourceType === 'credit_pack' ? 'AI Scan Credits Pack' : 'Bakewealth Payment');

    const subject = `Payment Confirmation: ${paymentReference} - Bakewealth`;
    const preheader = `Payment of ${currency} ${formattedAmount} received successfully.`;

    const content = `
          <p>Hello <strong>${displayName}</strong>,</p>
          <p>Thank you for your payment! We have received your payment for <strong>${companyName || 'your account'}</strong> and your services are updated immediately.</p>
          
          <div class="info-card">
            <div class="info-row">
              <span style="color:#7B5A3A;font-weight:600;">Payment Reference:</span>
              <strong style="font-family:monospace;color:#291608;">${paymentReference}</strong>
            </div>
            <div class="info-row">
              <span style="color:#7B5A3A;font-weight:600;">Amount Paid:</span>
              <strong style="color:#c8912a;font-size:16px;">${currency} ${formattedAmount}</strong>
            </div>
            <div class="info-row">
              <span style="color:#7B5A3A;font-weight:600;">Product / Service:</span>
              <strong>${itemLabel}</strong>
            </div>
            <div class="info-row">
              <span style="color:#7B5A3A;font-weight:600;">Date & Time:</span>
              <span>${formattedDate}</span>
            </div>
            <div class="info-row">
              <span style="color:#7B5A3A;font-weight:600;">Status:</span>
              <strong style="color:#2e7d32;">COMPLETED</strong>
            </div>
          </div>

          <p>Your invoice and transaction history can be viewed inside your Bakewealth portal at any time.</p>
        `;

    const text = `Hello ${displayName},

Thank you for your payment! We have received your payment for ${companyName || 'your account'}.

Receipt Details:
- Reference: ${paymentReference}
- Amount: ${currency} ${formattedAmount}
- Item: ${itemLabel}
- Date: ${formattedDate}
- Status: COMPLETED

View your account here:
${finalAccountUrl}

Best regards,
Bakewealth`;

    const html = this.wrapTemplate({
      preheader,
      heading: `Payment Received`,
      content,
      ctaText: 'Go to Your Account',
      ctaUrl: finalAccountUrl,
      footerNote: `Please retain this email as an official proof of payment for your bakery records.`
    });

    return this.sendMail({ to, toName: displayName, subject, html, text });
  }
}

module.exports = new EmailService();
