import { prisma } from '../config/prisma.js';

export const userRepository = {
  findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },
  findPublicById(id) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, phone: true, name: true, address: true },
    });
  },
  create(data) {
    return prisma.user.create({ data });
  },
};
