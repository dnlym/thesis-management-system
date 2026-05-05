import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

function removeAccents(str: string) {
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function generateNewEmail(fullName: string, counts: Record<string, number>) {
  // Remove titles
  let name = fullName.replace(/^(ThS\.|TS\.|PGS\.TS\.|GS\.TS\.|KS\.|ThS\. NCS\.)\s+/i, '');
  name = name.replace(/\s*\(.*\)$/, '');
  name = removeAccents(name).toLowerCase();
  
  const parts = name.split(/\s+/).filter(p => p.length > 0);
  if (parts.length < 1) return 'user1@iuh.edu.vn';
  
  const lastName = parts[0];
  const firstName = parts[parts.length - 1];
  
  const base = `${lastName}${firstName}`;
  counts[base] = (counts[base] || 0) + 1;
  
  return `${base}${counts[base]}@iuh.edu.vn`;
}

async function main() {
  const users = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.LECTURER, UserRole.HEAD] }
    }
  });

  console.log(`Found ${users.length} lecturers/heads to update.`);
  
  const emailCounts: Record<string, number> = {};
  
  for (const user of users) {
    const newEmail = generateNewEmail(user.full_name, emailCounts);
    
    // Check if new email already exists (excluding current user)
    // Actually we are updating ALL, so we might have temporary conflicts.
    // I'll update them one by one.
    
    await prisma.user.update({
      where: { id: user.id },
      data: { email: newEmail }
    });
    console.log(`Updated: ${user.full_name} -> ${newEmail}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
