const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const departments = await prisma.department.findMany({
    where: { active: true },
    include: {
      User: {
        where: {
          role: {
            in: ['LECTURER', 'HEAD']
          },
          active: true
        },
        select: {
          full_name: true,
          email: true,
          role: true
        }
      }
    }
  });

  console.log('# DANH SÁCH GIẢNG VIÊN THEO BỘ MÔN\n');
  
  departments.forEach(dept => {
    console.log(`## BỘ MÔN: ${dept.name} (${dept.code})`);
    if (dept.User.length === 0) {
      console.log('* Không có giảng viên nào\n');
    } else {
      dept.User.forEach(user => {
        const roleLabel = user.role === 'HEAD' ? '[Trưởng bộ môn]' : '[Giảng viên]';
        console.log(`- ${user.full_name} - ${user.email} ${roleLabel}`);
      });
      console.log('');
    }
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
