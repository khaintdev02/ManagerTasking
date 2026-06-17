const cron = require('node-cron');
const db = require('../config/db');
const { sendTaskReminderEmail } = require('./emailService');
const { sendPushNotification } = require('./pushService');



async function processNotifications() {
  try {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Get pending tasks that are overdue, due within 3 days, or have a notification cycle set
    const tasks = await db.all(`
      SELECT t.*, u.email as userEmail, u.pushSubscription
      FROM tasks t
      LEFT JOIN users u ON t.userId = u.id
      WHERE t.isDone = 0
        AND (
          t.dueTime < ?
          OR (t.dueTime >= ? AND t.dueTime <= ?)
          OR t.notifyCycle IN ('daily', 'weekly', 'monthly')
        )
    `, [
      now.toISOString(),
      now.toISOString(),
      threeDaysLater.toISOString(),
    ]);

    for (const task of tasks) {
      if (task.notifyCycle === 'none') {
        // Non-recurring tasks: only notify once when the due time is reached/passed
        if (now < new Date(task.dueTime)) {
          continue;
        }
        if (task.lastNotifiedAt) {
          continue; // Already notified once
        }
      } else {
        // Cyclic reminders: do not send if the initial due time is in the future
        if (now < new Date(task.dueTime)) {
          continue;
        }

        let interval = null;
        if (task.notifyCycle === 'daily') {
          interval = 24 * 60 * 60 * 1000; // 24 hours
        } else if (task.notifyCycle === 'weekly') {
          interval = 7 * 24 * 60 * 60 * 1000; // 7 days
        } else if (task.notifyCycle === 'monthly') {
          interval = 30 * 24 * 60 * 60 * 1000; // 30 days
        }

        if (interval === null) continue;

        // Check if enough time has passed since the last cyclic notification
        if (task.lastNotifiedAt) {
          const lastNotified = new Date(task.lastNotifiedAt);
          const timeSinceLast = now - lastNotified;
          if (timeSinceLast < interval) continue;
        }
      }

      const notifyTypes = JSON.parse(task.notifyTypes || '[]');
      const recipients = JSON.parse(task.recipients || '[]');
      let notified = false;

      // Email notification
      if (notifyTypes.includes('email') && recipients.length > 0) {
        const success = await sendTaskReminderEmail(recipients, task);
        if (success) notified = true;
      }

      // Push notification
      if (notifyTypes.includes('push') && task.pushSubscription) {
        try {
          const sub = JSON.parse(task.pushSubscription);
          const result = await sendPushNotification(sub, task);
          if (result === true) {
            notified = true;
          } else if (result && result.expired) {
            await db.run("UPDATE users SET pushSubscription = NULL WHERE id = ?", [task.userId]);
          }
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
