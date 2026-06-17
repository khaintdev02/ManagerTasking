const nodemailer = require('nodemailer');
const https = require('https');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      tls: {
        rejectUnauthorized: false
      },
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
}

function sendViaBrevo(recipients, subject, htmlContent) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      sender: {
        name: "Task Manager 📋",
        email: process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER
      },
      to: recipients.map(email => ({ email })),
      subject: subject,
      htmlContent: htmlContent
    });

    const options = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          console.error('[Brevo API] Failed with status:', res.statusCode, body);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Brevo API] Connection error:', err.message);
      resolve(false);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Send task reminder email to multiple recipients
 * @param {string[]} recipients - Array of email addresses
 * @param {Object} task - Task object
 */
async function sendTaskReminderEmail(recipients, task) {
  if (!recipients || recipients.length === 0) return false;

  const dueDate = new Date(task.dueTime);
  const now = new Date();
  const diffMs = dueDate - now;
  const diffHours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
  const isOverdue = diffMs < 0;

  const APP_URL = process.env.APP_URL || 'http://localhost:5174';
  const taskLink = `${APP_URL}/tasks`;

  const statusText = isOverdue
    ? `⚠️ Quá hạn ${diffHours} giờ`
    : `⏰ Còn ${diffHours} giờ`;

  const statusColor = isOverdue ? '#e74c3c' : diffHours <= 24 ? '#f39c12' : '#3498db';
  const statusBg = isOverdue ? '#fff3f3' : diffHours <= 24 ? '#fffbf0' : '#f0f7ff';
  const statusLabel = isOverdue ? 'QUÁ HẠN' : diffHours <= 24 ? 'SẮP HẾT HẠN' : 'ĐANG CHỜ';

  const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Nhắc nhở công việc</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6c63ff,#00d4aa);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <div style="font-size:36px;margin-bottom:8px;">📋</div>
              <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Nhắc nhở công việc</h1>
              <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Task Manager System</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#1a1f2e;padding:32px 40px;">

              <!-- Status Banner -->
              <div style="background:${statusBg};border-left:4px solid ${statusColor};border-radius:8px;padding:14px 20px;margin-bottom:24px;">
                <p style="margin:0;font-size:20px;font-weight:700;color:${statusColor};">${statusText}</p>
                <span style="display:inline-block;background:${statusColor};color:#fff;font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;margin-top:6px;letter-spacing:0.5px;">${statusLabel}</span>
              </div>

              <!-- Task Title -->
              <h2 style="color:#e8eaf6;font-size:22px;font-weight:700;margin:0 0 8px;line-height:1.3;">${task.title}</h2>

              ${task.description ? `
              <!-- Description -->
              <p style="color:#8892a4;font-size:15px;line-height:1.7;margin:0 0 24px;padding:16px;background:#0f1117;border-radius:8px;border:1px solid #1e2540;">${task.description}</p>
              ` : '<div style="margin-bottom:24px;"></div>'}

              <!-- Info Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;border-radius:10px;border:1px solid #1e2540;overflow:hidden;margin-bottom:28px;">
                <tr style="border-bottom:1px solid #1e2540;">
                  <td style="padding:14px 20px;color:#8892a4;font-size:13px;width:130px;">📅 Deadline</td>
                  <td style="padding:14px 20px;color:#e8eaf6;font-size:14px;font-weight:600;">${dueDate.toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' })}</td>
                </tr>
                <tr style="border-bottom:1px solid #1e2540;">
                  <td style="padding:14px 20px;color:#8892a4;font-size:13px;">⏱ Thời gian</td>
                  <td style="padding:14px 20px;font-size:14px;font-weight:700;color:${statusColor};">${statusText}</td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;color:#8892a4;font-size:13px;">🔔 Loại nhắc</td>
                  <td style="padding:14px 20px;">
                    ${Array.isArray(task.notifyTypes) && task.notifyTypes.includes('email')
                      ? '<span style="background:rgba(30,144,255,0.15);color:#1e90ff;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">✉ Email</span> '
                      : ''}
                    ${Array.isArray(task.notifyTypes) && task.notifyTypes.includes('push')
                      ? '<span style="background:rgba(108,99,255,0.15);color:#6c63ff;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">🔔 Push</span>'
                      : ''}
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <div style="text-align:center;margin-bottom:8px;">
                <a href="${taskLink}"
                   style="display:inline-block;background:linear-gradient(135deg,#6c63ff,#8b83ff);color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.3px;box-shadow:0 8px 25px rgba(108,99,255,0.4);">
                  🚀 Xem & Cập nhật Task
                </a>
              </div>
              <p style="text-align:center;color:#4a5568;font-size:12px;margin:12px 0 0;">
                Hoặc truy cập trực tiếp: <a href="${taskLink}" style="color:#6c63ff;">${taskLink}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#111318;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;border-top:1px solid #1e2540;">
              <p style="color:#4a5568;font-size:12px;margin:0;line-height:1.6;">
                Email này được gửi tự động từ <strong style="color:#6c63ff;">Task Manager</strong>.<br/>
                Vui lòng không reply trực tiếp vào email này.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const subject = `${isOverdue ? '⚠️ [QUÁ HẠN]' : '⏰ [Nhắc nhở]'} ${task.title}`;

  // If Brevo API is configured, use it (recommended for Render to bypass SMTP blocking)
  if (process.env.BREVO_API_KEY) {
    const success = await sendViaBrevo(recipients, subject, htmlContent);
    if (success) {
      console.log(`[Email] ✅ Sent reminder (Brevo API) for "${task.title}" → ${recipients.join(', ')}`);
      return true;
    }
    return false;
  }

  // Fallback to SMTP
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[Email] Neither BREVO_API_KEY nor SMTP credentials configured, skipping email.');
    return false;
  }

  try {
    await getTransporter().sendMail({
      from: `"Task Manager 📋" <${process.env.EMAIL_USER}>`,
      to: recipients.join(', '),
      subject: subject,
      html: htmlContent,
    });
    console.log(`[Email] ✅ Sent reminder (SMTP) for "${task.title}" → ${recipients.join(', ')}`);
    return true;
  } catch (err) {
    console.error(`[Email] ❌ Failed (SMTP) for "${task.title}":`, err.message);
    return false;
  }
}

module.exports = { sendTaskReminderEmail };
