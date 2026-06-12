const cron = require('node-cron');
const db = require('../config/db');
const { sendTaskReminderEmail } = require('./emailService');
const { sendPushNotification } = require('./pushService');

function getRequiredInterval(dueTimeStr) {
  const now = new Date();
  const dueTime = new Date(dueTimeStr);
  const diffMs = dueTime - now;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) return 4 * 60 * 60 * 1000;        // Overdue: 4h
  if (diffDays <= 1) return 8 * 60 * 60 * 1000;     // ≤1 day: 8h
  if (diffDays <= 3) return 12 * 60 * 60 * 1000;    // ≤3 days: 12h
  return null; // >3 days: no notification
}

async function processNotifications() {
  try {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Get pending tasks that are overdue or due within 3 days
    const tasks = await db.all(`
      SELECT t.*, u.email as userEmail, u.pushSubscription
      FROM tasks t
      LEFT JOIN users u ON t.userId = u.id
      WHERE t.isDone = 0
        AND (
          t.dueTime < ?
          OR (t.dueTime >= ? AND t.dueTime <= ?)
        )
    `, [
      now.toISOString(),
      now.toISOString(),
      threeDaysLater.toISOString(),
    ]);

    console.log(`[Cron] Checking ${tasks.length} tasks...`);

    for (const task of tasks) {
      const interval = getRequiredInterval(task.dueTime);
      if (interval === null) continue;

      // Check if enough time has passed
      if (task.lastNotifiedAt) {
        const timeSinceLast = now - new Date(task.lastNotifiedAt);
        if (timeSinceLast < interval) continue;
      }

      const notifyTypes = JSON.parse(task.notifyTypes || '[]');
      const recipients = JSON.parse(task.recipients || '[]');
      let notified = false;

      // Email notification
      if (notifyTypes.includes('email') && recipients.length > 0) {
        await sendTaskReminderEmail(recipients, task);
        notified = true;
      }

      // Push notification
      if (notifyTypes.includes('push') && task.pushSubscription) {
        try {
          const sub = JSON.parse(task.pushSubscription);
          const result = await sendPushNotification(sub, task);
          if (result && result.expired) {
            await db.run("UPDATE users SET pushSubscription = NULL WHERE id = ?", [task.userId]);
          }
          notified = true;
        } catch (e) {
          console.error('[Cron] Push parse error:', e);
        }
      }

      if (notified) {
        await db.run("UPDATE tasks SET lastNotifiedAt = ? WHERE id = ?", [now.toISOString(), task.id]);
        console.log(`[Cron] Notified: "${task.title}" (id=${task.id})`);
      }
    }
  } catch (err) {
    console.error('[Cron] Error:', err);
  }
}

function startCronJob() {
  cron.schedule('* * * * *', async () => {
    console.log(`[Cron] Running at ${new Date().toISOString()}`);
    await processNotifications();
  });
  console.log('[Cron] Started (every 1 minute)');
}

module.exports = { startCronJob, processNotifications };
