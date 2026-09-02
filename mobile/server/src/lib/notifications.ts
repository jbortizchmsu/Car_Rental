import { prisma } from './prisma';
import { io } from '../index';
import { NotificationType, generateNotificationMessage } from './notification-types';

export async function createNotification(userId: string, title: string, message: string) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        isRead: false,
        type: 'GENERAL',
        targetRole: 'all'
      }
    });

    // Emit real-time event via Socket.io
    io.to(userId).emit('notification-created', notification);
    io.emit('notification-any', notification); // Global event for admin/debug

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

export async function createAdminNotification(title: string, message: string) {
  try {
    // Find all admins
    const admins = await prisma.user.findMany({
      where: { role: 'admin' }
    });

    const notifications = await Promise.all(
      admins.map(admin => createNotification(admin.id, title, message))
    );

    return notifications;
  } catch (error) {
    console.error('Error creating admin notifications:', error);
  }
}

/**
 * Create a typed notification for admin users
 * Prevents duplicates by checking for the same type + referenceId within 24 hours
 */
export async function createTypedNotification(
  type: NotificationType,
  context: Record<string, any>,
  referenceId?: string,
  referenceType?: string
) {
  try {
    // Check for duplicate notification in last 24 hours
    if (referenceId) {
      const existingNotification = await prisma.notification.findFirst({
        where: {
          type,
          referenceId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      if (existingNotification) {
        console.log(`Skipped duplicate notification: ${type} for ${referenceId}`);
        return null;
      }
    }

    // Generate message and title from template
    const { title, message } = generateNotificationMessage(type, context);

    // Get all admin users
    const admins = await prisma.user.findMany({
      where: { role: 'admin' }
    });

    // Create notification for each admin
    const notifications = await Promise.all(
      admins.map(async (admin) => {
        const notification = await prisma.notification.create({
          data: {
            userId: admin.id,
            type,
            title,
            message,
            isRead: false,
            targetRole: 'admin',
            referenceId,
            referenceType,
            createdAt: new Date()
          }
        });

        // Emit real-time event via Socket.io
        io.to(admin.id).emit('notification-created', notification);

        return notification;
      })
    );

    return notifications;
  } catch (error) {
    console.error(`Error creating typed notification (${type}):`, error);
    return null;
  }
}

/**
 * Create a typed notification for a specific user (customer-facing).
 * Prevents duplicates by checking type + referenceId + userId within 24 hours.
 * Caller supplies explicit title and message (no template lookup).
 */
export async function createTypedUserNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  referenceId?: string,
  referenceType?: string
) {
  try {
    if (referenceId) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          type,
          referenceId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      });
      if (existing) {
        console.log(`Skipped duplicate user notification: ${type} for ${referenceId} (user: ${userId})`);
        return null;
      }
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        isRead: false,
        targetRole: 'customer',
        referenceId,
        referenceType,
        createdAt: new Date()
      }
    });

    io.to(userId).emit('notification-created', notification);
    return notification;
  } catch (error) {
    console.error(`Error creating typed user notification (${type}):`, error);
    return null;
  }
}

/**
 * Create a notification for a specific user
 */
export async function createUserNotification(
  userId: string,
  type: NotificationType,
  context: Record<string, any>,
  referenceId?: string,
  referenceType?: string
) {
  try {
    const { title, message } = generateNotificationMessage(type, context);

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        isRead: false,
        targetRole: 'customer',
        referenceId,
        referenceType,
        createdAt: new Date()
      }
    });

    // Emit real-time event
    io.to(userId).emit('notification-created', notification);

    return notification;
  } catch (error) {
    console.error('Error creating user notification:', error);
    return null;
  }
}
