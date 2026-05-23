import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mapping = [
  {
    supervisorName: 'Trần Thị Kim Chi',
    topics: [
      'Triển khai hệ thống ERP trong doanh nghiệp',
      'Tìm hiểu và ứng dụng công nghệ mới trong xây dựng hệ thống quản lý rạp chiếu phim',
      'Tìm hiểu các công nghệ mới và xây dựng hệ thống quản lý nhà hàng',
      'Tìm hiểu các công nghệ mới và Xây dựng hệ thống quản lý du lịch'
    ]
  },
  {
    supervisorName: 'Bùi Văn Đồng',
    topics: [
      'Hệ thống quản lý rạp chiếu phim',
      'Xây dựng Website quản lý giao hàng',
      'Nền tảng thương mại điện tử cho mua bán hàng hóa tự do giữa người tiêu dùng'
    ]
  },
  {
    supervisorName: 'Nguyễn Ngọc Dung',
    topics: [
      'Xây dựng hệ thống điểm danh sinh viên tự động bằng nhận diện khuôn mặt',
      'Xây dựng ứng dụng quản lý giao hàng'
    ]
  },
  {
    supervisorName: 'Ngô Hữu Dũng',
    topics: [
      'Nền tảng Lakehouse đa khách hàng',
      'Xây dựng hệ thống thương mại điện tử tích hợp chăm sóc khách hàng',
      'Hệ thống đặt sân bóng đá và quản lý lịch thi đấu',
      'Hệ thống quản lý kho thông minh tích hợp AI'
    ]
  },
  {
    supervisorName: 'Lê Trọng Hiền',
    topics: [
      'Xây dựng ứng dụng website đặt và quản lý tour du lịch'
    ]
  },
  {
    supervisorName: 'Phạm Thị Xuân Hiền',
    topics: [
      'Xây dựng website bán quần áo thời trang',
      'Chatbot tư vấn và bán điện thoại'
    ]
  },
  {
    supervisorName: 'Huỳnh Nam',
    topics: [
      'Thiết kế và xây dựng hệ thống đặt xe dịch vụ'
    ]
  },
  {
    supervisorName: 'Võ Ngọc Tấn Phước',
    topics: [
      'Xây dựng ứng dụng Thương mại điện tử tích hợp tính năng giao hàng',
      'Nghiên cứu các kỹ thuật bảo mật web'
    ]
  },
  {
    supervisorName: 'Phan Thị Bảo Trân',
    topics: [
      'Xây dựng hệ thống thi trực tuyến tích hợp AI nhận diện khuôn mặt chống gian lận'
    ]
  },
  {
    supervisorName: 'Lê Thùy Trang',
    topics: [
      'Xây dựng website quản lý sản xuất cho nhà máy'
    ]
  }
];

async function main() {
  console.log('--- Bắt đầu cập nhật Giảng viên hướng dẫn cho các đề tài ---');

  for (const item of mapping) {
    // 1. Tìm giảng viên theo tên
    const supervisor = await prisma.user.findFirst({
      where: {
        full_name: {
          contains: item.supervisorName,
          mode: 'insensitive'
        },
        role: {
          in: ['LECTURER', 'HEAD']
        }
      }
    });

    if (!supervisor) {
      console.log(`❌ Không tìm thấy giảng viên: ${item.supervisorName}`);
      continue;
    }

    console.log(`\n👨‍🏫 Giảng viên: ${supervisor.full_name} (${supervisor.email})`);

    // 2. Tìm và cập nhật từng đề tài thuộc giảng viên này
    for (const titleKeyword of item.topics) {
      const topic = await prisma.topic.findFirst({
        where: {
          title: {
            contains: titleKeyword,
            mode: 'insensitive'
          }
        },
        include: {
          supervisor: true
        }
      });

      if (!topic) {
        console.log(`  ❌ Không tìm thấy đề tài nào chứa từ khóa: "${titleKeyword}"`);
        continue;
      }

      if (topic.supervisor_id === supervisor.id) {
        console.log(`  ✅ Đề tài "${topic.title}" đã thuộc GVHD này sẵn rồi.`);
      } else {
        const oldName = topic.supervisor.full_name;
        // Cập nhật GVHD mới
        await prisma.topic.update({
          where: { id: topic.id },
          data: { supervisor_id: supervisor.id }
        });
        console.log(`  🔄 Đã chuyển đề tài "${topic.title}":`);
        console.log(`     Từ: [${oldName}] -> Sang: [${supervisor.full_name}]`);
      }
    }
  }

  console.log('\n=== Đã HOÀN THÀNH cập nhật giảng viên hướng dẫn cho các đề tài! ===');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi thực thi script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
