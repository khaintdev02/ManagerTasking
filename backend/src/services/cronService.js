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
  if (diffDays <= 3) return 24 * 60 * 60 * 1000;    // ≤3 days: 24h
  return null; // >3 days: no notification
}

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
        // Non-recurring tasks: use the standard reminder intervals (4h overdue, 8h soon, 12h pending)
        const interval = getRequiredInterval(task.dueTime);
        if (interval === null) continue;

        if (task.lastNotifiedAt) {
          const lastNotified = new Date(task.lastNotifiedAt);
          const dueTime = new Date(task.dueTime);
          
          // If it transitioned to overdue since the last notification, notify immediately
          const transitionedToOverdue = (lastNotified < dueTime && now >= dueTime);

          if (!transitionedToOverdue) {
            const timeSinceLast = now - lastNotified;
            if (timeSinceLast < interval) continue;
          }
        }
      } else {
        // Cyclic reminders: do not send if the initial due time is in the future
        const dueTime = new Date(task.dueTime);
        if (now < dueTime) {
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
          
          // If it transitioned to due/overdue since the last notification, notify immediately
          const transitionedToDue = (lastNotified < dueTime && now >= dueTime);

          if (!transitionedToDue) {
            const timeSinceLast = now - lastNotified;
            if (timeSinceLast < interval) continue;
          }
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
        const history = JSON.parse(task.notificationHistory || '[]');
        history.push({
          sentAt: now.toISOString(),
          types: notifyTypes,
          recipients: recipients
        });

        let lastNotifiedTime = now.toISOString();
        if (task.notifyCycle && task.notifyCycle !== 'none') {
          const dueTime = new Date(task.dueTime);
          let interval = null;
          if (task.notifyCycle === 'daily') {
            interval = 24 * 60 * 60 * 1000;
          } else if (task.notifyCycle === 'weekly') {
            interval = 7 * 24 * 60 * 60 * 1000;
          } else if (task.notifyCycle === 'monthly') {
            interval = 30 * 24 * 60 * 60 * 1000;
          }

          if (interval !== null) {
            const msPassed = now.getTime() - dueTime.getTime();
            const periodsPassed = Math.floor(msPassed / interval);
            const lastScheduledTime = new Date(dueTime.getTime() + periodsPassed * interval);
            lastNotifiedTime = lastScheduledTime.toISOString();
          }
        }

        await db.run(
          "UPDATE tasks SET lastNotifiedAt = ?, notificationHistory = ? WHERE id = ?",
          [lastNotifiedTime, JSON.stringify(history), task.id]
        );
        console.log(`[Cron] Notified: "${task.title}" (id=${task.id}), lastNotifiedAt set to ${lastNotifiedTime}`);
      }
    }
  } catch (err) {
    console.error('[Cron] Error:', err);
  }
}

async function alignAllTaskSchedules() {
  try {
    const now = new Date();
    const tasks = await db.all(`
      SELECT id, dueTime, notifyCycle, lastNotifiedAt 
      FROM tasks 
      WHERE isDone = 0 AND notifyCycle IN ('daily', 'weekly', 'monthly') AND lastNotifiedAt IS NOT NULL
    `);
    
    for (const task of tasks) {
      const dueTime = new Date(task.dueTime);
      if (now < dueTime) continue;
      
      let interval = null;
      if (task.notifyCycle === 'daily') {
        interval = 24 * 60 * 60 * 1000;
      } else if (task.notifyCycle === 'weekly') {
        interval = 7 * 24 * 60 * 60 * 1000;
      } else if (task.notifyCycle === 'monthly') {
        interval = 30 * 24 * 60 * 60 * 1000;
      }
      
      if (interval === null) continue;
      
      const lastNotified = new Date(task.lastNotifiedAt);
      const msPassed = lastNotified.getTime() - dueTime.getTime();
      if (msPassed < 0) continue;
      
      const periodsPassed = Math.floor(msPassed / interval);
      const lastScheduledTime = new Date(dueTime.getTime() + periodsPassed * interval);
      
      if (lastNotified.getTime() !== lastScheduledTime.getTime()) {
        await db.run("UPDATE tasks SET lastNotifiedAt = ? WHERE id = ?", [
          lastScheduledTime.toISOString(),
          task.id
        ]);
        console.log(`[Cron] Aligned task id=${task.id} lastNotifiedAt from ${task.lastNotifiedAt} to ${lastScheduledTime.toISOString()}`);
      }
    }
  } catch (err) {
    console.error('[Cron] Error aligning task schedules:', err);
  }
}

function startCronJob() {
  cron.schedule('*/5 * * * *', async () => {
    console.log(`[Cron] Running at ${new Date().toISOString()}`);
    await processNotifications();
  });

  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Running daily alignment...');
    await alignAllTaskSchedules();
  });

  console.log('[Cron] Started (notifications every 5m, alignment daily at midnight)');

  // Run once immediately on start to align existing drifted tasks
  alignAllTaskSchedules();
}

module.exports = { startCronJob, processNotifications, alignAllTaskSchedules };
