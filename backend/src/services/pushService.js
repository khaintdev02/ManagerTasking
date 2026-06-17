const webpush = require('web-push');

let initialized = false;

function initWebPush() {
  if (!initialized && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@taskmanager.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    initialized = true;
  }
}

/**
 * Send push notification to a user's subscription
 * @param {Object} subscription - Push subscription object stored in DB
 * @param {Object} task - Task object
 */
async function sendPushNotification(subscription, task) {
  if (!subscription) return false;

  initWebPush();

  if (!initialized) {
    console.warn('[Push] VAPID keys not configured, skipping push notification.');
    return false;
  }

  const dueDate = new Date(task.dueTime);
  const now = new Date();
  const diffMs = dueDate - now;
  const diffHours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
  const isOverdue = diffMs < 0;

  const payload = JSON.stringify({
    title: isOverdue
      ? `⚠️ Quá hạn: ${task.title}`
      : `⏰ Nhắc nhở: ${task.title}`,
    body: isOverdue
      ? `Công việc đã quá hạn ${diffHours} giờ! Vui lòng xử lý ngay.`
      : `Còn ${diffHours} giờ đến deadline. Đừng quên hoàn thành!`,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: `task-${task.id}`,
    data: { taskId: task.id, url: '/tasks' },
  });

  try {
    await webpush.sendNotification(subscription, payload);
    console.log(`[Push] Sent notification for task "${task.title}"`);
    return true;
  } catch (err) {
    console.error(`[Push] Failed for task "${task.title}":`, err.message);
    // If subscription expired/invalid, return error so caller can clean up
    if (err.statusCode === 410) {
      return { expired: true };
    }
    return false;
  }
}

module.exports = { sendPushNotification };
