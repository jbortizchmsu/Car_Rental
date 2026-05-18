import { prisma } from './prisma';
import { io } from '../index';

export async function createNotification(userId: string, title: string, message: string) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        isRead: false
      }
    });

    // Emit real-time event via Socket.io
    // Emit to a specific user's room or globally for simplicity in dev
    // Ideally, users join a room named by their userId
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
